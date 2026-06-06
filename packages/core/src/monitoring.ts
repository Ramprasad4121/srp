import type { Incident, RuntimeSignal } from "./types.ts";
import { stableId } from "./utils.ts";

export class RuntimeSecurityLayer {
  private readonly incidents: Incident[] = [];

  ingest(signal: RuntimeSignal): Incident | undefined {
    if (signal.value <= signal.threshold) return undefined;
    const incident: Incident = {
      id: stableId("incident", `${signal.protocol}:${signal.chain}:${signal.source}:${signal.metric}:${Date.now()}`),
      protocol: signal.protocol,
      severity: signal.value >= signal.threshold * 2 ? "high" : "medium",
      title: `${signal.source} anomaly detected for ${signal.metric}`,
      evidence: [
        `${signal.metric}=${signal.value}`,
        `threshold=${signal.threshold}`,
        `chain=${signal.chain}`,
        `source=${signal.source}`
      ],
      createdAt: new Date().toISOString(),
      status: "open"
    };
    this.incidents.push(incident);
    return incident;
  }

  list(): Incident[] {
    return [...this.incidents];
  }

  health(protocol: string): { protocol: string; openIncidents: number; status: "healthy" | "degraded" | "critical" } {
    const open = this.incidents.filter((incident) => incident.protocol === protocol && incident.status === "open");
    return {
      protocol,
      openIncidents: open.length,
      status: open.some((incident) => incident.severity === "critical" || incident.severity === "high") ? "critical" : open.length ? "degraded" : "healthy"
    };
  }
}
