import test from "node:test";
import assert from "node:assert/strict";
import { rebuildBuildRoomProjection } from "../../apps/gateway/dist/runtime/build-room-projection.js";

test("build room projection maps persisted audit artifacts into build stages and source pack", () => {
  const projection = rebuildBuildRoomProjection({
    manifest: {
      runId: "run_build_1",
      projectId: "project_build_1",
      sessionId: "session_build_1",
      status: "completed",
      createdAt: "2026-04-18T11:00:00.000Z",
      currentPhase: "audit-report",
      artifacts: [
        {
          artifactId: "art_intent",
          kind: "note",
          title: "Intent synthesis",
          phase: "synthesis-intent",
          createdAt: "2026-04-18T11:01:00.000Z",
          runId: "run_build_1",
          projectId: "project_build_1"
        },
        {
          artifactId: "art_arch",
          kind: "note",
          title: "Architecture outline",
          phase: "synthesis-actors",
          createdAt: "2026-04-18T11:02:00.000Z",
          runId: "run_build_1",
          projectId: "project_build_1"
        },
        {
          artifactId: "art_design",
          kind: "diagram",
          title: "Protocol flow",
          phase: "visual-flow-map",
          createdAt: "2026-04-18T11:03:00.000Z",
          runId: "run_build_1",
          projectId: "project_build_1"
        },
        {
          artifactId: "art_release",
          kind: "report",
          title: "Final audit report",
          phase: "audit-report",
          createdAt: "2026-04-18T11:04:00.000Z",
          runId: "run_build_1",
          projectId: "project_build_1"
        }
      ]
    },
    failureDetail: "regression suite failed on wallet flow"
  });

  assert.equal(projection.missionControl.completedStages, 4);
  assert.equal(projection.missionControl.currentStage, "ship");
  assert.equal(projection.missionControl.readyForBuild, true);
  assert.equal(projection.missionControl.lastFailure, "regression suite failed on wallet flow");
  assert.equal(projection.sourcePack.intentTitle, "Intent synthesis");
  assert.equal(projection.sourcePack.designTitle, "Protocol flow");
  assert.equal(projection.stages[0]?.id, "discover");
  assert.equal(projection.stages[5]?.status, "completed");
  assert.equal(projection.deliveryGates[4]?.artifactCount, 1);
  assert.equal(projection.deliveryGates[4]?.latestArtifactTitle, "Final audit report");
  assert.ok(projection.lanes.some((lane) => lane.id === "protocol" && lane.artifactCount >= 1));
});
