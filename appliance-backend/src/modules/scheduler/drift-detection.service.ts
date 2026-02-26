import { Injectable } from "@nestjs/common";

/**
 * Drift detection - compare last known config vs current.
 * Lightweight: uses last scan findings as baseline.
 */
@Injectable()
export class DriftDetectionService {
  // Placeholder - full implementation would compare resource snapshots
  async detectDrift(): Promise<{ drifted: boolean; details?: string[] }> {
    return { drifted: false };
  }
}
