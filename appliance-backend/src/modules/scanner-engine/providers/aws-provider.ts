import { Injectable } from "@nestjs/common";
import { BaseProwlerProvider } from "./base-provider";
import { ProwlerHttpClientService } from "./prowler-http-client.service";
import type { ScanFilter } from "../interfaces/scan-filter.interface";

@Injectable()
export class AwsProvider extends BaseProwlerProvider {
  readonly name = "aws";

  constructor(httpClient: ProwlerHttpClientService) {
    super(httpClient);
  }

  protected getProwlerArgs(filter?: ScanFilter): string[] {
    const args: string[] = [];
    if (filter?.compliance) args.push("--compliance", filter.compliance);
    if (filter?.checks?.length) args.push("--checks", filter.checks.join(","));
    if (filter?.service) args.push("--services", filter.service);
    return args;
  }
}
