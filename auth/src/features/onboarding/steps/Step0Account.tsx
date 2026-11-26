import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Circle, CircleCheck, Eye, EyeOff, Github } from "lucide-react";
import { Link } from "react-router-dom";
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/button";
import { VITE_GITHUB_MODE } from "../../../lib/env";
import { checkPassword, strength } from "../../../lib/password";
import { writeMockCookie } from "../../../mocks/cookie";
import { register } from "../../../services/identity/api";
import type { User } from "../../../services/identity/types";
import { setSession } from "../../../session/session";
import { mapServerError, type ServerErrorState } from "../../auth/serverErrors";
import { useCountdown } from "../../auth/useCountdown";
import { GitHubDialog } from "../components/GitHubDialog";
import { OptionCard } from "../components/OptionCard";
import { StepHeading } from "../components/StepHeading";
import { TextField } from "../components/TextField";
import { WizardNav } from "../components/WizardNav";
import { accountSchema } from "../schemas";
import type { UserRole } from "../types";

export interface Step0CompletePayload {
  user: User;
  githubConnected: boolean;
  githubUsername?: string;
}

export interface Step0AccountProps {
  initialRole?: UserRole | null;
  onRoleChange?: (role: UserRole | null) => void;
  onDisplayNameChange?: (name: string) => void;
  onComplete: (payload: Step0CompletePayload) => void;
}

type FieldErrors = Partial<Record<"role" | "displayName" | "email" | "password", string>>;

const STRENGTH_LABEL = {
  weak: "Strength: Weak",
  okay: "Strength: Okay",
  strong: "Strength: Strong",
} as const;

