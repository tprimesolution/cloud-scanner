"""Build execution context (Namespace) for Prowler Provider.init_global_provider."""

from argparse import Namespace
from typing import Any, Optional


def build_aws_args(
    provider: str = "aws",
    profile: Optional[str] = None,
    region: Optional[list] = None,
    config_file: Optional[str] = None,
    **kwargs: Any,
) -> Namespace:
    """Build minimal Namespace for AWS provider."""
    return Namespace(
        provider=provider,
        profile=profile,
        role=kwargs.get("role"),
        role_session_name="ProwlerAssessmentSession",
        session_duration=3600,
        external_id=kwargs.get("external_id"),
        mfa=False,
        region=region or ["us-east-1"],
        organizations_role=kwargs.get("organizations_role"),
        security_hub=False,
        skip_sh_update=False,
        send_sh_only_fails=False,
        quick_inventory=False,
        output_bucket=None,
        output_bucket_no_assume=None,
        aws_retries_max_attempts=None,
        scan_unused_services=False,
        resource_tag=None,
        resource_arn=None,
        fixer=False,
        config_file=config_file,
        mutelist_file=None,
        fixer_config=None,
        output_formats=[],
        output_filename=None,
        output_directory="/tmp",
        verbose=False,
        ignore_exit_code_3=False,
        no_banner=True,
        no_color=True,
        log_level="CRITICAL",
        log_file=None,
        only_logs=True,
        check=None,
        checks_file=None,
        service=kwargs.get("service"),
        severity=kwargs.get("severity"),
        compliance=kwargs.get("compliance"),
        category=[],
        checks_folder=None,
        excluded_check=None,
        excluded_checks_file=None,
        excluded_service=None,
        custom_checks_metadata_file=None,
        status=None,
        shodan=None,
        slack=False,
        unix_timestamp=False,
        export_ocsf=False,
    )


def build_azure_args(
    provider: str = "azure",
    config_file: Optional[str] = None,
    **kwargs: Any,
) -> Namespace:
    """Build minimal Namespace for Azure provider."""
    sub_id = kwargs.get("subscription_id")
    if sub_id is not None and not isinstance(sub_id, list):
        sub_id = [sub_id] if sub_id else []
    return Namespace(
        provider=provider,
        az_cli_auth=kwargs.get("az_cli_auth", False),
        sp_env_auth=kwargs.get("sp_env_auth", True),
        browser_auth=kwargs.get("browser_auth", False),
        managed_identity_auth=kwargs.get("managed_identity_auth", False),
        tenant_id=kwargs.get("tenant_id"),
        azure_region=kwargs.get("azure_region", "AzureCloud"),
        subscription_id=sub_id,
        config_file=config_file,
        mutelist_file=None,
        fixer_config=None,
        output_formats=[],
        output_filename=None,
        output_directory="/tmp",
        verbose=False,
        no_banner=True,
        no_color=True,
        log_level="CRITICAL",
        only_logs=True,
        check=None,
        service=kwargs.get("service"),
        severity=kwargs.get("severity"),
        compliance=kwargs.get("compliance"),
        category=[],
        excluded_check=None,
        excluded_service=None,
        status=None,
    )


def build_gcp_args(
    provider: str = "gcp",
    config_file: Optional[str] = None,
    **kwargs: Any,
) -> Namespace:
    """Build minimal Namespace for GCP provider."""
    return Namespace(
        provider=provider,
        gcp_retries_max_attempts=None,
        organization_id=kwargs.get("organization_id"),
        project_id=kwargs.get("project_id"),
        excluded_project_id=kwargs.get("excluded_project_id"),
        credentials_file=kwargs.get("credentials_file"),
        impersonate_service_account=kwargs.get("impersonate_service_account"),
        list_project_id=kwargs.get("list_project_id"),
        skip_api_check=kwargs.get("skip_api_check", False),
        config_file=config_file,
        mutelist_file=None,
        fixer_config=None,
        output_formats=[],
        output_filename=None,
        output_directory="/tmp",
        verbose=False,
        no_banner=True,
        no_color=True,
        log_level="CRITICAL",
        only_logs=True,
        check=None,
        service=kwargs.get("service"),
        severity=kwargs.get("severity"),
        compliance=kwargs.get("compliance"),
        category=[],
        excluded_check=None,
        excluded_service=None,
        status=None,
    )


def build_kubernetes_args(
    provider: str = "kubernetes",
    config_file: Optional[str] = None,
    **kwargs: Any,
) -> Namespace:
    """Build minimal Namespace for Kubernetes provider."""
    return Namespace(
        provider=provider,
        kubeconfig_file=kwargs.get("kubeconfig_file"),
        context=kwargs.get("context"),
        namespace=kwargs.get("namespace"),
        cluster_name=kwargs.get("cluster_name"),
        config_file=config_file,
        mutelist_file=None,
        fixer_config=None,
        output_formats=[],
        output_filename=None,
        output_directory="/tmp",
        verbose=False,
        no_banner=True,
        no_color=True,
        log_level="CRITICAL",
        only_logs=True,
        check=None,
        service=kwargs.get("service"),
        severity=kwargs.get("severity"),
        compliance=kwargs.get("compliance"),
        category=[],
        excluded_check=None,
        excluded_service=None,
        status=None,
    )


def build_provider_args(
    provider: str,
    region: Optional[str] = None,
    services: Optional[list] = None,
    compliance: Optional[list] = None,
    severity: Optional[list] = None,
    config_file: Optional[str] = None,
    **kwargs: Any,
) -> Namespace:
    """Build provider-specific Namespace."""
    region_list = [region] if region else None
    if provider == "aws":
        return build_aws_args(
            region=region_list,
            service=services,
            compliance=compliance,
            severity=severity,
            config_file=config_file,
            **kwargs,
        )
    if provider == "azure":
        return build_azure_args(
            service=services,
            compliance=compliance,
            severity=severity,
            config_file=config_file,
            **kwargs,
        )
    if provider == "gcp":
        return build_gcp_args(
            service=services,
            compliance=compliance,
            severity=severity,
            config_file=config_file,
            **kwargs,
        )
    if provider == "kubernetes":
        return build_kubernetes_args(
            service=services,
            compliance=compliance,
            severity=severity,
            config_file=config_file,
            **kwargs,
        )
    return build_aws_args(region=region_list, config_file=config_file, **kwargs)
