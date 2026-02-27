import { Injectable } from "@nestjs/common";

export type Framework = "CIS" | "SOC2" | "HIPAA" | "ISO27001" | "PCIDSS";

export interface ControlInfo {
  controlId: string;
  framework: Framework;
  name: string;
}

@Injectable()
export class ComplianceMappingService {
  private readonly controlMap: Record<string, ControlInfo> = {
    "CIS-1.1": { controlId: "CIS-1.1", framework: "CIS", name: "Avoid the use of the root account" },
    "CIS-1.10": { controlId: "CIS-1.10", framework: "CIS", name: "Ensure IAM password policy requires MFA" },
    "CIS-1.20": { controlId: "CIS-1.20", framework: "CIS", name: "Ensure S3 bucket block public access" },
    "CIS-1.21": { controlId: "CIS-1.21", framework: "CIS", name: "Ensure S3 bucket encryption" },
    "CIS-3.1": { controlId: "CIS-3.1", framework: "CIS", name: "Ensure CloudTrail is enabled" },
    "CIS-4.1": { controlId: "CIS-4.1", framework: "CIS", name: "Ensure no security groups allow ingress from 0.0.0.0/0" },
    "CIS-4.2": { controlId: "CIS-4.2", framework: "CIS", name: "Ensure EBS volumes are encrypted" },
    "CIS-4.3": { controlId: "CIS-4.3", framework: "CIS", name: "Ensure RDS storage is encrypted" },
    "SOC2-CC6.1": { controlId: "SOC2-CC6.1", framework: "SOC2", name: "Logical and physical access controls" },
    "SOC2-CC7.2": { controlId: "SOC2-CC7.2", framework: "SOC2", name: "System monitoring" },
    "HIPAA-164.312": { controlId: "HIPAA-164.312", framework: "HIPAA", name: "Technical safeguards - encryption" },
  };

  getControlInfo(controlId: string): ControlInfo | undefined {
    return this.controlMap[controlId];
  }

  getControlsForFindings(controlIds: string[]): ControlInfo[] {
    return controlIds
      .map((id) => this.controlMap[id])
      .filter((c): c is ControlInfo => c !== undefined);
  }

  getFrameworks(): Framework[] {
    return ["CIS", "SOC2", "HIPAA", "ISO27001", "PCIDSS"];
  }

  getControlIdsForFramework(framework: string): string[] {
    return Object.entries(this.controlMap)
      .filter(([, v]) => v.framework === framework)
      .map(([k]) => k);
  }
}
