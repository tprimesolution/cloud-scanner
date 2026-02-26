import type { NormalizedResource } from "../interfaces/fetcher.interface";

export abstract class BaseFetcher {
  abstract readonly resourceType: string;

  protected normalize(
    id: string,
    type: string,
    region: string,
    metadata: Record<string, unknown>,
    accountId?: string,
    arn?: string,
  ): NormalizedResource {
    return {
      id,
      type,
      region,
      accountId,
      arn,
      metadata,
      fetchedAt: new Date(),
    };
  }
}
