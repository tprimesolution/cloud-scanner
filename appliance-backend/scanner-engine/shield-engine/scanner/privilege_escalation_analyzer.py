from __future__ import annotations

from typing import Any, Dict, Iterable, List

from .base_scanner import Finding


# Subset of well-known IAM privilege escalation actions.
ESCALATION_ACTIONS = {
    "iam:PassRole",
    "iam:CreatePolicyVersion",
    "iam:SetDefaultPolicyVersion",
    "iam:AttachUserPolicy",
    "iam:AttachRolePolicy",
    "iam:PutUserPolicy",
    "iam:PutRolePolicy",
    "ec2:RunInstances",
}


def analyze_policies_for_escalation(
    account_id: str,
    policies: Iterable[Dict[str, Any]],
) -> List[Finding]:
    """Detect potential privilege escalation via dangerous IAM actions."""
    findings: List[Finding] = []

    for policy in policies:
        doc = policy.get("Document") or {}
        arn = policy.get("Arn", "unknown")
        statements = doc.get("Statement", [])
        if isinstance(statements, dict):
            statements = [statements]

        matched_actions: List[str] = []
        for stmt in statements:
            if stmt.get("Effect") != "Allow":
                continue
            actions = stmt.get("Action", [])
            if isinstance(actions, str):
                actions = [actions]
            for action in actions:
                action_lower = action.lower()
                for esc in ESCALATION_ACTIONS:
                    if esc.lower() == action_lower or esc.lower() == f"{action_lower}:*":
                        matched_actions.append(action)

        if matched_actions:
            findings.append(
                Finding(
                    account_id=account_id,
                    region="aws-global",
                    resource_id=arn,
                    resource_type="iam_policy",
                    service="iam",
                    issue=f"IAM policy may allow privilege escalation via {', '.join(sorted(set(matched_actions)))}",
                    severity="critical",
                    remediation=(
                        "Review and restrict IAM permissions to follow least-privilege. "
                        "Limit iam:PassRole, iam:CreatePolicyVersion, iam:Attach*Policy, "
                        "and ec2:RunInstances to tightly scoped roles."
                    ),
                    compliance_mapping=["AWS-PRIV-ESC", "CIS-1.3"],
                    category="IAM",
                    raw={"policy": policy, "matched_actions": matched_actions},
                )
            )

    return findings

