import { createArtifactRecord } from "@srp/artifacts";

export function createWorkerBootstrapArtifact() {
  return createArtifactRecord({
    artifactId: "bootstrap-artifact",
    projectId: "workspace",
    runId: "bootstrap-run",
    kind: "report",
    title: "Bootstrap Artifact",
    phase: "visual-flow-map"
  });
}
