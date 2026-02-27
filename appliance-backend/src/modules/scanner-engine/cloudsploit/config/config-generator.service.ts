import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

@Injectable()
export class CloudSploitConfigGeneratorService {
  /** Generate a temporary config file for CloudSploit when custom credentials are provided. */
  generateConfig(provider: string, credentials: Record<string, unknown>): string | null {
    const creds = this.normalizeCredentials(provider, credentials);
    const hasCreds = Object.values(creds).some((v) => v != null && String(v).trim() !== "");
    if (!hasCreds) return null;

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cloudsploit-config-"));
    const configPath = path.join(tmpDir, "config.js");
    const providerKey = this.getProviderKey(provider);

    const credsJson = JSON.stringify(creds, null, 2);
    const config = `module.exports = {
  credentials: {
    ${providerKey}: ${credsJson}
  }
};
`;
    fs.writeFileSync(configPath, config, "utf-8");
    return configPath;
  }

  private getProviderKey(provider: string): string {
    const m: Record<string, string> = {
      aws: "aws",
      azure: "azure",
      gcp: "google",
      oci: "oracle",
    };
    return m[provider?.toLowerCase()] || "aws";
  }

  private normalizeCredentials(provider: string, creds: Record<string, unknown>): Record<string, unknown> {
    const p = provider?.toLowerCase();
    if (p === "aws") {
      return {
        access_key: creds.accessKeyId ?? creds.access_key ?? process.env.AWS_ACCESS_KEY_ID ?? "",
        secret_access_key: creds.secretAccessKey ?? creds.secret_access_key ?? process.env.AWS_SECRET_ACCESS_KEY ?? "",
        session_token: creds.sessionToken ?? creds.session_token ?? process.env.AWS_SESSION_TOKEN ?? "",
        credential_file: creds.credential_file,
      };
    }
    if (p === "azure") {
      return {
        application_id: creds.ApplicationID ?? creds.application_id ?? process.env.AZURE_APPLICATION_ID ?? "",
        key_value: creds.KeyValue ?? creds.key_value ?? process.env.AZURE_KEY_VALUE ?? "",
        directory_id: creds.DirectoryID ?? creds.directory_id ?? process.env.AZURE_DIRECTORY_ID ?? "",
        subscription_id: creds.SubscriptionID ?? creds.subscription_id ?? process.env.AZURE_SUBSCRIPTION_ID ?? "",
      };
    }
    if (p === "gcp" || p === "google") {
      return {
        credential_file: creds.credential_file,
        project: creds.project ?? creds.project_id ?? "",
        client_email: creds.client_email ?? "",
        private_key: creds.private_key ?? "",
      };
    }
    if (p === "oci") {
      return {
        tenancy_id: creds.tenancyId ?? creds.tenancy_id ?? "",
        compartment_id: creds.compartmentId ?? creds.compartment_id ?? "",
        user_id: creds.userId ?? creds.user_id ?? "",
        key_fingerprint: creds.keyFingerprint ?? creds.key_fingerprint ?? "",
        key_value: creds.keyValue ?? creds.key_value ?? "",
        region: creds.region ?? "",
      };
    }
    return creds;
  }
}
