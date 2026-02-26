import { Module } from "@nestjs/common";
import { RuleEngineService } from "./rule-engine.service";
import { RuleEvaluatorService } from "./rule-evaluator.service";
import { PluginLoaderService } from "./plugin-loader.service";

@Module({
  providers: [RuleEngineService, RuleEvaluatorService, PluginLoaderService],
  exports: [RuleEngineService, PluginLoaderService],
})
export class RuleEngineModule {}
