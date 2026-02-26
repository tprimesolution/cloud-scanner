/**
 * Fetcher interface for cloud resource collection.
 * All fetchers use AWS SDK v3, pagination, and yield resources (streaming).
 */

export interface FetchOptions {
  accountId?: string;
  regions?: string[];
}

export interface NormalizedResource {
  id: string;
  type: string;
  region: string;
  accountId?: string;
  arn?: string;
  metadata: Record<string, unknown>;
  fetchedAt: Date;
}

export interface IResourceFetcher {
  readonly resourceType: string;
  fetch(region: string, options?: FetchOptions): AsyncGenerator<NormalizedResource>;
}
