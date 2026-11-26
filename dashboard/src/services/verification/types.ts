export type {
  AutomatedRun,
  DockerTestResult,
  DiffFile,
} from '../../features/review/types';

export interface CheckLogResponse {
  lines: string[];
  truncated: boolean;
}
