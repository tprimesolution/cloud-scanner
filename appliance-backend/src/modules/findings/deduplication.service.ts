import { Injectable } from "@nestjs/common";

/**
 * Deduplication key: (resourceId, ruleId)
 * Findings are upserted - update lastSeenAt if exists.
 */
@Injectable()
export class DeduplicationService {
  getDedupeKey(resourceId: string, ruleId: string): string {
    return `${resourceId}::${ruleId}`;
  }
}
