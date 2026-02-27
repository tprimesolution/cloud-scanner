from prowler_engine.compatibility import validate_compatibility


def test_compatibility_validator(monkeypatch):
    monkeypatch.setattr(
        "prowler_engine.compatibility.discover_checks",
        lambda: [
            ("aws", "iam", "iam_test_check", {
                "CheckID": "iam_test_check",
                "ServiceName": "iam",
                "Severity": "medium",
                "CheckTitle": "title",
            }),
            ("azure", "storage", "storage_test_check", {
                "CheckID": "storage_test_check",
                "ServiceName": "storage",
                "Severity": "low",
                "CheckTitle": "title",
            }),
            ("gcp", "iam", "gcp_test_check", {
                "CheckID": "gcp_test_check",
                "ServiceName": "iam",
                "Severity": "high",
                "CheckTitle": "title",
            }),
            ("kubernetes", "rbac", "k8s_test_check", {
                "CheckID": "k8s_test_check",
                "ServiceName": "rbac",
                "Severity": "high",
                "CheckTitle": "title",
            }),
        ],
    )
    monkeypatch.setattr(
        "prowler_engine.compatibility.parse_compliance_mappings",
        lambda _provider: {"iam_test_check": [{"framework": "TEST", "requirement_id": "1"}]},
    )
    monkeypatch.setattr(
        "prowler_engine.compatibility.get_prowler_version",
        lambda: "4.0.0-test",
    )
    settings = type(
        "Cfg",
        (),
        {
            "expected_rule_baseline": 1,
            "expected_compliance_mappings_baseline": 1,
        },
    )()
    report = validate_compatibility(settings)
    assert report["prowler_version"] == "4.0.0-test"
    assert report["rule_count"] == 4
    assert report["warnings"] == []
