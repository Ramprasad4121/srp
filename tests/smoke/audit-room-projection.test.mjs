import test from "node:test";
import assert from "node:assert/strict";

import { rebuildAuditRoomProjection } from "../../apps/gateway/dist/runtime/room-projection.js";

test("audit room projection rebuild is deterministic and preserves core surfaces", () => {
  const manifest = {
    runId: "run_projection_1",
    projectId: "project_projection_1",
    sessionId: "session_projection_1",
    status: "running",
    createdAt: "2026-04-09T10:00:00.000Z",
    currentPhase: "audit-verify",
    artifacts: [
      {
        artifactId: "art_note_1",
        kind: "note",
        title: "Protocol intent note",
        phase: "synthesis-intent",
        createdAt: "2026-04-09T10:01:00.000Z",
        runId: "run_projection_1",
        projectId: "project_projection_1"
      },
      {
        artifactId: "art_diagram_1",
        kind: "diagram",
        title: "Value flow map",
        phase: "visual-flow-map",
        createdAt: "2026-04-09T10:02:00.000Z",
        runId: "run_projection_1",
        projectId: "project_projection_1"
      },
      {
        artifactId: "art_finding_1",
        kind: "finding",
        title: "Verified findings",
        phase: "audit-verify",
        createdAt: "2026-04-09T10:03:00.000Z",
        runId: "run_projection_1",
        projectId: "project_projection_1"
      },
      {
        artifactId: "art_test_1",
        kind: "test",
        title: "PoC execution log",
        phase: "audit-verify",
        createdAt: "2026-04-09T10:04:00.000Z",
        runId: "run_projection_1",
        projectId: "project_projection_1"
      }
    ]
  };

  const events = [
    {
      eventId: "evt_1",
      runId: "run_projection_1",
      projectId: "project_projection_1",
      type: "session.started",
      emittedAt: "2026-04-09T10:00:00.000Z"
    },
    {
      eventId: "evt_2",
      runId: "run_projection_1",
      projectId: "project_projection_1",
      type: "phase.status.changed",
      emittedAt: "2026-04-09T10:01:00.000Z",
      phase: "synthesis-intent",
      status: "completed",
      title: "Intent completed"
    },
    {
      eventId: "evt_3",
      runId: "run_projection_1",
      projectId: "project_projection_1",
      type: "phase.status.changed",
      emittedAt: "2026-04-09T10:04:30.000Z",
      phase: "audit-verify",
      status: "running",
      title: "Verification running"
    },
    {
      eventId: "evt_4",
      runId: "run_projection_1",
      projectId: "project_projection_1",
      type: "artifact.created",
      emittedAt: "2026-04-09T10:05:00.000Z",
      phase: "audit-verify",
      artifactId: "art_finding_1",
      artifactKind: "finding",
      artifactTitle: "Verified findings",
      title: "Finding registry emitted"
    }
  ];

  const payloads = {
    art_note_1: {
      draftSummary: "Intent summary for the protocol."
    },
    art_diagram_1: {
      type: "excalidraw",
      version: 2,
      source: "srp",
      title: "Value flow map",
      summary: "Shows deposits, withdrawals, and privileged controls.",
      elements: []
    },
    art_finding_1: {
      summary: "One finding verified.",
      generatedByModel: "test-model",
      findings: [
        {
          id: "finding_1",
          title: "Unchecked privileged sweep drains vault",
          description: "Privileged sweep lacks invariant enforcement.",
          severity: "High",
          status: "Confirmed",
          targetComponent: "Vault",
          impactedInvariantIds: ["inv_1"],
          proof: {
            findingId: "finding_1",
            status: "proven",
            output: "PoC reproduced drain path",
            generatedAt: "2026-04-09T10:03:30.000Z"
          }
        }
      ]
    },
    art_test_1: {
      tool: "forge",
      success: true,
      logs: "PoC test passed",
      generatedAt: "2026-04-09T10:04:00.000Z"
    }
  };

  const first = rebuildAuditRoomProjection({ manifest, events, payloads });
  const second = rebuildAuditRoomProjection({ manifest, events, payloads });

  assert.deepEqual(first, second);
  assert.equal(first.missionControl.runId, "run_projection_1");
  assert.equal(first.missionControl.currentPhase, "audit-verify");
  assert.equal(first.missionControl.completedPhases, 1);
  assert.equal(first.notes.length, 1);
  assert.equal(first.diagrams.length, 1);
  assert.equal(first.findings.length, 1);
  assert.equal(first.evidence.length, 2);
  assert.equal(first.timeline.length, 4);
  assert.equal(first.findings[0].status, "Confirmed");
  assert.equal(first.findings[0].severity, "High");
  assert.equal(first.findings[0].evidenceCount, 2);
  assert.ok(first.graph.nodes.some((node) => node.id === "finding:finding_1"));
  assert.ok(
    first.graph.edges.some(
      (edge) =>
        edge.from === "finding:finding_1" &&
        edge.to === "artifact:art_finding_1" &&
        edge.type === "belongs_to"
    )
  );
});
