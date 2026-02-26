import { S3Client, ListBucketsCommand, GetBucketVersioningCommand, GetPublicAccessBlockCommand } from "@aws-sdk/client-s3";
import type { IResourceFetcher, NormalizedResource, FetchOptions } from "../interfaces/fetcher.interface";
import { BaseFetcher } from "./base.fetcher";

export class S3Fetcher extends BaseFetcher implements IResourceFetcher {
  readonly resourceType = "s3";

  async *fetch(region: string, options?: FetchOptions): AsyncGenerator<NormalizedResource> {
    const client = new S3Client({ region });
    const { Buckets = [] } = await client.send(new ListBucketsCommand({}));

    for (const bucket of Buckets) {
      const name = bucket.Name;
      if (!name) continue;

      let publicAccessBlock = false;
      let versioning = false;
      let encryption = false;

      try {
        const [pubBlock, vers] = await Promise.all([
          client.send(new GetPublicAccessBlockCommand({ Bucket: name })).catch(() => null),
          client.send(new GetBucketVersioningCommand({ Bucket: name })).catch(() => null),
        ]);
        const config = pubBlock && "PublicAccessBlockConfiguration" in pubBlock ? (pubBlock as { PublicAccessBlockConfiguration?: { BlockPublicAcls?: boolean } }).PublicAccessBlockConfiguration : undefined;
        publicAccessBlock = !!config?.BlockPublicAcls;
        versioning = vers?.Status === "Enabled";
        // Encryption requires GetBucketEncryption - skip if not needed for basic rules
        encryption = false;
      } catch {
        // Continue with defaults
      }

      yield this.normalize(
        `s3://${name}`,
        "s3",
        region,
        {
          name,
          publicAccessBlock,
          versioning,
          encryption,
        },
        options?.accountId,
        `arn:aws:s3:::${name}`,
      );
    }
  }
}
