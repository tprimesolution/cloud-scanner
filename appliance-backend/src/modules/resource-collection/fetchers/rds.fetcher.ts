import { RDSClient, DescribeDBInstancesCommand } from "@aws-sdk/client-rds";
import type { IResourceFetcher, NormalizedResource, FetchOptions } from "../interfaces/fetcher.interface";
import { BaseFetcher } from "./base.fetcher";

const PAGE_SIZE = 100;

export class RdsFetcher extends BaseFetcher implements IResourceFetcher {
  readonly resourceType = "rds";

  async *fetch(region: string, options?: FetchOptions): AsyncGenerator<NormalizedResource> {
    const client = new RDSClient({ region });
    let marker: string | undefined;

    do {
      const { DBInstances = [], Marker: nextMarker } = await client.send(
        new DescribeDBInstancesCommand({ MaxRecords: PAGE_SIZE, Marker: marker }),
      );

      for (const db of DBInstances) {
        const instanceId = db.DBInstanceIdentifier ?? "";
        const engine = db.Engine ?? "unknown";
        const publiclyAccessible = db.PubliclyAccessible ?? false;
        const storageEncrypted = db.StorageEncrypted ?? false;

        const arn =
          db.DBInstanceArn ??
          `arn:aws:rds:${region}:${options?.accountId ?? "unknown"}:db:${instanceId}`;

        yield this.normalize(
          instanceId,
          "rds",
          region,
          {
            instanceId,
            engine,
            publiclyAccessible,
            storageEncrypted,
          },
          options?.accountId,
          arn,
        );
      }

      marker = nextMarker;
    } while (marker);
  }
}
