import React from 'react';
import { FileSearch, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/button';

export interface AnalyzeBarProps {
  hasBrief: boolean;
  canRescan: boolean;
  isAnalyzing: boolean;
  isFormValid: boolean;
  isRepoConnected: boolean;
  onAnalyze: () => void;
  statusText?: string | null;
}

export const AnalyzeBar: React.FC<AnalyzeBarProps> = ({
  hasBrief,
  canRescan,
  isAnalyzing,
  isFormValid,
  isRepoConnected,
  onAnalyze,
  statusText,
}) => {
  const isScanDisabled = isAnalyzing
    ? true
    : hasBrief
    ? !canRescan
    : !isFormValid || !isRepoConnected;

  const getHelperText = (): string | null => {
    if (statusText) return statusText;
    if (isAnalyzing) return 'Analysis in progress…';
    if (!isRepoConnected) return 'Connect repository above to enable analysis.';
    if (!isFormValid) return 'Complete the required fields first.';
    if (hasBrief && !canRescan) return 'No changes since the last scan.';
    return null;
  };

  const helperText = getHelperText();

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onAnalyze}
          disabled={isScanDisabled}
          className="font-medium"
        >
          {hasBrief ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 text-primary" strokeWidth={1.5} />
              Re-scan repo
            </>
          ) : (
            <>
              <FileSearch className="w-4 h-4 mr-2 text-primary" strokeWidth={1.5} />
              Analyze repo & generate brief
            </>
          )}
        </Button>
      </div>
      {helperText && (
        <p className="text-xs text-text-muted transition-colors">{helperText}</p>
      )}
    </div>
  );
};
