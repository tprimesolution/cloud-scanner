from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List

import boto3

from .privilege_escalation_analyzer import ESCALATION_ACTIONS
from .rule_engine import RuleCategory, RuleDefinition, RuleResult


def _wildcard_policy_detector(session: boto3.Session, region: str, account_id: str) -> List[RuleResult]:
  iam = session.client("iam")
  results: List[RuleResult] = []

  paginator = iam.get_paginator("list_policies")
  for page in paginator.paginate(Scope="Local", OnlyAttached=False):
    for policy in page.get("Policies", []):
      version = iam.get_policy_version(
        PolicyArn=policy["Arn"],
        VersionId=policy["DefaultVersionId"],
      )["PolicyVersion"]["Document"]
      statements = version.get("Statement", [])
      if isinstance(statements, dict):
        statements = [statements]
      for stmt in statements:
        if stmt.get("Effect") != "Allow":
          continue
        if stmt.get("Action") in ("*", ["*"]) or stmt.get("Resource") in ("*", ["*"]):
          results.append(
            RuleResult(
              resource_id=policy["Arn"],
              region="aws-global",
              rule_id="IAM_WILDCARD_POLICIES",
              severity="High",
              frameworks=[
                "CIS:1.2",
                "NIST-800-53:AC-6",
                "PCI-DSS:7.1.2",
                "CCM:IAM-09",
              ],
              status="FAIL",
              remediation="Refactor IAM policies to avoid wildcard * on Action or Resource; apply least privilege.",
              details={"policy": policy},
            )
          )
          break
  return results


def _admin_no_mfa_detector(session: boto3.Session, region: str, account_id: str) -> List[RuleResult]:
  iam = session.client("iam")
  results: List[RuleResult] = []

  users = iam.list_users()["Users"]
  for user in users:
    username = user["UserName"]
    attached = iam.list_attached_user_policies(UserName=username)["AttachedPolicies"]
    is_admin = any("AdministratorAccess" in p["PolicyName"] for p in attached)
    if not is_admin:
      continue
    mfa = iam.list_mfa_devices(UserName=username)["MFADevices"]
    if not mfa:
      results.append(
        RuleResult(
          resource_id=user["Arn"],
          region="aws-global",
          rule_id="IAM_ADMIN_NO_MFA",
          severity="Critical",
          frameworks=[
            "CIS:1.2",
            "NIST-800-53:IA-2",
            "PCI-DSS:8.3",
            "ISO-27017:9.4",
          ],
          status="FAIL",
          remediation="Enforce MFA for all administrator-level IAM users or migrate to role-based access.",
          details={"user": user},
        )
      )
  return results


def _inactive_keys_detector(session: boto3.Session, region: str, account_id: str) -> List[RuleResult]:
  iam = session.client("iam")
  results: List[RuleResult] = []

  try:
    iam.get_credential_report()
  except iam.exceptions.CredentialReportNotPresentException:
    iam.generate_credential_report()
  except iam.exceptions.CredentialReportNotReadyException:
    iam.generate_credential_report()

  report = iam.get_credential_report()["Content"].decode("utf-8").splitlines()
  header = report[0].split(",")
  rows = [dict(zip(header, line.split(","))) for line in report[1:]]

  ninety_days_ago = datetime.now(timezone.utc) - timedelta(days=90)

  for row in rows:
    user = row["user"]
    if user in ("<root_account>", ""):
      continue
    for idx in (1, 2):
      active = row.get(f"access_key_{idx}_active") == "true"
      last_used = row.get(f"access_key_{idx}_last_used")
      if not active:
        continue
      if last_used in ("N/A", None):
        # Never used
        results.append(
          RuleResult(
            resource_id=f"iam:user/{user}:access-key-{idx}",
            region="aws-global",
            rule_id="IAM_INACTIVE_ACCESS_KEYS",
            severity="Medium",
            frameworks=[
              "CIS:5.4",
              "NIST-800-53:IA-5",
              "PCI-DSS:8.2.4",
            ],
            status="FAIL",
            remediation="Remove or rotate IAM access keys that are unused or older than 90 days.",
            details={"credential_report": row},
          )
        )
      else:
        last_used_dt = datetime.fromisoformat(last_used.replace("Z", "+00:00"))
        if last_used_dt < ninety_days_ago:
          results.append(
            RuleResult(
              resource_id=f"iam:user/{user}:access-key-{idx}",
              region="aws-global",
              rule_id="IAM_INACTIVE_ACCESS_KEYS",
              severity="Medium",
              frameworks=[
                "CIS:5.4",
                "NIST-800-53:IA-5",
                "PCI-DSS:8.2.4",
              ],
              status="FAIL",
              remediation="Rotate IAM access keys that have not been used in over 90 days.",
              details={"credential_report": row},
            )
          )
  return results


