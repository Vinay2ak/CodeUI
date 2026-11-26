import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { AlertCircle, CheckCircle2, Plus, X } from "lucide-react";
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/button";
import { VITE_GITHUB_MODE } from "../../../lib/env";
import { mockLink } from "../../../services/github/api";
import { CheckboxRow } from "../components/CheckboxRow";
import { GitHubDialog } from "../components/GitHubDialog";
import { NumberField } from "../components/NumberField";
import { OptionCard } from "../components/OptionCard";
import { PillGroup } from "../components/PillGroup";
import { StepHeading } from "../components/StepHeading";
import { TextArea } from "../components/TextArea";
import { TextField } from "../components/TextField";
import { WizardNav } from "../components/WizardNav";
import {
  AVAILABILITY_OPTIONS,
  EXPERIENCE_LEVELS,
  FREELANCER_STACKS,
  SKILL_SUGGESTIONS,
  SPECIALTIES,
} from "../options";
import {
  freelancerStep1Schema,
  freelancerStep2Schema,
  freelancerStep3Schema,
} from "../schemas";
import { addSkill } from "../skills";
import type {
  FreelancerStep1Data,
  FreelancerStep2Data,
  FreelancerStep3Data,
} from "../types";

export type FreelancerDraftData = Partial<
  FreelancerStep1Data & FreelancerStep2Data & FreelancerStep3Data
>;

interface BaseFreelancerStepProps {
  initialValues: FreelancerDraftData;
  onValuesChange: (patch: FreelancerDraftData) => void;
  onBack: (current: FreelancerDraftData) => void;
  externalErrors?: Record<string, string>;
  focusField?: string | null;
}

export interface FreelancerStep1Props extends BaseFreelancerStepProps {
  githubConnected: boolean;
  linkedGithubUsername?: string;
  onGithubChange: (connected: boolean, username?: string) => void;
  onNext: (data: FreelancerStep1Data) => void;
}

