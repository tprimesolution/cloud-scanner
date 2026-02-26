import { Injectable } from "@nestjs/common";

export type FindingStatus = "open" | "acknowledged" | "resolved" | "suppressed";

@Injectable()
export class LifecycleService {
  validTransitions: Record<FindingStatus, FindingStatus[]> = {
    open: ["acknowledged", "resolved", "suppressed"],
    acknowledged: ["open", "resolved", "suppressed"],
    resolved: ["open"],
    suppressed: ["open"],
  };

  canTransition(from: FindingStatus, to: FindingStatus): boolean {
    return this.validTransitions[from]?.includes(to) ?? false;
  }
}
