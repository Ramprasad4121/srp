import test from "node:test";
import assert from "node:assert/strict";
import { runDynaDebate } from "../src/debate.ts";
import type { Finding } from "../src/types.ts";

test("debate engine - 5 rounds execution", () => {
  const findings: Finding[] = [{
    id: "f1",
    title: "Test Finding",
    severity: "high",
    impact: "Can drain protocol profit.",
    likelihood: "High",
    attackPath: ["Step 1", "Step 2", "Step 3", "Step 4"],
    exploitability: "High",
    proofOfConcept: "Test",
    remediation: "Fix",
    confidence: 0.5,
    confidenceBand: "medium",
    evidence: [{
      file: "Test.sol",
      startLine: 1,
      endLine: 2,
      excerpt: "msg.sender.call{value: 1}()".padEnd(55, " "), // length > 50 for reachability
      rationale: "Test"
    }],
    status: "candidate",
    detector: "test"
  }];

  const result = runDynaDebate(findings);
  assert.equal(result.findings.length, 1);
  assert.equal(result.transcripts.length, 1);
  assert.equal(result.transcripts[0].rounds.length, 5, "Should execute exactly 5 debate rounds");
  
  // High severity (-0.03), 4 steps path (+0.06), long excerpt (+0.08), profit impact (+0.04), call excerpt (+0.05)
  // Base 0.5. Should end up around 0.5 + 0.08 + 0.06 - 0.03 + 0.04 + 0.05 = 0.70
  assert.ok(result.findings[0].confidence > 0.6, "Confidence should be boosted by strong evidence");
});

test("debate engine - confidence downgrade", () => {
  const findings: Finding[] = [{
    id: "f2",
    title: "Weak Finding",
    severity: "informational",
    impact: "Minor issue.",
    likelihood: "Low",
    attackPath: ["Step 1"],
    exploitability: "Low",
    proofOfConcept: "Test",
    remediation: "Fix",
    confidence: 0.5,
    confidenceBand: "medium",
    evidence: [{
      file: "Test.sol",
      startLine: 1,
      endLine: 2,
      excerpt: "short", // short excerpt, no call
      rationale: "Test"
    }],
    status: "candidate",
    detector: "test"
  }];

  const result = runDynaDebate(findings);
  
  // Informational (+0.03), 1 step (-0.10), short excerpt (-0.18), no profit (-0.07), no cross contract (-0.02)
  // Base 0.5. Should end up around 0.5 - 0.18 - 0.10 + 0.03 - 0.07 - 0.02 = 0.16
  assert.ok(result.findings[0].confidence < 0.4, "Confidence should be downgraded by weak evidence");
  assert.equal(result.transcripts[0].decision, "exploit_disproven", "Should be disproven due to low confidence");
});
