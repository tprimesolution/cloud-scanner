import { CloudTrailClient, DescribeTrailsCommand } from "@aws-sdk/client-cloudtrail";
import type { IResourceFetcher, NormalizedResource, FetchOptions } from "../interfaces/fetcher.interface";
import { BaseFetcher } from "./base.fetcher";

export class CloudTrailFetcher extends BaseFetcher implements IResourceFetcher {
  readonly resourceType = "cloudtrail";

  async *fetch(region: string, options?: FetchOptions): AsyncGenerator<NormalizedResource> {
    const client = new CloudTrailClient({ region });
    const { trailList = [] } = await client.send(new DescribeTrailsCommand({}));

    for (const trail of trailList) {
      const trailName = trail.Name ?? "";
      const multiRegion = trail.IsMultiRegionTrail ?? false;
      const logFileValidation = trail.LogFileValidationEnabled ?? false;

      const arn =
        trail.TrailARN ??
        `arn:aws:cloudtrail:${region}:${options?.accountId ?? "unknown"}:trail/${trailName}`;

      yield this.normalize(
        trailName,
        "cloudtrail",
        region,
        {
          trailName,
          multiRegion,
          logFileValidation,
        },
        options?.accountId,
        arn,
      );
    }

    // If no trails, yield a synthetic "no trail" resource for rule evaluation
    if (trailList.length === 0) {
      yield this.normalize(
        "no-trail",
        "cloudtrail",
        region,
        { trailName: "none", multiRegion: false, logFileValidation: false },
        options?.accountId,
        undefined,
      );
    }
  }
}
