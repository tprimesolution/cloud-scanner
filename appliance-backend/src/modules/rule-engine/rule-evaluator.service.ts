import { Injectable } from "@nestjs/common";
import type { NormalizedResource } from "../resource-collection/interfaces/fetcher.interface";
import { PluginLoaderService } from "./plugin-loader.service";

export interface Violation {
  resourceId: string;
  resourceType: string;
  ruleCode: string;
  severity: string;
  message: string;
  controlIds: string[];
  remediation: string;
  rawResource: unknown;
}

@Injectable()
export class RuleEvaluatorService {
  constructor(private readonly pluginLoader: PluginLoaderService) {}

  evaluate(resource: NormalizedResource): Violation[] {
    const plugins = this.pluginLoader.getPlugins(resource.type);
    const violations: Violation[] = [];

    for (const plugin of plugins) {
      const result = plugin.evaluate(resource);
      if (!result.passed) {
        violations.push({
          resourceId: resource.id,
          resourceType: resource.type,
          ruleCode: plugin.code,
          severity: plugin.severity,
          message: result.message ?? `${plugin.name} failed`,
          controlIds: plugin.controlIds,
          remediation: plugin.remediation,
          rawResource: resource.metadata,
        });
      }
    }

    return violations;
  }
}
