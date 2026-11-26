import { Button } from "../../../components/ui/button";

export interface WizardNavProps {
  onBack?: () => void;
  showBack?: boolean;
  submitLabel: string;
  loading?: boolean;
  submitDisabled?: boolean;
}

export function WizardNav({
  onBack,
  showBack = false,
  submitLabel,
  loading = false,
  submitDisabled = false,
}: WizardNavProps) {
  return (
    <div className="flex items-center justify-between gap-3 pt-4 border-t border-border mt-6">
      {showBack ? (
        <Button variant="secondary" onClick={onBack} disabled={loading}>
          Back
        </Button>
      ) : (
        <span aria-hidden="true" />
      )}
      <Button
        type="submit"
        variant="primary"
        loading={loading}
        disabled={submitDisabled || loading}
      >
        {loading ? "Saving…" : submitLabel}
      </Button>
    </div>
  );
}
