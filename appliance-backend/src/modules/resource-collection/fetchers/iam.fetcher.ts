import {
  IAMClient,
  ListUsersCommand,
  GetUserCommand,
  ListAccessKeysCommand,
  ListMFADevicesCommand,
} from "@aws-sdk/client-iam";
import type { IResourceFetcher, NormalizedResource, FetchOptions } from "../interfaces/fetcher.interface";
import { BaseFetcher } from "./base.fetcher";

const PAGE_SIZE = 100;

export class IamFetcher extends BaseFetcher implements IResourceFetcher {
  readonly resourceType = "iam_user";

  async *fetch(region: string, options?: FetchOptions): AsyncGenerator<NormalizedResource> {
    const client = new IAMClient({ region });
    let marker: string | undefined;

    do {
      const { Users = [], IsTruncated, Marker } = await client.send(
        new ListUsersCommand({ MaxItems: PAGE_SIZE, Marker: marker }),
      );

      for (const user of Users) {
        const userName = user.UserName;
        if (!userName) continue;

        let mfaActive = false;
        let accessKeysCount = 0;
        const passwordLastUsed = user.PasswordLastUsed;

        try {
          const [mfa, keys] = await Promise.all([
            client.send(new ListMFADevicesCommand({ UserName: userName })).catch(() => ({ MFADevices: [] })),
            client.send(new ListAccessKeysCommand({ UserName: userName })).catch(() => ({ AccessKeyMetadata: [] })),
          ]);
          mfaActive = (mfa.MFADevices?.length ?? 0) > 0;
          accessKeysCount = keys.AccessKeyMetadata?.length ?? 0;
        } catch {
          // Continue with defaults
        }

        const arn = user.Arn ?? `arn:aws:iam::${options?.accountId ?? "unknown"}:user/${userName}`;

        yield this.normalize(
          `iam:${userName}`,
          "iam_user",
          region,
          {
            userName,
            mfaActive,
            accessKeysCount,
            passwordLastUsed: passwordLastUsed?.toISOString(),
          },
          options?.accountId,
          arn,
        );
      }

      marker = IsTruncated ? Marker : undefined;
    } while (marker);
  }
}
