import { Module } from "@nestjs/common";
import { CheckLoaderService } from "./loaders/check-loader.service";
import { ComplianceParserService } from "./parsers/compliance-parser.service";
import { ProwlerHttpClientService } from "./providers/prowler-http-client.service";
import { AwsProvider } from "./providers/aws-provider";
import { AzureProvider } from "./providers/azure-provider";
import { GcpProvider } from "./providers/gcp-provider";
import { KubernetesProvider } from "./providers/kubernetes-provider";
import { ScannerEngineService } from "./services/scanner-engine.service";
import { ScannerEngineSyncService } from "./services/sync.service";
import { ScannerEngineController } from "./scanner-engine.controller";
import { ScannerEngineChecksController } from "./scanner-engine-checks.controller";
import { PrismaService } from "../../shared/prisma.service";

@Module({
  imports: [],
  controllers: [ScannerEngineController, ScannerEngineChecksController],
  providers: [
    PrismaService,
    ProwlerHttpClientService,
    CheckLoaderService,
    ComplianceParserService,
    AwsProvider,
    AzureProvider,
    GcpProvider,
    KubernetesProvider,
    ScannerEngineService,
    ScannerEngineSyncService,
  ],
  exports: [ScannerEngineService, ScannerEngineSyncService, CheckLoaderService, ComplianceParserService],
})
export class ScannerEngineModule {}
