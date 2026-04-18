import { BUILD_LANES, BUILD_STAGES, DELIVERY_GATES } from "@srp/methodology";
import type {
  ArtifactMetadata,
  BuildDeliveryGateProjection,
  BuildLaneProjection,
  BuildRoomProjection,
  BuildStageId,
  BuildStageProjection,
  MethodologyPhase,
  RunManifest,
  SessionStatus
} from "@srp/shared-types";

const BUILD_STAGE_PHASES: Record<BuildStageId, readonly MethodologyPhase[]> = {
  discover: [
    "discovery-docs",
    "discovery-audits",
    "discovery-governance",
    "discovery-tokenomics",
    "discovery-onchain",
    "synthesis-intent"
  ],
  plan: ["synthesis-actors", "synthesis-entry-exit", "synthesis-functions"],
  design: ["synthesis-invariants", "visual-flow-map"],
  build: ["audit-resolve-input", "audit-setup", "audit-map", "audit-hunt"],
  qa: ["audit-attack", "audit-verify"],
  ship: ["audit-report"]
};

const LANE_ARTIFACT_KINDS: Record<BuildLaneProjection["id"], readonly ArtifactMetadata["kind"][]> = {
  protocol: ["invariant", "report", "test"],
  dapp: ["diagram", "note"],
  hackathon: ["hypothesis", "note"],
  "first-aid": ["finding", "test", "report"]
};

function includesPhase(stageId: BuildStageId, phase: MethodologyPhase): boolean {
  return BUILD_STAGE_PHASES[stageId].includes(phase);
}

function latestArtifact(artifacts: readonly ArtifactMetadata[]): ArtifactMetadata | undefined {
  return [...artifacts].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  })[0];
}

function getCurrentStageId(run: RunManifest): BuildStageId | null {
  if (run.currentPhase) {
    return BUILD_STAGES.find((stage) => includesPhase(stage.id, run.currentPhase!))?.id ?? null;
  }

  const latest = latestArtifact(run.artifacts);
  if (!latest) return null;
  return BUILD_STAGES.find((stage) => includesPhase(stage.id, latest.phase))?.id ?? null;
}

function stageStatus(
  stageIndex: number,
  currentStageIndex: number,
  artifactCount: number,
  runStatus: SessionStatus
): BuildStageProjection["status"] {
  if (artifactCount > 0 && (stageIndex < currentStageIndex || runStatus === "completed")) {
    return "completed";
  }
  if (stageIndex === currentStageIndex && runStatus === "running") {
    return "in_progress";
  }
  if (artifactCount > 0 && stageIndex === currentStageIndex) {
    return "ready";
  }
  if (stageIndex === currentStageIndex + 1 || (currentStageIndex === -1 && stageIndex === 0)) {
    return "ready";
  }
  return "pending";
}

function createStageProjection(
  run: RunManifest,
  currentStageIndex: number
): readonly BuildStageProjection[] {
  return BUILD_STAGES.map((stage, stageIndex) => {
    const artifacts = run.artifacts.filter((artifact) => includesPhase(stage.id, artifact.phase));
    const latest = latestArtifact(artifacts);
    return {
      id: stage.id,
      code: stage.code,
      name: stage.name,
      summary: stage.summary,
      status: stageStatus(stageIndex, currentStageIndex, artifacts.length, run.status),
      artifactCount: artifacts.length,
      requiredOutputs: stage.requiredOutputs,
      qualityGate: stage.qualityGate,
      ...(latest ? { latestArtifactTitle: latest.title } : {})
    };
  });
}

function createLaneProjection(run: RunManifest): readonly BuildLaneProjection[] {
  return BUILD_LANES.map((lane) => {
    const artifacts = run.artifacts.filter((artifact) => LANE_ARTIFACT_KINDS[lane.id].includes(artifact.kind));
    const latest = latestArtifact(artifacts);
    return {
      id: lane.id,
      title: lane.title,
      tag: lane.tag,
      body: lane.body,
      primaryArtifacts: lane.primaryArtifacts,
      artifactCount: artifacts.length,
      ...(latest ? { latestArtifactTitle: latest.title } : {})
    };
  });
}

