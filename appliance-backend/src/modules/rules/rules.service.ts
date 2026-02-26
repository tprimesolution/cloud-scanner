import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";

@Injectable()
export class RulesService {
  constructor(private readonly prisma: PrismaService) {}

  async listRules() {
    return this.prisma.complianceRule.findMany({
      where: { enabled: true },
      orderBy: { resourceType: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        resourceType: true,
        severity: true,
        controlIds: true,
      },
    });
  }
}
