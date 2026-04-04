import type { ToolExecutionResult } from "../index.js";

export interface AderynIssue {
  readonly detector_name: string;
  readonly detector_id: string;
  readonly severity: string;
  readonly description: string;
  readonly instances: readonly {
    readonly contract_path: string;
    readonly line_no: number;
  }[];
}

export class AderynAdapter {
  parse(result: ToolExecutionResult): readonly AderynIssue[] {
    if (!result.stdout) return [];

    try {
      const data = JSON.parse(result.stdout);
      // Aderyn output usually has high/medium/low/nc categories
      const issues: AderynIssue[] = [];
      
      const categories = ["high_issues", "medium_issues", "low_issues", "nc_issues"];
      for (const cat of categories) {
        if (data[cat]?.issues) {
          for (const issue of data[cat].issues) {
            issues.push({
              detector_name: issue.title,
              detector_id: issue.detector_id,
              severity: cat.split("_")[0]!,
              description: issue.description,
              instances: issue.instances.map((inst: any) => ({
                contract_path: inst.contract_path,
                line_no: inst.line_no
              }))
            });
          }
        }
      }
      return issues;
    } catch {
      return [];
    }
  }
}
