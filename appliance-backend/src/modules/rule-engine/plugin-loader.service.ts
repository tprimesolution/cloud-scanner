import { Injectable } from "@nestjs/common";
import type { IRulePlugin } from "./interfaces/rule-plugin.interface";
import { S3PublicAccessRule } from "./plugins/s3/s3-public-access.rule";
import { S3EncryptionRule } from "./plugins/s3/s3-encryption.rule";
import { IamMfaRule } from "./plugins/iam/iam-mfa.rule";
import { SgPublicIngressRule } from "./plugins/security-group/sg-public-ingress.rule";
import { RdsEncryptionRule } from "./plugins/rds/rds-encryption.rule";
import { EbsEncryptionRule } from "./plugins/ebs/ebs-encryption.rule";
import { CloudTrailEnabledRule } from "./plugins/cloudtrail/cloudtrail-enabled.rule";

@Injectable()
export class PluginLoaderService {
  private plugins: IRulePlugin[] | null = null;

  getPlugins(resourceType?: string): IRulePlugin[] {
    if (!this.plugins) {
      this.plugins = [
        new S3PublicAccessRule(),
        new S3EncryptionRule(),
        new IamMfaRule(),
        new SgPublicIngressRule(),
        new RdsEncryptionRule(),
        new EbsEncryptionRule(),
        new CloudTrailEnabledRule(),
      ];
    }
    if (resourceType) {
      return this.plugins.filter((p) => p.resourceType === resourceType);
    }
    return this.plugins;
  }
}
