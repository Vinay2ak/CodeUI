import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { BootstrapResult } from "../../app/bootstrap";
import { redirectToDashboard } from "../../app/redirect";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/button";
import { Spinner } from "../../components/ui/Spinner";
import { VITE_DASHBOARD_URL } from "../../lib/env";
import { logout, saveOwnerProfile } from "../../services/identity/api";
import type { OwnerProfile, User } from "../../services/identity/types";
import { saveFreelancerProfile } from "../../services/talent/api";
import type { FreelancerProfilePayload } from "../../services/talent/types";
import { broadcastLogout, clearSession, getSession } from "../../session/session";
import { mapServerError, type ServerErrorState } from "../auth/serverErrors";
import { WizardLayout } from "./components/WizardLayout";
import { clearDraft, saveDraft } from "./draft";
import { FREELANCER_FIELD_STEP, OWNER_FIELD_STEP } from "./schemas";
import {
  FreelancerStep1,
  FreelancerStep2,
  type FreelancerDraftData,
} from "./steps/FreelancerSteps";
import {
  OwnerStep1,
  type OwnerDraftData,
} from "./steps/OwnerSteps";
import { Step0Account, type Step0CompletePayload } from "./steps/Step0Account";
import type {
  FreelancerStep1Data,
  FreelancerStep2Data,
  OnboardingDraft,
  OwnerStep1Data,
  UserRole,
} from "./types";

export interface RegisterPageProps {
  bootstrap?: BootstrapResult | { status: "loading" };
}

function parseQueryRole(raw: string | null): UserRole | null {
  if (raw === "owner" || raw === "freelancer") return raw;
  return null;
}