function hasArtifactKinds(run: RunManifest, kinds: readonly ArtifactMetadata["kind"][]): boolean {
  return run.artifacts.some((artifact) => kinds.includes(artifact.kind));
}

const DELIVERY_GATE_KINDS: Record<BuildDeliveryGateProjection["id"], readonly ArtifactMetadata["kind"][]> = {
  repro: ["hypothesis", "finding"],
  patch: ["test", "report"],
  regression: ["test"],
  approval: ["finding", "report"],
  release: ["report"]
};

function createDeliveryGateProjection(run: RunManifest): readonly BuildDeliveryGateProjection[] {
  const statuses = {
    repro: hasArtifactKinds(run, DELIVERY_GATE_KINDS.repro),
    patch: hasArtifactKinds(run, DELIVERY_GATE_KINDS.patch),
    regression: hasArtifactKinds(run, DELIVERY_GATE_KINDS.regression),
    approval: hasArtifactKinds(run, DELIVERY_GATE_KINDS.approval),
    release: hasArtifactKinds(run, DELIVERY_GATE_KINDS.release)
  } as const;

  let unlocked = true;
  return DELIVERY_GATES.map((gate) => {
    const completed = statuses[gate.id];
    const status: BuildDeliveryGateProjection["status"] =
      completed ? "completed" : unlocked ? "ready" : "pending";
    const gateArtifacts = run.artifacts.filter((artifact) => DELIVERY_GATE_KINDS[gate.id].includes(artifact.kind));
    const latest = latestArtifact(gateArtifacts);
    unlocked = unlocked && completed;
    return {
      id: gate.id,
      title: gate.title,
      summary: gate.summary,
      evidenceHint: gate.evidenceHint,
      status,
      artifactCount: gateArtifacts.length,
      ...(latest ? { latestArtifactTitle: latest.title } : {})
    };
  });
}

function latestForPhaseSet(
  run: RunManifest,
  phases: readonly MethodologyPhase[]
): ArtifactMetadata | undefined {
  return latestArtifact(run.artifacts.filter((artifact) => phases.includes(artifact.phase)));
}

export function rebuildBuildRoomProjection(input: {
  readonly manifest: RunManifest;
  readonly failureDetail?: string;
}): BuildRoomProjection {
  const currentStageId = getCurrentStageId(input.manifest);
  const currentStageIndex = currentStageId
    ? BUILD_STAGES.findIndex((stage) => stage.id === currentStageId)
    : -1;
  const stages = createStageProjection(input.manifest, currentStageIndex);
  const completedStages = stages.filter((stage) => stage.status === "completed").length;
  const intentArtifact = latestForPhaseSet(input.manifest, ["synthesis-intent"]);
  const architectureArtifact = latestForPhaseSet(input.manifest, [
    "synthesis-actors",
    "synthesis-entry-exit",
    "synthesis-functions"
  ]);
  const designArtifact = latestForPhaseSet(input.manifest, ["synthesis-invariants", "visual-flow-map"]);
  const releaseArtifact = latestForPhaseSet(input.manifest, ["audit-report"]);

  return {
    missionControl: {
      runId: input.manifest.runId,
      sessionId: input.manifest.sessionId,
      runStatus: input.manifest.status,
      currentStage: currentStageId,
      completedStages,
      totalStages: BUILD_STAGES.length,
      readyForBuild:
        stages.find((stage) => stage.id === "discover")?.artifactCount !== 0 &&
        stages.find((stage) => stage.id === "plan")?.artifactCount !== 0 &&
        stages.find((stage) => stage.id === "design")?.artifactCount !== 0
      ,
      ...(input.failureDetail ? { lastFailure: input.failureDetail } : {})
    },
    stages,
    lanes: createLaneProjection(input.manifest),
    deliveryGates: createDeliveryGateProjection(input.manifest),
    sourcePack: {
      intentTitle: intentArtifact?.title ?? "Intent brief pending",
      architectureTitle: architectureArtifact?.title ?? "Architecture outline pending",
      designTitle: designArtifact?.title ?? "System diagram pending",
      releaseTitle: releaseArtifact?.title ?? "Ship packet pending"
    }
  };
}
