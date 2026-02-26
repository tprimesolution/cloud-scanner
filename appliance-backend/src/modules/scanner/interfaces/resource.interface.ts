/**
 * Cloud resource types returned by AWS fetchers.
 * Only necessary metadata to minimize API calls and memory.
 */

export type ResourceType = "s3" | "iam_user" | "security_group" | "rds" | "ebs";

export interface BaseResource {
  id: string;
  type: ResourceType;
  region: string;
  accountId?: string;
  arn?: string;
  fetchedAt: Date;
}

export interface S3BucketResource extends BaseResource {
  type: "s3";
  name: string;
  publicAccessBlock?: boolean;
  versioning?: boolean;
  encryption?: boolean;
}

export interface IamUserResource extends BaseResource {
  type: "iam_user";
  userName: string;
  mfaActive?: boolean;
  accessKeysCount?: number;
  passwordLastUsed?: Date;
}

export interface SecurityGroupResource extends BaseResource {
  type: "security_group";
  groupId: string;
  groupName: string;
  vpcId?: string;
  ingressRulesCount: number;
  egressRulesCount: number;
}

export interface RdsInstanceResource extends BaseResource {
  type: "rds";
  instanceId: string;
  engine: string;
  publiclyAccessible?: boolean;
  storageEncrypted?: boolean;
}

export interface EbsVolumeResource extends BaseResource {
  type: "ebs";
  volumeId: string;
  encrypted?: boolean;
  state: string;
}

export type FetchedResource =
  | S3BucketResource
  | IamUserResource
  | SecurityGroupResource
  | RdsInstanceResource
  | EbsVolumeResource;