def _priv_escalation_detector(session: boto3.Session, region: str, account_id: str) -> List[RuleResult]:
  iam = session.client("iam")
  results: List[RuleResult] = []

  paginator = iam.get_paginator("list_policies")
  for page in paginator.paginate(Scope="Local", OnlyAttached=False):
    for policy in page.get("Policies", []):
      version = iam.get_policy_version(
        PolicyArn=policy["Arn"],
        VersionId=policy["DefaultVersionId"],
      )["PolicyVersion"]["Document"]
      statements = version.get("Statement", [])
      if isinstance(statements, dict):
        statements = [statements]
      matches: set[str] = set()
      for stmt in statements:
        if stmt.get("Effect") != "Allow":
          continue
        actions = stmt.get("Action", [])
        if isinstance(actions, str):
          actions = [actions]
        for action in actions:
          if any(action.lower().startswith(e.lower().split(":")[0]) and e.lower() in action.lower() for e in ESCALATION_ACTIONS):
            matches.add(action)
      if matches:
        results.append(
          RuleResult(
            resource_id=policy["Arn"],
            region="aws-global",
            rule_id="IAM_PRIV_ESC_PERMISSIONS",
            severity="Critical",
            frameworks=[
              "CIS:1.2",
              "NIST-800-53:AC-6",
              "PCI-DSS:7.1.2",
            ],
            status="FAIL",
            remediation="Restrict dangerous IAM actions (iam:PassRole, iam:CreatePolicyVersion, iam:Attach*Policy, ec2:RunInstances) to tightly scoped roles.",
            details={"policy": policy, "matched_actions": sorted(matches)},
          )
        )
  return results


def _cross_account_role_detector(session: boto3.Session, region: str, account_id: str) -> List[RuleResult]:
  iam = session.client("iam")
  results: List[RuleResult] = []

  roles = iam.list_roles()["Roles"]
  for role in roles:
    assume = role.get("AssumeRolePolicyDocument") or {}
    statements = assume.get("Statement", [])
    if isinstance(statements, dict):
      statements = [statements]
    for stmt in statements:
      principal = stmt.get("Principal", {})
      aws_principal = principal.get("AWS")
      if not aws_principal:
        continue
      if isinstance(aws_principal, str):
        principals = [aws_principal]
      else:
        principals = list(aws_principal)
      for p in principals:
        if str(account_id) not in str(p) and "arn:aws:iam::" in str(p) and "root" in str(p):
          results.append(
            RuleResult(
              resource_id=role["Arn"],
              region="aws-global",
              rule_id="IAM_CROSS_ACCOUNT_ROLES",
              severity="High",
              frameworks=[
                "CIS:1.5",
                "NIST-800-53:AC-3",
                "PCI-DSS:7.2",
              ],
              status="FAIL",
              remediation="Review IAM role trust policies and restrict cross-account principals to approved accounts.",
              details={"role": role, "principal": p},
            )
          )
  return results


IAM_RULES: List[RuleDefinition] = [
  RuleDefinition(
    rule_id="IAM_WILDCARD_POLICIES",
    title="IAM policies use wildcard * on action or resource",
    category=RuleCategory.IAM_SECURITY,
    severity="High",
    service="iam",
    frameworks=["CIS:1.2", "NIST-800-53:AC-6", "PCI-DSS:7.1.2", "CCM:IAM-09"],
    detector=_wildcard_policy_detector,
  ),
  RuleDefinition(
    rule_id="IAM_ADMIN_NO_MFA",
    title="Admin IAM users without MFA",
    category=RuleCategory.IAM_SECURITY,
    severity="Critical",
    service="iam",
    frameworks=["CIS:1.2", "NIST-800-53:IA-2", "PCI-DSS:8.3", "ISO-27017:9.4"],
    detector=_admin_no_mfa_detector,
  ),
  RuleDefinition(
    rule_id="IAM_INACTIVE_ACCESS_KEYS",
    title="Inactive or unused IAM access keys",
    category=RuleCategory.IAM_SECURITY,
    severity="Medium",
    service="iam",
    frameworks=["CIS:5.4", "NIST-800-53:IA-5", "PCI-DSS:8.2.4"],
    detector=_inactive_keys_detector,
  ),
  RuleDefinition(
    rule_id="IAM_PRIV_ESC_PERMISSIONS",
    title="IAM policies allow privilege escalation",
    category=RuleCategory.IAM_SECURITY,
    severity="Critical",
    service="iam",
    frameworks=["CIS:1.2", "NIST-800-53:AC-6", "PCI-DSS:7.1.2"],
    detector=_priv_escalation_detector,
  ),
  RuleDefinition(
    rule_id="IAM_CROSS_ACCOUNT_ROLES",
    title="IAM roles assumable by external accounts",
    category=RuleCategory.IAM_SECURITY,
    severity="High",
    service="iam",
    frameworks=["CIS:1.5", "NIST-800-53:AC-3", "PCI-DSS:7.2"],
    detector=_cross_account_role_detector,
  ),
]

