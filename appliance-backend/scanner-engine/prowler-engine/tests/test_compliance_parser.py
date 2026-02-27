import json

from prowler_engine.compliance_parser import parse_compliance_mappings


def test_compliance_parser_correctness(tmp_path, monkeypatch):
    root = tmp_path / "prowler-core" / "prowler"
    compliance_dir = root / "compliance" / "aws"
    compliance_dir.mkdir(parents=True)
    (compliance_dir / "test_framework.json").write_text(
        json.dumps(
            {
                "Framework": "TEST",
                "Name": "Test Framework",
                "Provider": "AWS",
                "Requirements": [
                    {"Id": "1.1", "Name": "Req1", "Checks": ["iam_test_check"]},
                    {"Id": "1.2", "Name": "Req2", "Checks": ["iam_test_check"]},
                ],
            }
        )
    )
    monkeypatch.setenv("PROWLER_CORE", str(tmp_path / "prowler-core"))
    mapping = parse_compliance_mappings("aws")
    assert "iam_test_check" in mapping
    assert len(mapping["iam_test_check"]) == 2
