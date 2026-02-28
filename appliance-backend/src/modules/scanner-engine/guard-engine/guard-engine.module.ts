import { Module } from "@nestjs/common";
import { CloudSploitModule } from "../cloudsploit/cloudsploit.module";

// White-label wrapper module. Internal CloudSploit module path remains unchanged.
@Module({
  imports: [CloudSploitModule],
  exports: [CloudSploitModule],
})
export class GuardEngineModule {}
