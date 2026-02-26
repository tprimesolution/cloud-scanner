export type ScanJobType = "full" | "incremental" | "on_demand";

export type ScanJobStatus = "pending" | "running" | "completed" | "failed";

export interface ScanJobResult {
  jobId: string;
  status: ScanJobStatus;
  resourceCount: number;
  findingCount: number;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
}
