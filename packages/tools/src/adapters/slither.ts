import type { SlitherFinding } from "@srp/shared-types";
import type { ToolExecutionResult } from "../index.js";

export class SlitherAdapter {
  parse(result: ToolExecutionResult): readonly SlitherFinding[] {
    if (!result.stdout) return [];

    try {
      // Slither typically outputs JSON when --json - is used
      const data = JSON.parse(result.stdout);
      return data.results.detectors.map((d: any) => ({
        check: d.check,
        impact: d.impact,
        confidence: d.confidence,
        description: d.description,
        elements: d.elements.map((e: any) => ({
          type: e.type,
          name: e.name,
          source_mapping: e.source_mapping
        }))
      }));
    } catch {
      // Fallback for non-JSON output or corrupted JSON
      return [];
    }
  }
}
