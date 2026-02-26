import {
  EC2Client,
  DescribeSecurityGroupsCommand,
  DescribeSecurityGroupRulesCommand,
} from "@aws-sdk/client-ec2";
import type { IResourceFetcher, NormalizedResource, FetchOptions } from "../interfaces/fetcher.interface";
import { BaseFetcher } from "./base.fetcher";

const PAGE_SIZE = 100;

export class SecurityGroupFetcher extends BaseFetcher implements IResourceFetcher {
  readonly resourceType = "security_group";

  async *fetch(region: string, options?: FetchOptions): AsyncGenerator<NormalizedResource> {
    const client = new EC2Client({ region });
    let nextToken: string | undefined;

    do {
      const { SecurityGroups = [], NextToken } = await client.send(
        new DescribeSecurityGroupsCommand({ MaxResults: PAGE_SIZE, NextToken: nextToken }),
      );

      for (const sg of SecurityGroups) {
        const groupId = sg.GroupId ?? "";
        const groupName = sg.GroupName ?? "";
        const vpcId = sg.VpcId;

        let ingressRulesCount = 0;
        let egressRulesCount = 0;

        try {
          const rules = await client.send(
            new DescribeSecurityGroupRulesCommand({
              Filters: [{ Name: "group-id", Values: [groupId] }],
            }),
          );
          const rulesList = rules.SecurityGroupRules ?? [];
          ingressRulesCount = rulesList.filter((r) => r.IsEgress === false).length;
          egressRulesCount = rulesList.filter((r) => r.IsEgress === true).length;
        } catch {
          // Use IpPermissions if available as fallback
          ingressRulesCount = sg.IpPermissions?.length ?? 0;
          egressRulesCount = sg.IpPermissionsEgress?.length ?? 0;
        }

        const arn = `arn:aws:ec2:${region}:${options?.accountId ?? "unknown"}:security-group/${groupId}`;

        yield this.normalize(
          groupId,
          "security_group",
          region,
          {
            groupId,
            groupName,
            vpcId,
            ingressRulesCount,
            egressRulesCount,
          },
          options?.accountId,
          arn,
        );
      }

      nextToken = NextToken;
    } while (nextToken);
  }
}
