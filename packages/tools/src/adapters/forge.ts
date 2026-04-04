import type { ForgeTestResult } from "@srp/shared-types";
import type { ToolExecutionResult } from "../index.js";

export class ForgeAdapter {
  parse(result: ToolExecutionResult): readonly ForgeTestResult[] {
    if (!result.stdout) return [];

    // Forge can output JSON with --json
    try {
      const data = JSON.parse(result.stdout);
      // Forge output structure varies by version, but often includes test results in suites
      const results: ForgeTestResult[] = [];
      
      for (const suiteName in data) {
        const suite = data[suiteName];
        if (suite.test_results) {
          for (const testName in suite.test_results) {
            const tr = suite.test_results[testName];
            results.push({
              name: testName,
              status: tr.status === "Success" ? "success" : "failure",
              gas_used: tr.gas_used,
              reason: tr.reason
            });
          }
        }
      }
      return results;
    } catch {
      // Fallback for line-based parsing of forge test output
      const results: ForgeTestResult[] = [];
      const lines = result.stdout.split("\n");
      for (const line of lines) {
        if (line.includes("[PASS]") || line.includes("[FAIL]")) {
          const status = line.includes("[PASS]") ? "success" : "failure";
          const match = line.match(/test(\w+)\(\)/);
          if (match) {
            results.push({
              name: `test${match[1]}`,
              status,
              gas_used: 0 // Cannot easily parse gas from text without regex
            });
          }
        }
      }
      return results;
    }
  }
}
