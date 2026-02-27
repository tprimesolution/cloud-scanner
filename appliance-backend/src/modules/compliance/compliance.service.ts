import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";
import { ComplianceMappingService } from "../compliance-mapping/compliance-mapping.service";

export interface FrameworkInfo {
  frameworkId: string;
  name: string;
  description: string;
  findingCount: number;
  score: number;
  status: string;
}

export interface CategoryInfo {
  categoryId: string;
  name: string;
  description: string;
  findingCount: number;
}

const FRAMEWORKS: { id: string; name: string; description: string }[] = [
  { id: "CIS", name: "CIS AWS Benchmarks", description: "Center for Internet Security AWS security best practices" },
  { id: "SOC2", name: "SOC 2", description: "Service Organization Control 2 - Trust Services Criteria" },
  { id: "HIPAA", name: "HIPAA", description: "Health Insurance Portability and Accountability Act" },
  { id: "ISO27001", name: "ISO 27001", description: "Information security management systems" },
  { id: "PCIDSS", name: "PCI DSS", description: "Payment Card Industry Data Security Standard" },
  { id: "NIST-CSF", name: "NIST CSF", description: "NIST Cybersecurity Framework" },
  { id: "NIST-800-53", name: "NIST 800-53", description: "Security and privacy controls for federal systems" },
  { id: "FedRAMP", name: "FedRAMP", description: "Federal Risk and Authorization Management Program" },
  { id: "GDPR", name: "GDPR", description: "General Data Protection Regulation" },
  { id: "CCM", name: "Cloud Controls Matrix", description: "Cloud Security Alliance controls" },
  { id: "COBIT", name: "COBIT", description: "Control Objectives for Information Technologies" },
  { id: "ITIL", name: "ITIL", description: "IT Service Management best practices" },
  { id: "OWASP", name: "OWASP", description: "Open Web Application Security Project" },
  { id: "CWE", name: "CWE", description: "Common Weakness Enumeration" },
  { id: "CVE", name: "CVE", description: "Common Vulnerabilities and Exposures" },
  { id: "MITRE-ATT&CK", name: "MITRE ATT&CK", description: "Adversarial tactics and techniques" },
  { id: "BSIMM", name: "BSIMM", description: "Building Security In Maturity Model" },
  { id: "SANS-CIS", name: "SANS CIS Controls", description: "Critical security controls" },
  { id: "HITRUST", name: "HITRUST CSF", description: "Health information trust framework" },
  { id: "COPPA", name: "COPPA", description: "Children's Online Privacy Protection" },
  { id: "SOX", name: "SOX", description: "Sarbanes-Oxley Act" },
  { id: "GLBA", name: "GLBA", description: "Gramm-Leach-Bliley Act" },
  { id: "FERPA", name: "FERPA", description: "Family Educational Rights and Privacy" },
  { id: "CCPA", name: "CCPA", description: "California Consumer Privacy Act" },
  { id: "LGPD", name: "LGPD", description: "Brazilian General Data Protection Law" },
  { id: "PIPEDA", name: "PIPEDA", description: "Canadian privacy law" },
  { id: "APRA-CPS-234", name: "APRA CPS 234", description: "Australian prudential standard" },
  { id: "MAS-TRM", name: "MAS TRM", description: "Monetary Authority of Singapore" },
  { id: "ENISA", name: "ENISA", description: "European Union Agency for Cybersecurity" },
  { id: "C5", name: "C5", description: "German cloud computing compliance" },
  { id: "IRAP", name: "IRAP", description: "Australian Information Security Registered Assessors" },
  { id: "TISAX", name: "TISAX", description: "Trusted Information Security Assessment Exchange" },
  { id: "CSA-STAR", name: "CSA STAR", description: "Cloud Security Alliance certification" },
  { id: "ISO-27017", name: "ISO 27017", description: "Cloud security controls" },
  { id: "ISO-27018", name: "ISO 27018", description: "Cloud privacy controls" },
  { id: "SOC1", name: "SOC 1", description: "Service organization controls - ICFR" },
  { id: "SOC3", name: "SOC 3", description: "Trust Services Criteria for general use" },
  { id: "AICPA", name: "AICPA", description: "American Institute of CPAs guidelines" },
  { id: "FISMA", name: "FISMA", description: "Federal Information Security Management" },
  { id: "DoD-SRG", name: "DoD SRG", description: "Department of Defense Cloud SRG" },
  { id: "ITAR", name: "ITAR", description: "International Traffic in Arms Regulations" },
];

const CATEGORIES: { id: string; name: string; description: string }[] = [
  { id: "access-control", name: "Access Control", description: "Identity and access management controls" },
  { id: "encryption", name: "Encryption", description: "Data encryption at rest and in transit" },
  { id: "logging-monitoring", name: "Logging & Monitoring", description: "Audit logs and security monitoring" },
  { id: "network-security", name: "Network Security", description: "Network segmentation and firewall rules" },
  { id: "data-protection", name: "Data Protection", description: "Data classification and handling" },
  { id: "incident-response", name: "Incident Response", description: "Security incident handling" },
  { id: "business-continuity", name: "Business Continuity", description: "Disaster recovery and backup" },
  { id: "change-management", name: "Change Management", description: "Change control and approval" },
  { id: "vulnerability-management", name: "Vulnerability Management", description: "Patch and vulnerability scanning" },
  { id: "asset-management", name: "Asset Management", description: "Inventory and asset tracking" },
  { id: "physical-security", name: "Physical Security", description: "Data center and facility security" },
  { id: "personnel-security", name: "Personnel Security", description: "Background checks and training" },
  { id: "risk-management", name: "Risk Management", description: "Risk assessment and mitigation" },
  { id: "third-party", name: "Third-Party Risk", description: "Vendor and supplier security" },
  { id: "privacy", name: "Privacy", description: "Personal data protection" },
  { id: "compliance", name: "Compliance", description: "Regulatory compliance controls" },
  { id: "security-operations", name: "Security Operations", description: "SOC and security monitoring" },
];