export function RegisterPage({ bootstrap }: RegisterPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isResume = searchParams.get("resume") === "1";
  const queryRole = parseQueryRole(searchParams.get("role"));

  const [initialized, setInitialized] = useState(!isResume);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(queryRole);
  const [currentStep, setCurrentStep] = useState<number>(0);

  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUsername, setGithubUsername] = useState<string | undefined>();

  const [ownerData, setOwnerData] = useState<OwnerDraftData>({});
  const [liveOwnerPatch, setLiveOwnerPatch] = useState<OwnerDraftData>({});

  const [freelancerData, setFreelancerData] = useState<FreelancerDraftData>({});
  const [liveFreelancerPatch, setLiveFreelancerPatch] = useState<FreelancerDraftData>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<ServerErrorState | null>(null);
  const [externalErrors, setExternalErrors] = useState<Record<string, string>>({});
  const [focusField, setFocusField] = useState<string | null>(null);
  const [successRole, setSuccessRole] = useState<UserRole | null>(null);

  const lastSubmitPayloadRef = useRef<
    | { kind: "owner"; payload: OwnerProfile }
    | { kind: "freelancer"; payload: FreelancerProfilePayload }
    | null
  >(null);
  const redirectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (bootstrap?.status === "loading") {
      return;
    }

    let activeUser: User | null = null;
    if (bootstrap?.status === "authenticated") {
      activeUser = bootstrap.user;
    } else if (!bootstrap) {
      activeUser = getSession()?.user ?? null;
    }

    if (activeUser && activeUser.onboardingCompleted) {
      redirectToDashboard(activeUser.role, { user: activeUser });
      return;
    } else if (activeUser) {
      setCurrentUser(activeUser);
      setRole(activeUser.role === "freelancer" ? "freelancer" : "owner");
      setCurrentStep(1);
    } else {
      setCurrentUser(null);
      setRole(queryRole);
      setCurrentStep(0);
    }

    setInitialized(true);
  }, [bootstrap, queryRole]);

  const persistDraft = useCallback(
    (nextStep: number, nextOwner: OwnerDraftData, nextFreelancer: FreelancerDraftData) => {
      if (!currentUser || !role) return;
      const draft: OnboardingDraft = {
        userId: currentUser.id,
        role,
        step: nextStep,
        ...(role === "owner" ? { owner: nextOwner } : { freelancer: nextFreelancer }),
      };
      saveDraft(draft);
    },
    [currentUser, role]
  );

  const handleStep0Complete = ({ user, githubConnected: ghConn, githubUsername: ghUser }: Step0CompletePayload) => {
    const userRole: UserRole = user.role === "freelancer" ? "freelancer" : "owner";
    setCurrentUser(user);
    setRole(userRole);
    setGithubConnected(ghConn);
    if (ghUser) {
      setGithubUsername(ghUser);
      if (userRole === "freelancer") {
        setFreelancerData((prev) => ({ ...prev, githubUsername: ghUser }));
      }
    }
    setCurrentStep(1);
  };

  const handleSignOut = async () => {
    try {
      await logout();
    } catch {
      // ignore logout network errors
    }
    clearSession();
    clearDraft();
    broadcastLogout();
    navigate("/login", { replace: true });
  };

  const handleStepClick = (targetStep: number) => {
    if (targetStep < 1 || targetStep >= currentStep) return;
    if (role === "owner") {
      const merged = { ...ownerData, ...liveOwnerPatch };
      setOwnerData(merged);
      setLiveOwnerPatch({});
      persistDraft(targetStep, merged, freelancerData);
    } else if (role === "freelancer") {
      const merged = { ...freelancerData, ...liveFreelancerPatch };
      setFreelancerData(merged);
      setLiveFreelancerPatch({});
      persistDraft(targetStep, ownerData, merged);
    }
    setExternalErrors({});
    setFocusField(null);
    setSubmitError(null);
    setCurrentStep(targetStep);
  };

  const handleValidationErrorsFromServer = (
    fieldErrors: { field: string; message: string }[],
    fieldStepMap: Record<string, number>
  ) => {
    let earliestStep = currentStep;
    const mappedByStep: Record<number, Record<string, string>> = {};
    const firstFieldByStep: Record<number, string> = {};

    for (const fe of fieldErrors) {
      const step = fieldStepMap[fe.field] ?? currentStep;
      if (step < earliestStep) {
        earliestStep = step;
      }
      if (!mappedByStep[step]) {
        mappedByStep[step] = {};
      }
      if (!mappedByStep[step][fe.field]) {
        mappedByStep[step][fe.field] = fe.message;
      }
      if (!firstFieldByStep[step]) {
        firstFieldByStep[step] = fe.field;
      }
    }

    setExternalErrors(mappedByStep[earliestStep] ?? {});
    setFocusField(firstFieldByStep[earliestStep] ?? null);
    setCurrentStep(earliestStep);
  };

  const submitOwner = async (payload: OwnerProfile) => {
    lastSubmitPayloadRef.current = { kind: "owner", payload };
    setIsSubmitting(true);
    setSubmitError(null);
    setExternalErrors({});
    setFocusField(null);

    try {
      await saveOwnerProfile(payload);
      clearDraft();
      setSuccessRole("owner");
      redirectTimerRef.current = window.setTimeout(() => {
        redirectToDashboard("owner", { user: currentUser ?? undefined });
      }, 800);
    } catch (err) {
      const mapped = mapServerError(err);
      setSubmitError(mapped);
      if (mapped.code === "VALIDATION_FAILED" && mapped.fieldErrors?.length) {
        handleValidationErrorsFromServer(mapped.fieldErrors, OWNER_FIELD_STEP);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitFreelancer = async (payload: FreelancerProfilePayload) => {
    lastSubmitPayloadRef.current = { kind: "freelancer", payload };
    setIsSubmitting(true);
    setSubmitError(null);
    setExternalErrors({});
    setFocusField(null);

    try {
      await saveFreelancerProfile(payload);
      clearDraft();
      setSuccessRole("freelancer");
      redirectTimerRef.current = window.setTimeout(() => {
        redirectToDashboard("freelancer", { user: currentUser ?? undefined });
      }, 800);
    } catch (err) {
      const mapped = mapServerError(err);
      setSubmitError(mapped);
      if (mapped.code === "VALIDATION_FAILED" && mapped.fieldErrors?.length) {
        handleValidationErrorsFromServer(mapped.fieldErrors, FREELANCER_FIELD_STEP);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetrySubmit = () => {
    const last = lastSubmitPayloadRef.current;
    if (!last) return;
    if (last.kind === "owner") {
      void submitOwner(last.payload);
    } else {
      void submitFreelancer(last.payload);
    }
  };

  if (isResume && (bootstrap?.status === "loading" || !initialized)) {
    return (
      <div className="min-h-screen bg-bg text-text flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border border-border bg-surface p-8 text-center space-y-4">
          <div className="flex justify-center">
            <Spinner size="lg" className="text-primary" />
          </div>
          <p className="text-sm font-medium text-text">Restoring your setup…</p>
          <div className="space-y-2 pt-2" aria-hidden="true">
            <div className="h-3 w-3/4 mx-auto rounded bg-surface-raised animate-pulse" />
            <div className="h-3 w-1/2 mx-auto rounded bg-surface-raised animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <WizardLayout
      role={role}
      currentStep={currentStep}
      onStepClick={handleStepClick}
      isSignedIn={Boolean(currentUser)}
      onSignOut={() => void handleSignOut()}
    >
      {successRole ? (
        <div aria-live="polite" className="space-y-4">
          <Alert variant="success" title="Setup complete">
            <div className="space-y-2">
              <p>Profile saved. Taking you to your dashboard…</p>
              <p>
                <a
                  href={`${VITE_DASHBOARD_URL}/${successRole}`}
                  className="font-semibold text-primary underline underline-offset-2"
                >
                  Continue to dashboard
                </a>
              </p>
            </div>
          </Alert>
        </div>
      ) : (
        <div className="space-y-4">
          {submitError && (
            <Alert
              variant="error"
              title={
                submitError.code === "VALIDATION_FAILED"
                  ? "Please review your details"
                  : submitError.code === "SERVICE_UNAVAILABLE"
                    ? "Service unavailable"
                    : "Could not save profile"
              }
            >
              {submitError.code === "SERVICE_UNAVAILABLE" ? (
                <div className="space-y-2">
                  <p>The service is temporarily unavailable. Your progress is saved locally.</p>
                  {submitError.correlationId && (
                    <p className="font-mono text-xs text-text-muted">
                      Reference: {submitError.correlationId}
                    </p>
                  )}
                  <div>
                    <Button
                      variant="secondary"
                      onClick={handleRetrySubmit}
                      disabled={isSubmitting}
                      className="px-3 py-1.5 text-xs"
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              ) : submitError.code === "VALIDATION_FAILED" ? (
                <p>Some fields need attention before we can finish your setup.</p>
              ) : (
                <div className="space-y-1">
                  <p>Something went wrong.</p>
                  {submitError.correlationId && (
                    <p className="font-mono text-xs text-text-muted">
                      Reference: {submitError.correlationId}
                    </p>
                  )}
                </div>
              )}
            </Alert>
          )}

          {currentStep === 0 && (
            <Step0Account
              initialRole={role}
              onRoleChange={(nextRole) => setRole(nextRole)}
              onComplete={handleStep0Complete}
            />
          )}

          {currentStep >= 1 && role === "owner" && (
            <OwnerStep1
              initialValues={ownerData}
              onValuesChange={(patch) => setLiveOwnerPatch(patch)}
              onBack={(current) => {
                const merged = { ...ownerData, ...current };
                setOwnerData(merged);
                setLiveOwnerPatch({});
                persistDraft(1, merged, freelancerData);
              }}
              onNext={(data: OwnerStep1Data) => {
                const merged = { ...ownerData, ...data };
                setOwnerData(merged);
                setLiveOwnerPatch({});
                persistDraft(1, merged, freelancerData);
                const fullPayload: OwnerProfile = {
                  ownerType: data.ownerType,
                  organizationName: data.organizationName,
                  roleTitle: data.roleTitle,
                  timezone: data.timezone,
                  primaryStack: ["REACT_TS"],
                  typicalBlocker: "HARD_BUG",
                  defaultBudgetRange: "FEATURE_INTEGRATION",
                  preferredVerificationMode: "AUTO_TESTS_AND_REVIEW",
                };
                void submitOwner(fullPayload);
              }}
              isSubmitting={isSubmitting}
              externalErrors={externalErrors}
              focusField={focusField}
            />
          )}

          {currentStep === 1 && role === "freelancer" && (
            <FreelancerStep1
              initialValues={freelancerData}
              onValuesChange={(patch) => setLiveFreelancerPatch(patch)}
              githubConnected={githubConnected}
              linkedGithubUsername={githubUsername}
              onGithubChange={(conn, uname) => {
                setGithubConnected(conn);
                setGithubUsername(uname);
              }}
              onBack={(current) => {
                const merged = { ...freelancerData, ...current };
                setFreelancerData(merged);
                setLiveFreelancerPatch({});
                persistDraft(1, ownerData, merged);
              }}
              onNext={(data: FreelancerStep1Data) => {
                const merged = { ...freelancerData, ...data };
                setFreelancerData(merged);
                setLiveFreelancerPatch({});
                setExternalErrors({});
                setFocusField(null);
                setSubmitError(null);
                persistDraft(2, ownerData, merged);
                setCurrentStep(2);
              }}
              externalErrors={externalErrors}
              focusField={focusField}
            />
          )}

          {currentStep === 2 && role === "freelancer" && (
            <FreelancerStep2
              initialValues={freelancerData}
              onValuesChange={(patch) => setLiveFreelancerPatch(patch)}
              onBack={(current) => {
                const merged = { ...freelancerData, ...current };
                setFreelancerData(merged);
                setLiveFreelancerPatch({});
                setExternalErrors({});
                setFocusField(null);
                persistDraft(1, ownerData, merged);
                setCurrentStep(1);
              }}
              onNext={(data: FreelancerStep2Data) => {
                const merged = { ...freelancerData, ...data };
                setFreelancerData(merged);
                setLiveFreelancerPatch({});
                setExternalErrors({});
                setFocusField(null);
                setSubmitError(null);
                persistDraft(2, ownerData, merged);
                const fullPayload: FreelancerProfilePayload = {
                  headline: merged.headline ?? "",
                  experience: merged.experience ?? "",
                  ...(merged.githubUsername ? { githubUsername: merged.githubUsername } : {}),
                  ...(merged.portfolioUrl ? { portfolioUrl: merged.portfolioUrl } : {}),
                  bio: merged.bio ?? "",
                  supportedStacks: merged.supportedStacks ?? [],
                  skills: merged.skills ?? [],
                  debuggingSpecialties: merged.debuggingSpecialties ?? [],
                  availability: "IMMEDIATE",
                  minBudget: 1500,
                  acceptsIsolatedWorkspace: true,
                  acceptsTestGate: true,
                };
                void submitFreelancer(fullPayload);
              }}
              isSubmitting={isSubmitting}
              externalErrors={externalErrors}
              focusField={focusField}
            />
          )}
        </div>
      )}
    </WizardLayout>
  );
}