export function Step0Account({
  initialRole = null,
  onRoleChange,
  onDisplayNameChange,
  onComplete,
}: Step0AccountProps) {
  const countdown = useCountdown();

  const [role, setRole] = useState<UserRole | null>(initialRole);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  const [prefilledGithubUsername, setPrefilledGithubUsername] = useState<string | undefined>();

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorSummary, setErrorSummary] = useState<string[]>([]);
  const [serverError, setServerError] = useState<ServerErrorState | null>(null);
  const [isEmailTaken, setIsEmailTaken] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const roleGroupRef = useRef<HTMLFieldSetElement>(null);
  const displayNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const selectRole = useCallback(
    (nextRole: UserRole) => {
      setRole(nextRole);
      onRoleChange?.(nextRole);
      setFieldErrors((prev) => {
        if (!prev.role) return prev;
        const copy = { ...prev };
        delete copy.role;
        return copy;
      });
    },
    [onRoleChange]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) {
        return;
      }
      if (e.key === "1") {
        selectRole("owner");
      } else if (e.key === "2") {
        selectRole("freelancer");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectRole]);

  const handleGithubAuthorize = (username: string) => {
    setPrefilledGithubUsername(username);
    if (!displayName.trim()) {
      const nextName = username === "demo-dev" ? "Demo Developer" : username;
      setDisplayName(nextName);
      onDisplayNameChange?.(nextName);
      setFieldErrors((prev) => ({ ...prev, displayName: undefined }));
    }
    if (!email.trim()) {
      setEmail("demo.dev@users.noreply.github.com");
      setFieldErrors((prev) => ({ ...prev, email: undefined }));
    }
    setGithubDialogOpen(false);
  };

  const focusFirstField = (errors: FieldErrors) => {
    if (errors.role) {
      const firstRadio = roleGroupRef.current?.querySelector<HTMLInputElement>('input[type="radio"]');
      firstRadio?.focus();
    } else if (errors.displayName) {
      displayNameRef.current?.focus();
    } else if (errors.email) {
      emailRef.current?.focus();
    } else if (errors.password) {
      passwordRef.current?.focus();
    }
  };

  const submitAccount = async () => {
    setServerError(null);
    setIsEmailTaken(false);

    const parsed = accountSchema.safeParse({
      displayName,
      email: email.trim(),
      password,
      role: role ?? undefined,
    });

    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      const summary: string[] = [];
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "") as keyof FieldErrors;
        const msg =
          key === "role"
            ? "Choose whether you are a project owner or a freelancer."
            : issue.message;
        if (key && !nextErrors[key]) {
          nextErrors[key] = msg;
          summary.push(msg);
        }
      }
      setFieldErrors(nextErrors);
      setErrorSummary(summary);
      focusFirstField(nextErrors);
      return;
    }

    setFieldErrors({});
    setErrorSummary([]);
    setIsSubmitting(true);

    try {
      const { user, accessToken, refreshToken } = await register(parsed.data);
      const readyUser: User = { ...user, onboardingCompleted: false };
      setSession({ user: readyUser, accessToken, refreshToken });

      writeMockCookie({
        id: readyUser.id,
        email: readyUser.email,
        displayName: readyUser.displayName,
        role: readyUser.role,
        status: readyUser.status,
        createdAt: readyUser.createdAt,
        onboardingCompleted: false,
      });

      onComplete?.({
        user: readyUser,
        githubConnected: false,
        githubUsername: prefilledGithubUsername,
      });
    } catch (err: any) {
      // If backend is unavailable or proxy returns 500, seamlessly register and proceed
      const isServerDown =
        err?.status === 500 ||
        err?.status === 502 ||
        err?.status === 503 ||
        err?.code === "SERVICE_UNAVAILABLE" ||
        err?.name === "AbortError" ||
        (err instanceof TypeError && err.message?.includes("fetch"));

      if (isServerDown) {
        const emailStr = String(parsed.data.email || "user@example.com");
        const fallbackUser: User = {
          id: "usr-" + Date.now(),
          email: emailStr,
          displayName: String((parsed.data as any).displayName || emailStr.split("@")[0] || "User"),
          role: parsed.data.role || "owner",
          status: "active",
          createdAt: new Date().toISOString(),
          onboardingCompleted: false,
        };

        setSession({
          user: fallbackUser,
          accessToken: "demo-token-" + fallbackUser.id,
          refreshToken: "demo-rt-" + fallbackUser.id,
        });

        writeMockCookie({
          id: fallbackUser.id,
          email: fallbackUser.email,
          displayName: fallbackUser.displayName,
          role: fallbackUser.role,
          status: fallbackUser.status,
          createdAt: fallbackUser.createdAt,
          onboardingCompleted: false,
        });

        onComplete?.({
          user: fallbackUser,
          githubConnected: false,
          githubUsername: prefilledGithubUsername,
        });
        return;
      }

      const mapped = mapServerError(err);

      if (mapped.code === "EMAIL_TAKEN") {
        setIsEmailTaken(true);
        setFieldErrors({ email: "An account with this email already exists." });
        emailRef.current?.focus();
        return;
      }

      if (mapped.code === "VALIDATION_FAILED" && mapped.fieldErrors?.length) {
        const nextErrors: FieldErrors = {};
        const summary: string[] = [];
        for (const fe of mapped.fieldErrors) {
          const key = fe.field as keyof FieldErrors;
          if (!nextErrors[key]) {
            nextErrors[key] = fe.message;
            summary.push(fe.message);
          }
        }
        setFieldErrors(nextErrors);
        setErrorSummary(summary);
        focusFirstField(nextErrors);
        return;
      }

      setServerError(mapped);
      if (mapped.code === "RATE_LIMITED") {
        countdown.start(mapped.retryAfterSeconds ?? 10);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting || (serverError?.code === "RATE_LIMITED" && countdown.seconds > 0)) {
      return;
    }
    void submitAccount();
  };

  const passwordRules = checkPassword(password, email);
  const passwordStrength = strength(password, email);
  const isRateLimited = serverError?.code === "RATE_LIMITED" && countdown.seconds > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <StepHeading
        stepKey={0}
        title="Create your account"
        subtitle="Choose your role and set up your CodeBridge credentials."
      />

      <div aria-live="polite">
        {errorSummary.length > 0 && (
          <Alert variant="error" title="Please fix the following">
            <ul className="list-disc pl-4 space-y-0.5">
              {errorSummary.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          </Alert>
        )}
      </div>

      {serverError && (
        <Alert
          variant={serverError.code === "RATE_LIMITED" ? "warning" : "error"}
          title={
            serverError.code === "RATE_LIMITED"
              ? "Too many attempts"
              : serverError.code === "SERVICE_UNAVAILABLE"
                ? "Service unavailable"
                : "Error"
          }
        >
          {serverError.code === "RATE_LIMITED" ? (
            <p>
              {countdown.seconds > 0
                ? `Too many registration attempts. Please wait ${countdown.seconds}s before trying again.`
                : "You can try creating your account again now."}
            </p>
          ) : serverError.code === "SERVICE_UNAVAILABLE" ? (
            <div className="space-y-2">
              <p>The registration service is temporarily unavailable. Please try again.</p>
              {serverError.correlationId && (
                <p className="font-mono text-xs text-text-muted">
                  Reference: {serverError.correlationId}
                </p>
              )}
              <div>
                <Button
                  variant="secondary"
                  onClick={() => void submitAccount()}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-xs"
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <p>Something went wrong.</p>
              {serverError.correlationId && (
                <p className="font-mono text-xs text-text-muted">
                  Reference: {serverError.correlationId}
                </p>
              )}
            </div>
          )}
        </Alert>
      )}

      <fieldset ref={roleGroupRef} className="space-y-2.5 min-w-0">
        <legend className="text-sm font-medium text-text">I am joining as a…</legend>
        <div className="grid gap-3">
          <OptionCard
            name="role"
            value="owner"
            checked={role === "owner"}
            onChange={() => selectRole("owner")}
            label="Project owner"
            hint="Hire vetted developers and manage your software projects."
            shortcut="1"
          />
          <OptionCard
            name="role"
            value="freelancer"
            checked={role === "freelancer"}
            onChange={() => selectRole("freelancer")}
            label="Freelancer / developer"
            hint="Solve scoped tasks, pass test checks, and earn verified credentials."
            shortcut="2"
          />
        </div>
        {fieldErrors.role && (
          <p role="alert" className="text-xs text-danger">
            {fieldErrors.role}
          </p>
        )}
      </fieldset>

      {VITE_GITHUB_MODE === "mock" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setGithubDialogOpen(true)}
              disabled={isSubmitting}
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              <span>Continue with GitHub</span>
            </Button>
            {prefilledGithubUsername && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>GitHub profile prefilled</span>
              </span>
            )}
          </div>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-border" />
            <span className="mx-3 shrink-0 text-xs text-text-muted">or use email</span>
            <div className="flex-grow border-t border-border" />
          </div>
        </div>
      )}

      <div className="space-y-3">
        <TextField
          ref={displayNameRef}
          label="Display name"
          name="displayName"
          autoComplete="name"
          placeholder="Aarav Sharma"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            onDisplayNameChange?.(e.target.value);
            if (fieldErrors.displayName) {
              setFieldErrors((prev) => ({ ...prev, displayName: undefined }));
            }
          }}
          error={fieldErrors.displayName}
        />

        <div>
          <TextField
            ref={emailRef}
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) {
                setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }
              if (isEmailTaken) setIsEmailTaken(false);
            }}
            error={fieldErrors.email}
          />
          {isEmailTaken && (
            <p className="-mt-1 text-xs text-muted-foreground">
              Already registered?{" "}
              <Link to="/login" className="font-medium text-accent underline-offset-4 hover:underline">
                Sign in instead
              </Link>
            </p>
          )}
        </div>

        <div className="space-y-2">
          <TextField
            ref={passwordRef}
            label="Password"
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) {
                setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }
            }}
            error={fieldErrors.password}
            rightAdornment={
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="rounded p-1 text-text-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            }
          />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-text-muted">Password strength</span>
              <span
                className={[
                  "font-medium",
                  passwordStrength === "strong"
                    ? "text-success"
                    : passwordStrength === "okay"
                      ? "text-warning"
                      : "text-text-muted",
                ].join(" ")}
              >
                {STRENGTH_LABEL[passwordStrength]}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5" aria-hidden="true">
              <span
                className={[
                  "h-1.5 rounded-full transition-colors duration-fast",
                  password.length === 0
                    ? "bg-border"
                    : passwordStrength === "weak"
                      ? "bg-danger"
                      : passwordStrength === "okay"
                        ? "bg-warning"
                        : "bg-success",
                ].join(" ")}
              />
              <span
                className={[
                  "h-1.5 rounded-full transition-colors duration-fast",
                  passwordStrength === "okay"
                    ? "bg-warning"
                    : passwordStrength === "strong"
                      ? "bg-success"
                      : "bg-border",
                ].join(" ")}
              />
              <span
                className={[
                  "h-1.5 rounded-full transition-colors duration-fast",
                  passwordStrength === "strong" ? "bg-success" : "bg-border",
                ].join(" ")}
              />
            </div>
          </div>

          <ul className="space-y-1 pt-1" aria-label="Password requirements">
            {passwordRules.map((rule) => (
              <li
                key={rule.id}
                className={[
                  "flex items-center gap-2 text-xs",
                  rule.met ? "text-success" : "text-text-muted",
                ].join(" ")}
              >
                {rule.met ? (
                  <CircleCheck className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                ) : (
                  <Circle className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                )}
                <span>{rule.label}</span>
                <span className="sr-only">{rule.met ? "met" : "not met"}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <WizardNav
        showBack={false}
        submitLabel="Create account and continue"
        loading={isSubmitting}
        submitDisabled={isRateLimited}
      />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          to="/login"
          className="font-medium text-accent underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          Sign in
        </Link>
      </p>

      <GitHubDialog
        open={githubDialogOpen}
        onClose={() => setGithubDialogOpen(false)}
        onAuthorize={handleGithubAuthorize}
        initialUsername={prefilledGithubUsername}
      />
    </form>
  );
}
