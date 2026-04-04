import type { SecurityFinding } from "@srp/shared-types";

export interface GroundTruthFinding {
  readonly id: string;
  readonly title: string;
  readonly severity: string;
}

export interface BenchmarkReport {
  readonly projectId: string;
  readonly totalExpected: number;
  readonly totalDetected: number;
  readonly truePositives: number;
  readonly falsePositives: number;
  readonly falseNegatives: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1Score: number;
}

export class BenchmarkRunner {
  run(
    projectId: string,
    detected: readonly SecurityFinding[],
    expected: readonly GroundTruthFinding[]
  ): BenchmarkReport {
    let tp = 0;
    
    for (const d of detected) {
      if (expected.some(e => this.isMatch(d, e))) {
        tp++;
      }
    }

    const fp = detected.length - tp;
    const fn = expected.length - tp;

    const precision = detected.length > 0 ? tp / detected.length : 0;
    const recall = expected.length > 0 ? tp / expected.length : 0;
    const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return {
      projectId,
      totalExpected: expected.length,
      totalDetected: detected.length,
      truePositives: tp,
      falsePositives: fp,
      falseNegatives: fn,
      precision,
      recall,
      f1Score: f1
    };
  }

  private isMatch(d: SecurityFinding, e: GroundTruthFinding): boolean {
    // Heuristic match based on title similarity or ID if provided in ground truth
    return d.title.toLowerCase().includes(e.title.toLowerCase()) || 
           e.title.toLowerCase().includes(d.title.toLowerCase());
  }
}
