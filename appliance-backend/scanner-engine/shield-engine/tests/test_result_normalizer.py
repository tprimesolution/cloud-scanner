from types import SimpleNamespace

from prowler_engine.result_normalizer import normalize_finding


def test_result_schema_normalization():
    metadata = SimpleNamespace(
        CheckID="iam_test_check",
        ServiceName="iam",
        Severity=SimpleNamespace(value="high"),
        CheckTitle="IAM check title",
        Risk="Risk description",
        Remediation="Remediation text",
    )
    finding = SimpleNamespace(
        status="FAIL",
        check_metadata=metadata,
        resource_id="resource-123",
        region="us-east-1",
    )

    result = normalize_finding(finding, "aws", ["TEST:1.1"])
    expected_keys = {
        "provider",
        "service",
        "check_id",
        "status",
        "severity",
        "resource_id",
        "description",
        "risk",
        "remediation",
        "compliance",
        "region",
    }
    assert set(result.keys()) == expected_keys
    assert result["status"] in ("PASS", "FAIL", "INFO")
    assert result["severity"] in ("critical", "high", "medium", "low")
