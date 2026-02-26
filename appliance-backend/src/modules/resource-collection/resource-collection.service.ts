import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";
import type { NormalizedResource, FetchOptions } from "./interfaces/fetcher.interface";
import { BATCH_WRITE_SIZE } from "../../shared/pagination.util";
import {
  S3Fetcher,
  IamFetcher,
  SecurityGroupFetcher,
  RdsFetcher,
  EbsFetcher,
  CloudTrailFetcher,
} from "./fetchers";

const DEFAULT_REGIONS = ["us-east-1"];

@Injectable()
export class ResourceCollectionService {
  private readonly fetchers = [
    new S3Fetcher(),
    new IamFetcher(),
    new SecurityGroupFetcher(),
    new RdsFetcher(),
    new EbsFetcher(),
    new CloudTrailFetcher(),
  ];

  constructor(private readonly prisma: PrismaService) {}

  async collectResources(scanJobId: string, options?: FetchOptions): Promise<number> {
    const regions = options?.regions ?? DEFAULT_REGIONS;
    let totalCount = 0;

    for (const fetcher of this.fetchers) {
      for (const region of regions) {
        const batch: { resourceId: string; resourceType: string; region: string; accountId: string | null; metadata: object }[] = [];

        try {
          for await (const resource of fetcher.fetch(region, options)) {
            batch.push({
              resourceId: resource.id,
              resourceType: resource.type,
              region: resource.region,
              accountId: resource.accountId ?? null,
              metadata: resource.metadata as object,
            });
            totalCount++;

            if (batch.length >= BATCH_WRITE_SIZE) {
              await this.writeBatch(scanJobId, batch);
              batch.length = 0;
            }
          }

          if (batch.length > 0) {
            await this.writeBatch(scanJobId, batch);
          }
        } catch (err) {
          // Log but continue with other fetchers/regions
          console.error(`Fetcher ${fetcher.resourceType} failed for region ${region}:`, err);
        }
      }
    }

    return totalCount;
  }

  private async writeBatch(
    scanJobId: string,
    batch: { resourceId: string; resourceType: string; region: string; accountId: string | null; metadata: object }[],
  ): Promise<void> {
    await this.prisma.collectedResource.createMany({
      data: batch.map((b) => ({
        scanJobId,
        resourceId: b.resourceId,
        resourceType: b.resourceType,
        region: b.region,
        accountId: b.accountId,
        metadata: b.metadata,
      })),
      skipDuplicates: true,
    });
  }

  getFetcherResourceTypes(): string[] {
    return this.fetchers.map((f) => f.resourceType);
  }
}
