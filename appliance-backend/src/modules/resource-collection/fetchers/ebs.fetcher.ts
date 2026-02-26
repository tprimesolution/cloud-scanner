import { EC2Client, DescribeVolumesCommand } from "@aws-sdk/client-ec2";
import type { IResourceFetcher, NormalizedResource, FetchOptions } from "../interfaces/fetcher.interface";
import { BaseFetcher } from "./base.fetcher";

const PAGE_SIZE = 100;

export class EbsFetcher extends BaseFetcher implements IResourceFetcher {
  readonly resourceType = "ebs";

  async *fetch(region: string, options?: FetchOptions): AsyncGenerator<NormalizedResource> {
    const client = new EC2Client({ region });
    let nextToken: string | undefined;

    do {
      const { Volumes = [], NextToken } = await client.send(
        new DescribeVolumesCommand({ MaxResults: PAGE_SIZE, NextToken: nextToken }),
      );

      for (const vol of Volumes) {
        const volumeId = vol.VolumeId ?? "";
        const encrypted = vol.Encrypted ?? false;
        const state = vol.State ?? "unknown";

        const arn = `arn:aws:ec2:${region}:${options?.accountId ?? "unknown"}:volume/${volumeId}`;

        yield this.normalize(
          volumeId,
          "ebs",
          region,
          {
            volumeId,
            encrypted,
            state,
          },
          options?.accountId,
          arn,
        );
      }

      nextToken = NextToken;
    } while (nextToken);
  }
}
