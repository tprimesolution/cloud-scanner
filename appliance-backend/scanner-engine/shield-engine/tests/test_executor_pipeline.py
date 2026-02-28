import asyncio

from prowler_engine.executor import run_scan_async


async def _fake_scan():
    return await run_scan_async(provider="aws", checks=["iam_test_check"])


def test_execution_pipeline_integrity(monkeypatch):
    def fake_import_check(_provider, _check_name):
        return object()

    def fake_execute_sync(_check_instance, _global_provider, _args):
        class Meta:
            CheckID = "iam_test_check"
            ServiceName = "iam"
            Severity = type("S", (), {"value": "medium"})()
            CheckTitle = "Title"
            Risk = ""
            Remediation = ""

        class Finding:
            status = "PASS"
            check_metadata = Meta()
            resource_id = "r1"
            region = "us-east-1"
            compliance = {}

        return [Finding()]

    async def fake_collector(*args, **kwargs):
        return ["iam_test_check"]

    monkeypatch.setattr("prowler_engine.executor._import_check", fake_import_check)
    monkeypatch.setattr("prowler_engine.executor._init_provider", lambda _args: object())
    monkeypatch.setattr("prowler_engine.executor._execute_check_sync", fake_execute_sync)
    monkeypatch.setattr("prowler_engine.executor._collector_with_retry", fake_collector)
    monkeypatch.setattr("prowler_engine.executor.parse_compliance_mappings", lambda _p: {})
    monkeypatch.setattr("prowler_engine.executor.get_settings", lambda: type(
        "Cfg",
        (),
        {
            "engine_max_workers": 2,
            "collector_timeout_seconds": 5,
            "collector_retry_count": 0,
            "rule_timeout_seconds": 5,
            "service_timeout_seconds": 10,
            "global_timeout_seconds": 15,
            "rule_batch_size": 25,
        },
    )())

    results = asyncio.run(_fake_scan())
    assert len(results) == 1
    assert results[0]["check_id"] == "iam_test_check"
    assert results[0]["provider"] == "aws"
