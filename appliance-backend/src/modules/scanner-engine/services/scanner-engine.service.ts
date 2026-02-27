import { Injectable } from "@nestjs/common";
import { AwsProvider } from "../providers/aws-provider";
import { AzureProvider } from "../providers/azure-provider";
import { GcpProvider } from "../providers/gcp-provider";
import { KubernetesProvider } from "../providers/kubernetes-provider";
import type { ScanResult } from "../interfaces/scan-result.interface";
import type { ScanFilter } from "../interfaces/scan-filter.interface";

type ProviderRunner = { run: (f?: ScanFilter) => Promise<ScanResult[]> };

@Injectable()
export class ScannerEngineService {
  private readonly providers: Map<string, ProviderRunner>;

  constructor(
    private readonly awsProvider: AwsProvider,
    private readonly azureProvider: AzureProvider,
    private readonly gcpProvider: GcpProvider,
    private readonly kubernetesProvider: KubernetesProvider,
  ) {
    this.providers = new Map<string, ProviderRunner>([
      ["aws", this.awsProvider],
      ["azure", this.azureProvider],
      ["gcp", this.gcpProvider],
      ["kubernetes", this.kubernetesProvider],
    ]);
  }

  /** Run scan for a single provider. */
  async runProvider(provider: string, filter?: ScanFilter): Promise<ScanResult[]> {
    const p = this.providers.get(provider?.toLowerCase());
    if (!p) return [];
    return p.run(filter);
  }

  /** Run scans for multiple providers concurrently. */
  async runProviders(
    providers: string[],
    filter?: ScanFilter
  ): Promise<{ provider: string; results: ScanResult[] }[]> {
    const tasks = providers.map(async (provider) => {
      const results = await this.runProvider(provider, filter);
      return { provider, results };
    });
    return Promise.all(tasks);
  }

  /** Get list of supported providers. */
  getProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
