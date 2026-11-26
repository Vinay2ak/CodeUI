import React, { useEffect, useState, useReducer, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, AlertTriangle, Check, Lock } from 'lucide-react';
import { postProjectSchema, type PostProjectFormData } from './schema';
import {
  BLOCKER_TYPES,
  STACKS,
  SPECIALTIES,
  URGENCY,
  VERIFICATION_MODES,
} from './options';
import { loadDraft, saveDraft, clearDraft, type PostProjectDraftData } from './draft';
import { prefillFromProfile } from './prefill';
import { getOwnerProfile } from '../../services/identity/api';
import {
  createProject,
  updateProject,
  publishProject,
  saveBrief,
} from '../../services/project/api';
import { connectRepo, getRepoStatus } from '../../services/github/api';
import { startBriefJob, getBriefJob, cancelBriefJob } from '../../services/codeContext/api';
import { OptionRadioGroup } from './components/OptionRadioGroup';
import { PillMultiSelect } from './components/PillMultiSelect';
import { SkillsTagInput } from './components/SkillsTagInput';
import { Button } from '../../components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { FEATURES } from '../../lib/features';
import {
  aiFlowReducer,
  initialAiFlowState,
  canRescan,
  computeInputsHash,
} from './aiFlow';
import { GithubConnectCard } from '../ai-brief/components/GithubConnectCard';
import { AnalyzeBar } from '../ai-brief/components/AnalyzeBar';
import { AnalysisProgress } from '../ai-brief/components/AnalysisProgress';
import { BriefComparison } from '../ai-brief/components/BriefComparison';
import { nextPollDelay } from '../matching/polling';
import type { ProjectSnapshot } from '../ai-brief/types';