@Injectable()
export class ComplianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly complianceMapping: ComplianceMappingService,
  ) {}

  async getFrameworks(): Promise<FrameworkInfo[]> {
    const findings = await this.prisma.finding.findMany({
      where: { status: "open" },
      select: { controlIds: true },
    });

    const findingCountByFramework: Record<string, number> = {};
    for (const f of findings) {
      for (const cid of f.controlIds) {
        const framework = cid.split("-")[0];
        findingCountByFramework[framework] = (findingCountByFramework[framework] ?? 0) + 1;
      }
    }

    return FRAMEWORKS.map((fw) => {
      const findingCount = findingCountByFramework[fw.id] ?? 0;
      const score = Math.max(0, 100 - findingCount * 4);
      return {
        frameworkId: fw.id,
        name: fw.name,
        description: fw.description,
        findingCount,
        score,
        status: findingCount > 0 ? "non_compliant" : "compliant",
      };
    });
  }

  async getCategories(): Promise<CategoryInfo[]> {
    const controlToCategory: Record<string, string> = {
      "CIS-1.1": "access-control",
      "CIS-1.10": "access-control",
      "CIS-1.20": "encryption",
      "CIS-1.21": "encryption",
      "CIS-3.1": "logging-monitoring",
      "CIS-4.1": "network-security",
      "CIS-4.2": "encryption",
      "CIS-4.3": "encryption",
      "SOC2-CC6.1": "access-control",
      "SOC2-CC7.2": "logging-monitoring",
      "HIPAA-164.312": "encryption",
    };

    const findings = await this.prisma.finding.findMany({
      where: { status: "open" },
      select: { controlIds: true },
    });

    const findingCountByCategory: Record<string, number> = {};
    for (const f of findings) {
      for (const cid of f.controlIds) {
        const categoryId = controlToCategory[cid] ?? "compliance";
        findingCountByCategory[categoryId] = (findingCountByCategory[categoryId] ?? 0) + 1;
      }
    }

    return CATEGORIES.map((cat) => ({
      categoryId: cat.id,
      name: cat.name,
      description: cat.description,
      findingCount: findingCountByCategory[cat.id] ?? 0,
    }));
  }

  private getControlIdsForFramework(frameworkId: string): string[] {
    return this.complianceMapping.getControlIdsForFramework(frameworkId);
  }

  async getFrameworkFindings(
    frameworkId: string,
    limit = 20,
    offset = 0
  ): Promise<{ items: unknown[]; total: number; frameworkId: string }> {
    const controlIds = this.getControlIdsForFramework(frameworkId);
    if (controlIds.length === 0) {
      return { items: [], total: 0, frameworkId };
    }

    const where = { status: "open" as const, controlIds: { hasSome: controlIds } };

    const [findings, total] = await Promise.all([
      this.prisma.finding.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { lastSeenAt: "desc" },
        include: { rule: true },
      }),
      this.prisma.finding.count({ where }),
    ]);

    const items = findings.map((f) => ({
      id: f.id,
      resourceId: f.resourceId,
      resourceType: f.resourceType,
      ruleCode: f.ruleCode,
      severity: f.severity,
      message: f.message,
      status: f.status,
      controlIds: f.controlIds,
      lastSeenAt: f.lastSeenAt,
      rule: f.rule ? { name: f.rule.name, description: f.rule.description } : null,
    }));

    return { items, total, frameworkId };
  }

  async getCategoryFindings(
    categoryId: string,
    limit = 20,
    offset = 0
  ): Promise<{ items: unknown[]; total: number; categoryId: string }> {
    const controlToCategory: Record<string, string> = {
      "CIS-1.1": "access-control",
      "CIS-1.10": "access-control",
      "CIS-1.20": "encryption",
      "CIS-1.21": "encryption",
      "CIS-3.1": "logging-monitoring",
      "CIS-4.1": "network-security",
      "CIS-4.2": "encryption",
      "CIS-4.3": "encryption",
      "SOC2-CC6.1": "access-control",
      "SOC2-CC7.2": "logging-monitoring",
      "HIPAA-164.312": "encryption",
    };

    const controlIdsInCategory = Object.entries(controlToCategory)
      .filter(([, cat]) => cat === categoryId)
      .map(([cid]) => cid);

    const where =
      controlIdsInCategory.length > 0
        ? { status: "open" as const, controlIds: { hasSome: controlIdsInCategory } }
        : { status: "open" as const };

    const [findings, total] = await Promise.all([
      this.prisma.finding.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { lastSeenAt: "desc" },
        include: { rule: true },
      }),
      this.prisma.finding.count({ where }),
    ]);

    const items = findings.map((f) => ({
      id: f.id,
      resourceId: f.resourceId,
      resourceType: f.resourceType,
      ruleCode: f.ruleCode,
      severity: f.severity,
      message: f.message,
      status: f.status,
      controlIds: f.controlIds,
      lastSeenAt: f.lastSeenAt,
      rule: f.rule ? { name: f.rule.name, description: f.rule.description } : null,
    }));

    return { items, total, categoryId };
  }
}
