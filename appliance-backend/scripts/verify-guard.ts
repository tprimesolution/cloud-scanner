import { ApiKeyGuard } from "../src/shared/guards/api-key.guard";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

async function testGuard() {
  const mockConfigService = {
    get: (key: string) => {
      if (key === "API_KEY") return "secret-key";
      return null;
    },
  } as unknown as ConfigService;

  const guard = new ApiKeyGuard(mockConfigService);

  const createMockContext = (header?: string): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          header: (name: string) => (name === "X-API-KEY" ? header : undefined),
        }),
      }),
    } as unknown as ExecutionContext;
  };

  console.log("Running ApiKeyGuard tests...");

  // Test 1: Correct API key
  try {
    const result = guard.canActivate(createMockContext("secret-key"));
    if (result === true) {
      console.log("Test 1 Passed: Correct API key allowed.");
    } else {
      console.error("Test 1 Failed: Correct API key returned false.");
    }
  } catch (e) {
    console.error("Test 1 Failed: Correct API key threw exception.", e);
  }

  // Test 2: Incorrect API key
  try {
    guard.canActivate(createMockContext("wrong-key"));
    console.error("Test 2 Failed: Incorrect API key did not throw exception.");
  } catch (e) {
    if (e instanceof UnauthorizedException && e.message === "Invalid API Key") {
      console.log("Test 2 Passed: Incorrect API key rejected with 401.");
    } else {
      console.error("Test 2 Failed: Incorrect API key threw wrong exception.", e);
    }
  }

  // Test 3: Missing API key
  try {
    guard.canActivate(createMockContext(undefined));
    console.error("Test 3 Failed: Missing API key did not throw exception.");
  } catch (e) {
    if (e instanceof UnauthorizedException && e.message === "Invalid API Key") {
      console.log("Test 3 Passed: Missing API key rejected with 401.");
    } else {
      console.error("Test 3 Failed: Missing API key threw wrong exception.", e);
    }
  }

  // Test 4: No expected key set (should allow all)
  const noKeyConfigService = {
    get: () => null,
  } as unknown as ConfigService;
  const permissiveGuard = new ApiKeyGuard(noKeyConfigService);
  try {
    const result = permissiveGuard.canActivate(createMockContext(undefined));
    if (result === true) {
      console.log("Test 4 Passed: Permissive mode allowed missing key.");
    } else {
      console.error("Test 4 Failed: Permissive mode returned false.");
    }
  } catch (e) {
    console.error("Test 4 Failed: Permissive mode threw exception.", e);
  }
}

testGuard().catch((e) => {
  console.error("Test execution failed.", e);
  process.exit(1);
});
