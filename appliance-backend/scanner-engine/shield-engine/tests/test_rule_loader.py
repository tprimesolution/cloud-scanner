import json
from pathlib import Path

from prowler_engine.rule_loader import discover_checks


def test_rule_discovery_accuracy(tmp_path, monkeypatch):
    root = tmp_path / "prowler-core" / "prowler"
    check_dir = root / "providers" / "aws" / "services" / "iam" / "iam_test_check"
    check_dir.mkdir(parents=True)
    meta_file = check_dir / "iam_test_check.metadata.json"
    meta_file.write_text(
        json.dumps(
            {
                "CheckID": "iam_test_check",
                "ServiceName": "iam",
                "Severity": "medium",
                "CheckTitle": "Test check",
            }
        )
    )

    monkeypatch.setenv("PROWLER_CORE", str(tmp_path / "prowler-core"))
    checks = discover_checks("aws")
    assert len(checks) == 1
    provider, service, check_name, metadata = checks[0]
    assert provider == "aws"
    assert service == "iam"
    assert check_name == "iam_test_check"
    assert metadata["CheckID"] == "iam_test_check"
