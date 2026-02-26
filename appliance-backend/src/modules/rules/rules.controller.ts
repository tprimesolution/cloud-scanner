import { Controller, Get } from "@nestjs/common";
import { RulesService } from "./rules.service";

@Controller("rules")
export class RulesController {
  constructor(private readonly rules: RulesService) {}

  @Get()
  listRules() {
    return this.rules.listRules();
  }
}
