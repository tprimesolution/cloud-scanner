import { Module } from "@nestjs/common";
import { ProwlerRunnerService } from "./prowler-runner.service";
import { CloudSploitRunnerService } from "./cloudsploit-runner.service";
import { ExternalScannerService } from "./external-scanner.service";
import { FindingsModule } from "../findings/findings.module";

@Module({
  imports: [FindingsModule],
  providers: [ProwlerRunnerService, CloudSploitRunnerService, ExternalScannerService],
  exports: [ExternalScannerService],
})
export class ExternalScannerModule {}