export function FreelancerStep1({
  initialValues,
  onValuesChange,
  onBack,
  onNext,
  githubConnected,
  linkedGithubUsername,
  onGithubChange,
  externalErrors,
  focusField,
}: FreelancerStep1Props) {
  const [headline, setHeadline] = useState(initialValues.headline ?? "");
  const [experience, setExperience] = useState(initialValues.experience ?? "");
  const [githubUsername, setGithubUsername] = useState(
    initialValues.githubUsername ?? linkedGithubUsername ?? ""
  );
  const [portfolioUrl, setPortfolioUrl] = useState(initialValues.portfolioUrl ?? "");
  const [bio, setBio] = useState(initialValues.bio ?? "");

  const [manualEditing, setManualEditing] = useState(false);
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string[]>([]);

  const headlineRef = useRef<HTMLInputElement>(null);
  const experienceRef = useRef<HTMLFieldSetElement>(null);
  const githubRef = useRef<HTMLInputElement>(null);
  const portfolioRef = useRef<HTMLInputElement>(null);
  const bioRef = useRef<HTMLTextAreaElement>(null);

  const trimmedGithub = githubUsername.trim().replace(/^@/, "");
  const isVerifiedMatch = Boolean(
    githubConnected && linkedGithubUsername && trimmedGithub === linkedGithubUsername
  );
  const isReadOnlyVerified = isVerifiedMatch && !manualEditing;

  const currentData = (overrides?: Partial<FreelancerDraftData>): FreelancerDraftData => ({
    headline,
    experience,
    githubUsername: trimmedGithub || undefined,
    portfolioUrl: portfolioUrl.trim() || undefined,
    bio,
    ...overrides,
  });

  const focusByField = (field: string) => {
    if (field === "headline") {
      headlineRef.current?.focus();
    } else if (field === "experience") {
      experienceRef.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
    } else if (field === "githubUsername") {
      githubRef.current?.focus();
    } else if (field === "portfolioUrl") {
      portfolioRef.current?.focus();
    } else if (field === "bio") {
      bioRef.current?.focus();
    }
  };

  useEffect(() => {
    if (externalErrors && Object.keys(externalErrors).length > 0) {
      setErrors(externalErrors);
      setSummary(Object.values(externalErrors));
    }
  }, [externalErrors]);

  useEffect(() => {
    if (focusField) {
      focusByField(focusField);
    }
  }, [focusField]);

  const handleAuthorizeGithub = async (username: string) => {
    setGithubDialogOpen(false);
    setGithubLoading(true);
    try {
      const res = await mockLink(username);
      const handle = res.githubUsername ?? username;
      setGithubUsername(handle);
      setManualEditing(false);
      onGithubChange(res.connected, handle);
      onValuesChange(currentData({ githubUsername: handle }));
      setErrors((prev) => ({ ...prev, githubUsername: "" }));
    } catch {
      onGithubChange(false, undefined);
    } finally {
      setGithubLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = freelancerStep1Schema.safeParse({
      headline,
      experience,
      githubUsername: trimmedGithub,
      portfolioUrl: portfolioUrl.trim(),
      bio,
    });

    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      const nextSummary: string[] = [];
      let firstKey: string | null = null;
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        const msg = key === "experience" ? "Select your experience level." : issue.message;
        if (key && !nextErrors[key]) {
          nextErrors[key] = msg;
          nextSummary.push(msg);
          if (!firstKey) firstKey = key;
        }
      }
      setErrors(nextErrors);
      setSummary(nextSummary);
      if (firstKey) focusByField(firstKey);
      return;
    }

    setErrors({});
    setSummary([]);
    onNext({
      ...parsed.data,
      githubUsername: parsed.data.githubUsername || undefined,
      portfolioUrl: parsed.data.portfolioUrl || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <StepHeading
        stepKey="freelancer-1"
        title="Developer identity"
        subtitle="Introduce your background so owners trust you in their repositories."
      />

      <div aria-live="polite">
        {summary.length > 0 && (
          <Alert variant="error" title="Please fix the following">
            <ul className="list-disc pl-4 space-y-0.5">
              {summary.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          </Alert>
        )}
      </div>

      <TextField
        ref={headlineRef}
        label="Headline"
        name="headline"
        placeholder="Full-stack Python/FastAPI and React debugger"
        value={headline}
        onChange={(e) => {
          const val = e.target.value;
          setHeadline(val);
          onValuesChange(currentData({ headline: val }));
          if (errors.headline) setErrors((prev) => ({ ...prev, headline: "" }));
        }}
        error={errors.headline || undefined}
      />

      <fieldset ref={experienceRef} className="space-y-2.5 min-w-0">
        <legend className="text-sm font-medium text-text">Experience level</legend>
        <div className="grid gap-2.5">
          {EXPERIENCE_LEVELS.map((opt) => (
            <OptionCard
              key={opt.value}
              name="experience"
              value={opt.value}
              checked={experience === opt.value}
              onChange={(val) => {
                setExperience(val);
                onValuesChange(currentData({ experience: val }));
                setErrors((prev) => ({ ...prev, experience: "" }));
              }}
              label={opt.label}
              hint={"hint" in opt ? opt.hint : undefined}
            />
          ))}
        </div>
        {errors.experience && (
          <p role="alert" className="text-xs text-danger">
            {errors.experience}
          </p>
        )}
      </fieldset>

      <div className="space-y-2">
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <TextField
              ref={githubRef}
              label="GitHub username (optional)"
              name="githubUsername"
              placeholder="octocat"
              value={githubUsername}
              readOnly={isReadOnlyVerified}
              onChange={(e) => {
                const val = e.target.value;
                setGithubUsername(val);
                onValuesChange(currentData({ githubUsername: val.trim().replace(/^@/, "") || undefined }));
                if (errors.githubUsername) setErrors((prev) => ({ ...prev, githubUsername: "" }));
              }}
              error={errors.githubUsername || undefined}
            />
          </div>

          {VITE_GITHUB_MODE === "mock" && (
            <div className="pb-[1.375rem] shrink-0">
              {isReadOnlyVerified ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setManualEditing(true);
                    githubRef.current?.focus();
                  }}
                >
                  Change
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  loading={githubLoading}
                  onClick={() => setGithubDialogOpen(true)}
                >
                  Verify via GitHub
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 -mt-2">
          {isVerifiedMatch ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Verified</span>
            </span>
          ) : trimmedGithub ? (
            <span className="inline-flex items-center rounded-full border border-border bg-surface-raised px-2.5 py-0.5 text-xs font-medium text-text-muted">
              Unverified
            </span>
          ) : null}

          {VITE_GITHUB_MODE === "off" && (
            <p className="text-xs text-text-muted">
              GitHub verification arrives with the GitHub service. You can still add your handle now.
            </p>
          )}
        </div>
      </div>

      <TextField
        ref={portfolioRef}
        label="Portfolio URL (optional)"
        name="portfolioUrl"
        type="url"
        placeholder="https://yourportfolio.dev"
        value={portfolioUrl}
        onChange={(e) => {
          const val = e.target.value;
          setPortfolioUrl(val);
          onValuesChange(currentData({ portfolioUrl: val.trim() || undefined }));
          if (errors.portfolioUrl) setErrors((prev) => ({ ...prev, portfolioUrl: "" }));
        }}
        error={errors.portfolioUrl || undefined}
      />

      <TextArea
        ref={bioRef}
        label="Short engineering bio"
        name="bio"
        value={bio}
        minLength={40}
        maxLength={400}
        hint="Describe 1-2 tough bugs, integrations or architectures you built or fixed recently"
        onChange={(e) => {
          const val = e.target.value;
          setBio(val);
          onValuesChange(currentData({ bio: val }));
          if (errors.bio) setErrors((prev) => ({ ...prev, bio: "" }));
        }}
        error={errors.bio || undefined}
      />

      <WizardNav
        showBack={false}
        onBack={() => onBack(currentData())}
        submitLabel="Continue"
      />

      <GitHubDialog
        open={githubDialogOpen}
        onClose={() => setGithubDialogOpen(false)}
        onAuthorize={(username) => void handleAuthorizeGithub(username)}
        initialUsername={trimmedGithub || linkedGithubUsername}
      />
    </form>
  );
}

export interface FreelancerStep2Props extends BaseFreelancerStepProps {
  onNext: (data: FreelancerStep2Data) => void;
  isSubmitting?: boolean;
}

export function FreelancerStep2({
  initialValues,
  onValuesChange,
  onBack,
  onNext,
  isSubmitting = false,
  externalErrors,
  focusField,
}: FreelancerStep2Props) {
  const [supportedStacks, setSupportedStacks] = useState<string[]>(
    initialValues.supportedStacks ?? []
  );
  const [skills, setSkills] = useState<string[]>(initialValues.skills ?? []);
  const [skillInput, setSkillInput] = useState("");
  const [debuggingSpecialties, setDebuggingSpecialties] = useState<string[]>(
    initialValues.debuggingSpecialties ?? []
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string[]>([]);

  const stacksRef = useRef<HTMLDivElement>(null);
  const skillInputRef = useRef<HTMLInputElement>(null);
  const specialtiesRef = useRef<HTMLDivElement>(null);

  const currentData = (overrides?: Partial<FreelancerDraftData>): FreelancerDraftData => ({
    supportedStacks,
    skills,
    debuggingSpecialties,
    ...overrides,
  });

  const focusByField = (field: string) => {
    if (field === "supportedStacks") {
      stacksRef.current?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.focus();
    } else if (field === "skills") {
      skillInputRef.current?.focus();
    } else if (field === "debuggingSpecialties") {
      specialtiesRef.current?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.focus();
    }
  };

  useEffect(() => {
    if (externalErrors && Object.keys(externalErrors).length > 0) {
      setErrors(externalErrors);
      setSummary(Object.values(externalErrors));
    }
  }, [externalErrors]);

  useEffect(() => {
    if (focusField) {
      focusByField(focusField);
    }
  }, [focusField]);

  const handleAddSkill = (raw?: string) => {
    const candidate = raw ?? skillInput;
    const next = addSkill(skills, candidate);
    if (next !== skills) {
      setSkills(next);
      onValuesChange(currentData({ skills: next }));
      if (errors.skills) setErrors((prev) => ({ ...prev, skills: "" }));
    }
    if (raw === undefined) {
      setSkillInput("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    const next = skills.filter((s) => s !== skillToRemove);
    setSkills(next);
    onValuesChange(currentData({ skills: next }));
  };

  const handleSkillKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSkill();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = freelancerStep2Schema.safeParse({
      supportedStacks,
      skills,
      debuggingSpecialties,
    });

    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      const nextSummary: string[] = [];
      let firstKey: string | null = null;
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        const msg =
          key === "supportedStacks"
            ? "Select at least 1 supported stack."
            : key === "skills"
              ? "Add 3 to 12 skills."
              : key === "debuggingSpecialties"
                ? "Select at least 1 debugging specialty."
                : issue.message;
        if (key && !nextErrors[key]) {
          nextErrors[key] = msg;
          nextSummary.push(msg);
          if (!firstKey) firstKey = key;
        }
      }
      setErrors(nextErrors);
      setSummary(nextSummary);
      if (firstKey) focusByField(firstKey);
      return;
    }

    setErrors({});
    setSummary([]);
    onNext(parsed.data);
  };

  const lowerSkills = new Set(skills.map((s) => s.toLowerCase()));

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <StepHeading
        stepKey="freelancer-2"
        title="Skills and stacks"
        subtitle="Select the workspaces and tools you debug fastest."
      />

      <div aria-live="polite">
        {summary.length > 0 && (
          <Alert variant="error" title="Please fix the following">
            <ul className="list-disc pl-4 space-y-0.5">
              {summary.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          </Alert>
        )}
      </div>

      <div ref={stacksRef}>
        <PillGroup
          legend="Supported stacks"
          options={FREELANCER_STACKS}
          value={supportedStacks}
          min={1}
          max={7}
          hint="Each stack maps to a CodeBridge Docker workspace template"
          onChange={(next) => {
            setSupportedStacks(next);
            onValuesChange(currentData({ supportedStacks: next }));
            if (errors.supportedStacks) setErrors((prev) => ({ ...prev, supportedStacks: "" }));
          }}
          error={errors.supportedStacks || undefined}
        />
      </div>

      <div className="space-y-2.5 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="add-skill-input" className="text-sm font-medium text-text">
            Skills
          </label>
          <span className="text-xs text-text-muted shrink-0">
            {skills.length}/12 skills (3–12 required)
          </span>
        </div>

        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 pl-3 pr-1.5 py-1 text-xs font-medium text-text"
              >
                <span>{skill}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(skill)}
                  aria-label={`Remove ${skill}`}
                  className="rounded-full p-0.5 text-text-muted hover:bg-primary/20 hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            ref={skillInputRef}
            id="add-skill-input"
            type="text"
            placeholder="Add skill (e.g. FastAPI)"
            value={skillInput}
            maxLength={24}
            disabled={skills.length >= 12}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={handleSkillKeyDown}
            aria-invalid={Boolean(errors.skills) || undefined}
            className={[
              "min-w-0 flex-1 rounded-md border bg-bg px-3.5 py-2 text-sm text-text placeholder:text-text-muted/70",
              "transition-colors duration-fast",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
              errors.skills
                ? "border-danger focus-visible:outline-danger"
                : "border-border hover:border-text-muted focus:border-primary",
            ].join(" ")}
          />
          <Button
            variant="secondary"
            onClick={() => handleAddSkill()}
            disabled={skills.length >= 12 || !skillInput.trim()}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add</span>
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {SKILL_SUGGESTIONS.map((suggestion) => {
            const added = lowerSkills.has(suggestion.toLowerCase());
            const disabled = added || skills.length >= 12;
            return (
              <button
                key={suggestion}
                type="button"
                disabled={disabled}
                onClick={() => handleAddSkill(suggestion)}
                className={[
                  "rounded-full border px-2.5 py-1 text-xs transition-colors duration-fast",
                  added
                    ? "border-primary/40 bg-primary/10 text-primary cursor-default"
                    : skills.length >= 12
                      ? "border-border bg-bg text-text-muted opacity-50 cursor-not-allowed"
                      : "border-border bg-bg text-text-muted hover:border-text-muted hover:text-text cursor-pointer",
                ].join(" ")}
              >
                {added ? `✓ ${suggestion}` : `+ ${suggestion}`}
              </button>
            );
          })}
        </div>

        <div className="min-h-[1.25rem]">
          {errors.skills && (
            <p role="alert" className="flex items-center gap-1.5 text-xs text-danger">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{errors.skills}</span>
            </p>
          )}
        </div>
      </div>

      <div ref={specialtiesRef}>
        <PillGroup
          legend="Debugging specialties"
          options={SPECIALTIES}
          value={debuggingSpecialties}
          min={1}
          max={6}
          onChange={(next) => {
            setDebuggingSpecialties(next);
            onValuesChange(currentData({ debuggingSpecialties: next }));
            if (errors.debuggingSpecialties) {
              setErrors((prev) => ({ ...prev, debuggingSpecialties: "" }));
            }
          }}
          error={errors.debuggingSpecialties || undefined}
        />
      </div>

      <WizardNav
        showBack
        onBack={() => onBack(currentData())}
        submitLabel="Complete setup"
        loading={isSubmitting}
        submitDisabled={isSubmitting}
      />
    </form>
  );
}

export interface FreelancerStep3Props extends BaseFreelancerStepProps {
  onSubmitProfile: (data: FreelancerStep3Data) => void;
  isSubmitting: boolean;
}

export function FreelancerStep3({
  initialValues,
  onValuesChange,
  onBack,
  onSubmitProfile,
  isSubmitting,
  externalErrors,
  focusField,
}: FreelancerStep3Props) {
  const [availability, setAvailability] = useState(initialValues.availability ?? "");
  const [minBudgetRaw, setMinBudgetRaw] = useState(
    initialValues.minBudget !== undefined ? String(initialValues.minBudget) : "1500"
  );
  const [acceptsIsolatedWorkspace, setAcceptsIsolatedWorkspace] = useState(
    Boolean(initialValues.acceptsIsolatedWorkspace)
  );
  const [acceptsTestGate, setAcceptsTestGate] = useState(Boolean(initialValues.acceptsTestGate));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string[]>([]);

  const availabilityRef = useRef<HTMLFieldSetElement>(null);
  const minBudgetRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLInputElement>(null);
  const testGateRef = useRef<HTMLInputElement>(null);

  const parsedBudget = Number(minBudgetRaw);

  const currentData = (overrides?: Partial<FreelancerDraftData>): FreelancerDraftData => ({
    availability,
    minBudget: Number.isFinite(parsedBudget) ? parsedBudget : undefined,
    acceptsIsolatedWorkspace: acceptsIsolatedWorkspace ? true : undefined,
    acceptsTestGate: acceptsTestGate ? true : undefined,
    ...overrides,
  });

  useEffect(() => {
    if (initialValues.minBudget === undefined) {
      onValuesChange({ minBudget: 1500 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focusByField = (field: string) => {
    if (field === "availability") {
      availabilityRef.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
    } else if (field === "minBudget") {
      minBudgetRef.current?.focus();
    } else if (field === "acceptsIsolatedWorkspace") {
      workspaceRef.current?.focus();
    } else if (field === "acceptsTestGate") {
      testGateRef.current?.focus();
    }
  };

  useEffect(() => {
    if (externalErrors && Object.keys(externalErrors).length > 0) {
      setErrors(externalErrors);
      setSummary(Object.values(externalErrors));
    }
  }, [externalErrors]);

  useEffect(() => {
    if (focusField) {
      focusByField(focusField);
    }
  }, [focusField]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !acceptsIsolatedWorkspace || !acceptsTestGate) return;

    const parsed = freelancerStep3Schema.safeParse({
      availability,
      minBudget: Number(minBudgetRaw),
      acceptsIsolatedWorkspace,
      acceptsTestGate,
    });

    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      const nextSummary: string[] = [];
      let firstKey: string | null = null;
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        const msg =
          key === "availability"
            ? "Select your availability."
            : key === "minBudget"
              ? "Minimum budget must be a whole number between ₹500 and ₹1,00,000."
              : issue.message;
        if (key && !nextErrors[key]) {
          nextErrors[key] = msg;
          nextSummary.push(msg);
          if (!firstKey) firstKey = key;
        }
      }
      setErrors(nextErrors);
      setSummary(nextSummary);
      if (firstKey) focusByField(firstKey);
      return;
    }

    setErrors({});
    setSummary([]);
    onSubmitProfile(parsed.data);
  };

  const pledgesAccepted = acceptsIsolatedWorkspace && acceptsTestGate;

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <StepHeading
        stepKey="freelancer-3"
        title="Availability and pledge"
        subtitle="Set your task floor and confirm CodeBridge's isolated workspace rules."
      />

      <div aria-live="polite">
        {summary.length > 0 && (
          <Alert variant="error" title="Please fix the following">
            <ul className="list-disc pl-4 space-y-0.5">
              {summary.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          </Alert>
        )}
      </div>

      <fieldset ref={availabilityRef} className="space-y-2.5 min-w-0">
        <legend className="text-sm font-medium text-text">Availability</legend>
        <div className="grid gap-2.5">
          {AVAILABILITY_OPTIONS.map((opt) => (
            <OptionCard
              key={opt.value}
              name="availability"
              value={opt.value}
              checked={availability === opt.value}
              onChange={(val) => {
                setAvailability(val);
                onValuesChange(currentData({ availability: val }));
                setErrors((prev) => ({ ...prev, availability: "" }));
              }}
              label={opt.label}
            />
          ))}
        </div>
        {errors.availability && (
          <p role="alert" className="text-xs text-danger">
            {errors.availability}
          </p>
        )}
      </fieldset>

      <NumberField
        ref={minBudgetRef}
        label="Minimum task budget"
        name="minBudget"
        prefix="₹"
        min={500}
        max={100000}
        step={100}
        value={minBudgetRaw}
        hint="Tasks below this budget are hidden from your recommendations"
        onChange={(e) => {
          const val = e.target.value;
          setMinBudgetRaw(val);
          const num = Number(val);
          onValuesChange(currentData({ minBudget: val && Number.isFinite(num) ? num : undefined }));
          if (errors.minBudget) setErrors((prev) => ({ ...prev, minBudget: "" }));
        }}
        error={errors.minBudget || undefined}
      />

      <div className="space-y-2">
        <CheckboxRow
          ref={workspaceRef}
          label="I understand all work happens inside isolated Docker workspaces with controlled read-only repository access."
          checked={acceptsIsolatedWorkspace}
          onChange={(e) => {
            const checked = e.target.checked;
            setAcceptsIsolatedWorkspace(checked);
            onValuesChange(currentData({ acceptsIsolatedWorkspace: checked ? true : undefined }));
            if (errors.acceptsIsolatedWorkspace) {
              setErrors((prev) => ({ ...prev, acceptsIsolatedWorkspace: "" }));
            }
          }}
          error={errors.acceptsIsolatedWorkspace || undefined}
        />

        <CheckboxRow
          ref={testGateRef}
          label="I understand submissions must pass the required automated test checks before owner review and escrow release."
          checked={acceptsTestGate}
          onChange={(e) => {
            const checked = e.target.checked;
            setAcceptsTestGate(checked);
            onValuesChange(currentData({ acceptsTestGate: checked ? true : undefined }));
            if (errors.acceptsTestGate) {
              setErrors((prev) => ({ ...prev, acceptsTestGate: "" }));
            }
          }}
          error={errors.acceptsTestGate || undefined}
        />
      </div>

      <WizardNav
        showBack
        onBack={() => onBack(currentData())}
        submitLabel="Launch developer profile"
        loading={isSubmitting}
        submitDisabled={!pledgesAccepted}
      />
    </form>
  );
}