export const PostProjectPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<'saved' | 'saving' | null>(null);
  const [validationPromptText, setValidationPromptText] = useState<string | null>(null);
  const [authorizeUrl, setAuthorizeUrl] = useState<string | null>(null);

  // AI Flow Reducer
  const [aiState, dispatch] = useReducer(aiFlowReducer, initialAiFlowState);
  const activeJobIdRef = useRef<string | null>(null);
  const statusPollTimerRef = useRef<number | null>(null);

  const defaultValues: PostProjectFormData = {
    title: '',
    description: '',
    blockerType: 'HARD_BUG',
    stacks: ['PYTHON_FASTAPI'],
    specialties: [],
    skills: [],
    budget: 5000,
    urgency: 'THIS_WEEK',
    repoUrl: '',
    verificationMode: 'AUTO_TESTS_AND_REVIEW',
  };

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    setError,
    trigger,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<PostProjectFormData>({
    resolver: zodResolver(postProjectSchema) as any,
    defaultValues,
    mode: 'onBlur',
  });

  const formValues = watch();

  // 1. Initial Load: Try draft first, then prefill from Owner Profile
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      Object.entries(draft).forEach(([key, value]) => {
        if (
          key !== 'aiBrief' &&
          key !== 'analyzedHash' &&
          key !== 'projectId' &&
          key !== 'repo' &&
          key !== 'snapshot'
        ) {
          setValue(key as any, value);
        }
      });

      // Restore AI flow state if preserved in draft
      if (draft.aiBrief && draft.analyzedHash) {
        dispatch({
          type: 'RESTORE',
          payload: {
            brief: draft.aiBrief,
            analyzedHash: draft.analyzedHash,
            projectId: draft.projectId || null,
            repo: draft.repo || null,
            snapshot: draft.snapshot || null,
            phase: 'brief_ready',
          },
        });
      }
      return;
    }

    // Prefill from Identity Service Owner Profile
    let active = true;
    getOwnerProfile()
      .then((profile) => {
        if (!active || !profile) return;
        const prefilled = prefillFromProfile(profile);
        Object.entries(prefilled).forEach(([key, value]) => {
          if (value !== undefined) {
            setValue(key as any, value);
          }
        });
      })
      .catch(() => {
        // Silent failure for prefill
      });

    return () => {
      active = false;
    };
  }, [setValue]);

  // Compute current inputs hash for AI stale detection (budget excluded)
  const currentInputsHash = computeInputsHash({
    title: formValues.title || '',
    description: formValues.description || '',
    stacks: formValues.stacks || [],
    specialties: formValues.specialties || [],
    repoFullName: aiState.repo?.fullName || '',
    headCommitSha: aiState.repo?.headCommitSha || '',
  });

  // Track hash changes in aiFlow state machine
  useEffect(() => {
    dispatch({ type: 'INPUTS_CHANGED', payload: { hash: currentInputsHash } });
  }, [currentInputsHash]);

  // 2. Autosave draft debounced by 1 second, including AI brief state
  useEffect(() => {
    setDraftStatus('saving');
    const timer = setTimeout(() => {
      const draftData: PostProjectDraftData = {
        ...formValues,
        aiBrief: aiState.brief,
        analyzedHash: aiState.analyzedHash,
        projectId: aiState.projectId,
        repo: aiState.repo,
        snapshot: aiState.snapshot,
      };
      saveDraft(draftData);
      setDraftStatus('saved');
    }, 1000);

    return () => clearTimeout(timer);
  }, [formValues, aiState.brief, aiState.analyzedHash, aiState.projectId, aiState.repo, aiState.snapshot]);

  // Clean up poll timers
  useEffect(() => {
    return () => {
      if (statusPollTimerRef.current) {
        clearInterval(statusPollTimerRef.current);
      }
    };
  }, []);

  // Poll for GitHub authorization status (every 2s for up to 60s)
  const startPollingRepoStatus = useCallback((projectId: string) => {
    if (statusPollTimerRef.current) {
      clearInterval(statusPollTimerRef.current);
    }

    let elapsedMs = 0;
    statusPollTimerRef.current = window.setInterval(async () => {
      elapsedMs += 2000;
      if (elapsedMs >= 60000) {
        if (statusPollTimerRef.current) clearInterval(statusPollTimerRef.current);
        return;
      }

      try {
        const res = await getRepoStatus(projectId);
        if (res.status === 'connected' && res.repo) {
          dispatch({ type: 'REPO_STATUS_RECEIVED', payload: { repo: res.repo } });
          setAuthorizeUrl(null);
          if (statusPollTimerRef.current) clearInterval(statusPollTimerRef.current);
        } else if (res.status === 'error' && res.error) {
          dispatch({ type: 'REPO_STATUS_RECEIVED', payload: { repo: null, error: res.error } });
          if (statusPollTimerRef.current) clearInterval(statusPollTimerRef.current);
        }
      } catch {
        // continue polling
      }
    }, 2000);
  }, []);

  // Handler: Connect Repository
  const handleConnectRepo = async () => {
    setValidationPromptText(null);
    const valid = await trigger();

    if (!valid) {
      const fieldOrder: (keyof PostProjectFormData)[] = [
        'title',
        'description',
        'blockerType',
        'stacks',
        'budget',
        'urgency',
        'repoUrl',
        'verificationMode',
      ];
      for (const field of fieldOrder) {
        if (errors[field]) {
          setFocus(field);
          break;
        }
      }
      setValidationPromptText('Complete the required fields first.');
      return;
    }

    try {
      let pid = aiState.projectId;
      if (!pid) {
        dispatch({ type: 'DRAFT_SAVING' });
        const idempotencyKey = `draft-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const created = await createProject(
          {
            title: formValues.title,
            description: formValues.description,
            budget: formValues.budget,
            urgency: formValues.urgency,
            repoUrl: formValues.repoUrl || null,
            verificationMode: formValues.verificationMode,
            blockerType: formValues.blockerType || 'HARD_BUG',
            stacks: formValues.stacks && formValues.stacks.length > 0 ? formValues.stacks : ['PYTHON_FASTAPI'],
            specialties: formValues.specialties || [],
            skills: formValues.skills || [],
            status: 'draft',
          },
          idempotencyKey
        );
        pid = created.id;
        dispatch({ type: 'DRAFT_SAVED', payload: { projectId: pid } });
      } else {
        await updateProject(pid, {
          title: formValues.title,
          description: formValues.description,
          budget: formValues.budget,
          urgency: formValues.urgency,
          repoUrl: formValues.repoUrl || null,
          verificationMode: formValues.verificationMode,
          blockerType: formValues.blockerType || 'HARD_BUG',
          stacks: formValues.stacks,
          specialties: formValues.specialties,
          skills: formValues.skills,
          status: 'draft',
        });
      }

      dispatch({ type: 'REPO_CONNECT_REQUESTED' });
      const res = await connectRepo(pid, formValues.repoUrl);

      if (res.status === 'connected' && res.repo) {
        dispatch({ type: 'REPO_STATUS_RECEIVED', payload: { repo: res.repo } });
      } else if (res.status === 'pending') {
        setAuthorizeUrl(res.authorizeUrl || null);
        startPollingRepoStatus(pid);
      } else if (res.status === 'error' && res.error) {
        dispatch({ type: 'REPO_STATUS_RECEIVED', payload: { repo: null, error: res.error } });
      }
    } catch (err: any) {
      dispatch({
        type: 'REPO_STATUS_RECEIVED',
        payload: {
          repo: null,
          error: {
            code: err.code || 'GITHUB_UNAVAILABLE',
            message: err.detail || err.message || 'Unable to connect to GitHub. Please try again.',
          },
        },
      });
    }
  };

  const handleCheckRepoStatus = async () => {
    if (!aiState.projectId) return;
    try {
      const res = await getRepoStatus(aiState.projectId);
      if (res.status === 'connected' && res.repo) {
        dispatch({ type: 'REPO_STATUS_RECEIVED', payload: { repo: res.repo } });
        setAuthorizeUrl(null);
      } else if (res.status === 'error' && res.error) {
        dispatch({ type: 'REPO_STATUS_RECEIVED', payload: { repo: null, error: res.error } });
      }
    } catch (err: any) {
      dispatch({
        type: 'REPO_STATUS_RECEIVED',
        payload: { repo: null, error: { code: 'GITHUB_UNAVAILABLE', message: err.message } },
      });
    }
  };

  // Handler: Start Analysis
  const handleStartAnalyze = async () => {
    setValidationPromptText(null);
    const valid = await trigger();
    if (!valid || !aiState.projectId || !aiState.repo) {
      if (!valid) setValidationPromptText('Complete the required fields first.');
      return;
    }

    try {
      // 1. PATCH draft with latest form values first
      await updateProject(aiState.projectId, {
        title: formValues.title,
        description: formValues.description,
        budget: formValues.budget,
        urgency: formValues.urgency,
        repoUrl: formValues.repoUrl,
        verificationMode: formValues.verificationMode,
        blockerType: formValues.blockerType,
        stacks: formValues.stacks,
        specialties: formValues.specialties,
        skills: formValues.skills,
        status: 'draft',
      });

      const snapshot: ProjectSnapshot = {
        title: formValues.title,
        description: formValues.description,
        stacks: formValues.stacks || ['PYTHON_FASTAPI'],
        specialties: formValues.specialties || [],
        budget: formValues.budget,
        repoFullName: aiState.repo.fullName,
        headCommitSha: aiState.repo.headCommitSha,
        verificationMode: formValues.verificationMode,
      };

      const hash = computeInputsHash(snapshot);
      dispatch({ type: 'ANALYZE_REQUESTED', payload: { snapshot, hash } });

      const idempotencyKey = `job-${aiState.projectId}-${Date.now()}`;
      const { jobId } = await startBriefJob(aiState.projectId, hash, idempotencyKey);
      activeJobIdRef.current = jobId;

      // 2. Poll loop using nextPollDelay
      let attempt = 0;
      while (activeJobIdRef.current === jobId) {
        const delay = nextPollDelay(attempt);
        await new Promise((r) => setTimeout(r, delay));
        if (activeJobIdRef.current !== jobId) break;

        try {
          const job = await getBriefJob(aiState.projectId, jobId);
          dispatch({ type: 'JOB_UPDATE', payload: job });

          if (job.status === 'completed' && job.brief) {
            dispatch({ type: 'BRIEF_READY', payload: { brief: job.brief, hash, snapshot } });
            activeJobIdRef.current = null;
            break;
          }

          if (job.status === 'failed') {
            dispatch({
              type: 'JOB_FAILED',
              payload: {
                error: {
                  where: 'analysis',
                  code: job.error?.code || 'UNKNOWN',
                  message: job.error?.message || 'Analysis failed',
                  correlationId: job.error?.correlationId,
                },
              },
            });
            activeJobIdRef.current = null;
            break;
          }

          if (job.status === 'cancelled') {
            activeJobIdRef.current = null;
            break;
          }
        } catch (pollErr: any) {
          dispatch({
            type: 'JOB_FAILED',
            payload: {
              error: {
                where: 'analysis',
                code: pollErr.code || 'UNKNOWN',
                message: pollErr.message || 'Analysis polling error',
                correlationId: pollErr.correlationId,
              },
            },
          });
          activeJobIdRef.current = null;
          break;
        }
        attempt++;
      }
    } catch (err: any) {
      dispatch({
        type: 'JOB_FAILED',
        payload: {
          error: {
            where: 'analysis',
            code: err.code || 'UNKNOWN',
            message: err.detail || err.message || 'Failed to start repository analysis.',
            correlationId: err.correlationId,
          },
        },
      });
    }
  };

  const handleCancelAnalyze = () => {
    if (activeJobIdRef.current && aiState.projectId) {
      cancelBriefJob(aiState.projectId, activeJobIdRef.current).catch(() => {});
      activeJobIdRef.current = null;
    }
    dispatch({ type: 'BRIEF_DISMISSED' });
  };

  // Handler: Confirm & Publish Brief
  const handlePublish = async () => {
    if (!aiState.brief || !aiState.analyzedHash) return;
    dispatch({ type: 'PUBLISH_REQUESTED' });

    try {
      const isDraftPublishOn = FEATURES.DRAFT_PUBLISH;
      let targetProjectId = aiState.projectId;

      if (isDraftPublishOn && targetProjectId) {
        // Step 1: Save confirmed brief (if not already saved)
        if (aiState.publishStep === 'brief') {
          const confirmedAt = new Date().toISOString();
          await saveBrief(targetProjectId, {
            ...aiState.brief,
            inputsHash: aiState.analyzedHash,
            confirmedAt,
          });
          dispatch({ type: 'BRIEF_SAVED' });
        }

        // Step 2: Publish draft to open
        const pubKey = `pub-${targetProjectId}-${Date.now()}`;
        await publishProject(targetProjectId, pubKey);
        dispatch({ type: 'PUBLISHED' });
      } else {
        // DRAFT_PUBLISH is off: create directly as 'open', then save brief
        const openKey = `proj-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const trimmedDesc = formValues.description.trim();
        const trimmedRepo = (formValues.repoUrl || '').trim();
        const created = await createProject(
          {
            title: formValues.title,
            description: trimmedDesc,
            expectedResult: trimmedRepo ? `${trimmedDesc}\n\nRepository: ${trimmedRepo}` : trimmedDesc,
            budget: formValues.budget,
            urgency: formValues.urgency,
            repoUrl: trimmedRepo || null,
            verificationMode: formValues.verificationMode,
            blockerType: formValues.blockerType || 'HARD_BUG',
            stacks: formValues.stacks && formValues.stacks.length > 0 ? formValues.stacks : ['PYTHON_FASTAPI'],
            specialties: formValues.specialties || [],
            skills: formValues.skills || [],
            status: 'open',
          },
          openKey
        );
        targetProjectId = created.id;

        if (trimmedRepo) {
          connectRepo(targetProjectId, trimmedRepo).catch(() => {});
        }

        const confirmedAt = new Date().toISOString();
        await saveBrief(targetProjectId, {
          ...aiState.brief,
          inputsHash: aiState.analyzedHash,
          confirmedAt,
        });
        dispatch({ type: 'PUBLISHED' });
      }

      // Success
      clearDraft();
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate(`/owner/projects/${targetProjectId}`, {
        replace: true,
        state: { justPosted: true },
      });
    } catch (err: any) {
      if (err.status === 409) {
        alert('This project was already published.');
        if (aiState.projectId) {
          navigate(`/owner/projects/${aiState.projectId}`);
        }
        return;
      }

      if (err.status === 503) {
        dispatch({
          type: 'FAILED',
          payload: {
            error: {
              where: 'publish',
              code: 'SERVICE_UNAVAILABLE',
              message: 'The project service is unavailable. Your brief is kept.',
              correlationId: err.correlationId,
            },
          },
        });
        return;
      }

      const msg =
        aiState.publishStep === 'publish'
          ? 'Your brief is saved. Publishing failed.'
          : err.detail || err.message || 'Something went wrong.';

      dispatch({
        type: 'FAILED',
        payload: {
          error: {
            where: 'publish',
            code: err.code || 'UNKNOWN',
            message: msg,
            correlationId: err.correlationId,
          },
        },
      });
    }
  };

  const handleDiscardBrief = () => {
    dispatch({ type: 'BRIEF_DISMISSED' });
  };

  // Standard One-Step Post Submit (when not using AI brief or brief is discarded)
  const onSubmit = async (values: PostProjectFormData) => {
    setSubmitError(null);
    try {
      const idempotencyKey = `proj-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const trimmedDesc = values.description.trim();
      const trimmedRepo = (values.repoUrl || '').trim();

      const created = await createProject(
        {
          title: values.title,
          description: trimmedDesc,
          expectedResult: trimmedRepo ? `${trimmedDesc}\n\nRepository: ${trimmedRepo}` : trimmedDesc,
          budget: values.budget,
          urgency: values.urgency,
          repoUrl: trimmedRepo || null,
          verificationMode: values.verificationMode,
          blockerType: values.blockerType || 'HARD_BUG',
          stacks: values.stacks && values.stacks.length > 0 ? values.stacks : ['PYTHON_FASTAPI'],
          specialties: values.specialties || [],
          skills: values.skills || [],
          status: 'open',
        },
        idempotencyKey
      );

      if (trimmedRepo) {
        connectRepo(created.id, trimmedRepo).catch(() => {});
      }

      // Clear draft on successful creation
      clearDraft();

      // Invalidate projects cache immediately
      queryClient.invalidateQueries({ queryKey: ['projects'] });

      // Automatically open the project page with matching developers
      navigate(`/owner/projects/${created.id}`);
    } catch (err: any) {
      if (err.fieldErrors) {
        Object.entries(err.fieldErrors).forEach(([field, msg]) => {
          if (typeof msg === 'string') {
            setError(field as any, { type: 'server', message: msg });
          }
        });
      } else {
        setSubmitError(err.detail || err.message || 'Failed to post project. Please retry.');
      }
    }
  };

  const hasBrief = Boolean(aiState.brief);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Top Bar / Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <button
          type="button"
          onClick={() => navigate('/owner')}
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Overview
        </button>

        {draftStatus && (
          <span className="text-xs text-text-muted flex items-center gap-1 font-mono">
            {draftStatus === 'saving' ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving draft...
              </>
            ) : (
              <>
                <Check className="w-3 h-3 text-success" />
                Draft saved
              </>
            )}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-text">Post a Technical Problem</h1>
        <p className="text-sm text-text-muted">
          Describe the challenge. We analyze requirements and recommend vetted developers matching your stack.
        </p>
      </div>

      {submitError && (
        <div className="p-4 rounded-lg bg-surface border border-danger/40 text-danger text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Main Form */}
      <div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Card 1: What needs fixing? */}
          <div className="p-6 rounded-xl border border-border bg-surface space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                1
              </span>
              <h2 className="text-base font-semibold text-text">What needs fixing?</h2>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label htmlFor="project-title" className="text-sm font-semibold text-text">
                Project Title <span className="text-danger">*</span>
              </label>
              <input
                id="project-title"
                type="text"
                placeholder="e.g., Stripe webhook signature verification fails under concurrency"
                {...register('title')}
                className={`w-full px-3.5 py-2 text-sm rounded-lg border bg-surface text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.title ? 'border-danger' : 'border-border'
                }`}
              />
              <p className="text-xs text-text-muted">
                10-80 characters. Be concise and name the specific subsystem or error.
              </p>
              {errors.title && (
                <p className="text-xs text-danger font-medium">{errors.title.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label htmlFor="project-desc" className="text-sm font-semibold text-text">
                Detailed Problem Description <span className="text-danger">*</span>
              </label>
              <textarea
                id="project-desc"
                rows={5}
                placeholder="Describe current behavior, expected behavior, error logs, and any reproducible steps..."
                {...register('description')}
                className={`w-full px-3.5 py-2 text-sm rounded-lg border bg-surface text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.description ? 'border-danger' : 'border-border'
                }`}
              />
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>Minimum 40 characters. Include error messages or stack traces if available.</span>
                <span className="font-mono">{(formValues.description || '').length} / 1500</span>
              </div>
              {errors.description && (
                <p className="text-xs text-danger font-medium">{errors.description.message}</p>
              )}
            </div>

            {/* Blocker Type */}
            <Controller
              name="blockerType"
              control={control}
              render={({ field }) => (
                <OptionRadioGroup
                  label="Problem type"
                  name="blockerType"
                  options={BLOCKER_TYPES}
                  value={field.value}
                  onChange={field.onChange}
                  columns={2}
                  error={errors.blockerType?.message}
                />
              )}
            />
          </div>

          {/* Card 2: Technology & Stack */}
          <div className="p-6 rounded-xl border border-border bg-surface space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                2
              </span>
              <h2 className="text-base font-semibold text-text">Technology & Stack</h2>
            </div>

            {/* Stacks */}
            <Controller
              name="stacks"
              control={control}
              render={({ field }) => (
                <PillMultiSelect
                  label="Tech stacks"
                  helperText="Select 1 to 4 stacks that power your application"
                  options={STACKS}
                  values={field.value}
                  onChange={field.onChange}
                  max={4}
                  min={1}
                  error={errors.stacks?.message}
                />
              )}
            />

            {/* Specialties */}
            <Controller
              name="specialties"
              control={control}
              render={({ field }) => (
                <PillMultiSelect
                  label="Domain specialties (optional)"
                  helperText="Up to 3 domain areas"
                  options={SPECIALTIES}
                  values={field.value || []}
                  onChange={field.onChange}
                  max={3}
                  error={errors.specialties?.message}
                />
              )}
            />

            {/* Custom Skills Tag Input */}
            <Controller
              name="skills"
              control={control}
              render={({ field }) => (
                <SkillsTagInput
                  skills={field.value || []}
                  onChange={field.onChange}
                  error={errors.skills?.message}
                />
              )}
            />
          </div>

          {/* Card 3: Budget, Timeline & Repository */}
          <div className="p-6 rounded-xl border border-border bg-surface space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                3
              </span>
              <h2 className="text-base font-semibold text-text">Budget, Timeline & Verification</h2>
            </div>

            {/* Budget */}
            <div className="space-y-1.5">
              <label htmlFor="budget-input" className="text-sm font-semibold text-text">
                Budget (INR ₹) <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-text-muted font-bold text-sm">₹</span>
                <input
                  id="budget-input"
                  type="number"
                  min={500}
                  max={100000}
                  step={100}
                  {...register('budget', { valueAsNumber: true })}
                  className={`w-full pl-8 pr-3.5 py-2 text-sm font-bold rounded-lg border bg-surface text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.budget ? 'border-danger' : 'border-border'
                  }`}
                />
              </div>
              <p className="text-xs text-text-muted">
                Standard range: ₹500 to ₹1,00,000. Funds held in milestone escrow.
              </p>
              {errors.budget && (
                <p className="text-xs text-danger font-medium">{errors.budget.message}</p>
              )}
            </div>

            {/* Urgency */}
            <Controller
              name="urgency"
              control={control}
              render={({ field }) => (
                <OptionRadioGroup
                  label="Target turnaround"
                  name="urgency"
                  options={URGENCY}
                  value={field.value}
                  onChange={field.onChange}
                  columns={3}
                  error={errors.urgency?.message}
                />
              )}
            />

            {/* Repo URL */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="repo-url" className="text-sm font-semibold text-text">
                  GitHub repository URL <span className="text-danger">*</span>
                </label>
                {formValues.repoUrl && formValues.repoUrl.trim().length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-surface-raised border border-border text-text-muted">
                    <Lock className="w-3 h-3 text-text-muted" strokeWidth={1.5} />
                    Read-only access
                  </span>
                )}
              </div>
              <input
                id="repo-url"
                type="url"
                placeholder="https://github.com/owner/repository"
                {...register('repoUrl')}
                className={`w-full px-3.5 py-2 text-sm rounded-lg border bg-surface text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.repoUrl ? 'border-danger' : 'border-border'
                }`}
              />
              <p className="text-xs text-text-muted">
                Must be in the format: https://github.com/owner/repo
              </p>
              {errors.repoUrl && (
                <p className="text-xs text-danger font-medium">{errors.repoUrl.message}</p>
              )}
            </div>

            {/* Verification Mode */}
            <Controller
              name="verificationMode"
              control={control}
              render={({ field }) => (
                <OptionRadioGroup
                  label="Verification & acceptance mode"
                  name="verificationMode"
                  options={VERIFICATION_MODES}
                  value={field.value}
                  onChange={field.onChange}
                  columns={2}
                  error={errors.verificationMode?.message}
                />
              )}
            />
          </div>

          {/* Card 4: Repository and AI Brief (Rendered only when FEATURES.AI_BRIEF is on) */}
          {FEATURES.AI_BRIEF && (
            <div className="p-6 rounded-xl border border-border bg-surface space-y-5">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    4
                  </span>
                  <h2 className="text-base font-semibold text-text">Repository and AI brief</h2>
                </div>
                <span className="text-xs text-text-muted">Advisory analysis</span>
              </div>

              {/* GitHub Connect Sub-Card */}
              <GithubConnectCard
                repoUrl={formValues.repoUrl || ''}
                repo={aiState.repo}
                phase={aiState.phase}
                error={aiState.error}
                authorizeUrl={authorizeUrl}
                onConnect={handleConnectRepo}
                onCheckStatus={handleCheckRepoStatus}
                onRetry={handleConnectRepo}
              />

              {/* Analyze Bar */}
              {aiState.phase !== 'analyzing' && !hasBrief && (
                <AnalyzeBar
                  hasBrief={hasBrief}
                  canRescan={canRescan(aiState, currentInputsHash)}
                  isAnalyzing={false}
                  isFormValid={
                    !errors.title &&
                    !errors.description &&
                    !errors.stacks &&
                    Boolean(formValues.title && formValues.description)
                  }
                  isRepoConnected={Boolean(aiState.repo)}
                  onAnalyze={handleStartAnalyze}
                  statusText={validationPromptText}
                />
              )}

              {/* Analysis Progress (3 stages) */}
              {aiState.phase === 'analyzing' && (
                <AnalysisProgress
                  job={aiState.job}
                  onCancel={handleCancelAnalyze}
                  onRetry={handleStartAnalyze}
                  error={aiState.error}
                />
              )}

              {/* Side-by-Side Comparison & Confirm Publish */}
              {hasBrief && aiState.snapshot && (
                <BriefComparison
                  brief={aiState.brief!}
                  snapshot={aiState.snapshot}
                  currentFormValues={{
                    title: formValues.title,
                    description: formValues.description,
                    stacks: formValues.stacks,
                    specialties: formValues.specialties,
                    budget: formValues.budget,
                    repoFullName: aiState.repo?.fullName,
                    headCommitSha: aiState.repo?.headCommitSha,
                    verificationMode: formValues.verificationMode,
                  }}
                  isStale={aiState.phase === 'stale'}
                  canRescan={canRescan(aiState, currentInputsHash)}
                  isPublishing={aiState.phase === 'publishing'}
                  publishError={aiState.error?.where === 'publish' ? aiState.error.message : null}
                  onUpdateBrief={(updated) => dispatch({ type: 'BRIEF_EDITED', payload: updated })}
                  onRescan={handleStartAnalyze}
                  onPublish={handlePublish}
                  onDiscard={handleDiscardBrief}
                />
              )}
            </div>
          )}

          {/* Standard Form Actions (Shown when no brief is active) */}
          {!hasBrief && (
            <div className="flex items-center justify-end gap-3 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/owner')}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="min-w-[190px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Posting project...
                  </>
                ) : (
                  'Submit & find developers'
                )}
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default PostProjectPage;
