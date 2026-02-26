import { Injectable } from "@nestjs/common";
import type { NormalizedResource } from "../resource-collection/interfaces/fetcher.interface";
import { RuleEvaluatorService, type Violation } from "./rule-evaluator.service";

@Injectable()
export class RuleEngineService {
  constructor(private readonly evaluator: RuleEvaluatorService) {}

  evaluateResource(resource: NormalizedResource): Violation[] {
    return this.evaluator.evaluate(resource);
  }

  evaluateResources(resources: NormalizedResource[]): Violation[] {
    const all: Violation[] = [];
    for (const r of resources) {
      all.push(...this.evaluator.evaluate(r));
    }
    return all;
  }
}
