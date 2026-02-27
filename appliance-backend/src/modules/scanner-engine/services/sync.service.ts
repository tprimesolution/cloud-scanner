import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../shared/prisma.service";
import { CheckLoaderService } from "../loaders/check-loader.service";
import { ComplianceParserService } from "../parsers/compliance-parser.service";

export interface SyncResult {
  checksCreated: number;
  checksUpdated: number;
  frameworksCreated: number;
  mappingsCreated: number;
}

@Injectable()
export class ScannerEngineSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly checkLoader: CheckLoaderService,
    private readonly complianceParser: ComplianceParserService,
  ) {}

  async syncAll(): Promise<SyncResult> {
    const result: SyncResult = {
      checksCreated: 0,
      checksUpdated: 0,
      frameworksCreated: 0,
      mappingsCreated: 0,
    };

    const checks = this.checkLoader.loadAllChecks();
    for (const c of checks) {
      const existing = await this.prisma.prowlerCheck.findUnique({
        where: { checkName: c.checkName },
      });
      const data = {
        provider: c.provider,
        service: c.service,
        checkName: c.checkName,
        severity: c.severity,
        description: c.description,
        risk: c.risk,
        remediation: c.remediation,
        metadata: c.metadata as object,
        enabled: true,
      };
      if (existing) {
        await this.prisma.prowlerCheck.update({
          where: { id: existing.id },
          data,
        });
        result.checksUpdated++;
      } else {
        await this.prisma.prowlerCheck.create({ data });
        result.checksCreated++;
      }
    }

    const frameworks = this.complianceParser.parseAll();
    for (const fw of frameworks) {
      const existing = await this.prisma.complianceFramework.findUnique({
        where: {
          provider_source: { provider: fw.provider, source: fw.source },
        },
      });
      const frameworkData = {
        provider: fw.provider,
        name: fw.frameworkName,
        framework: fw.framework,
        version: fw.version,
        source: fw.source,
      };
      let frameworkId: string;
      if (existing) {
        await this.prisma.complianceFramework.update({
          where: { id: existing.id },
          data: frameworkData,
        });
        frameworkId = existing.id;
      } else {
        const created = await this.prisma.complianceFramework.create({
          data: frameworkData,
        });
        frameworkId = created.id;
        result.frameworksCreated++;
      }

      for (const m of fw.mappings) {
        try {
          await this.prisma.complianceMapping.upsert({
            where: {
              frameworkId_controlId_checkName: {
                frameworkId,
                controlId: m.controlId,
                checkName: m.checkName,
              },
            },
            create: {
              frameworkId,
              controlId: m.controlId,
              checkName: m.checkName,
            },
            update: {},
          });
          result.mappingsCreated++;
        } catch {
          /* unique constraint or other - skip */
        }
      }
    }

    return result;
  }
}
