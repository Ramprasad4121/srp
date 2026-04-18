import type { 
  AppBootstrapResult, 
  RuntimeSessionState, 
  SetupManifest, 
  RuntimeMode,
  MethodologyPhase,
  RunManifest,
  AuditRoomProjection,
  BuildRoomProjection,
  FactoryControlPlaneProjection,
  RunEventLogEntry
} from "@srp/shared-types";

export class GatewayClient {
  constructor(private readonly baseUrl: string = "/api") {}

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, options);
    if (!res.ok) {
      throw new Error(`Gateway request failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  async getBootstrap(): Promise<AppBootstrapResult> {
    return this.request<AppBootstrapResult>("/bootstrap");
  }

  async getSetup(): Promise<{ manifest: SetupManifest }> {
    return this.request<{ manifest: SetupManifest }>("/setup");
  }

  async getRuntime(): Promise<RuntimeSessionState> {
    return this.request<RuntimeSessionState>("/runtime");
  }

  async getRuns(): Promise<readonly RunManifest[]> {
    return this.request<readonly RunManifest[]>("/runs");
  }

  async getRun(runId: string): Promise<RunManifest> {
    return this.request<RunManifest>(`/runs/${runId}`);
  }

  async getRunArtifact(runId: string, artifactId: string): Promise<unknown> {
    return this.request<unknown>(`/runs/${runId}/artifacts/${artifactId}`);
  }

  async getRunEvents(runId: string): Promise<readonly RunEventLogEntry[]> {
    return this.request<readonly RunEventLogEntry[]>(`/runs/${runId}/events`);
  }

  async getRunProjection(runId: string): Promise<AuditRoomProjection> {
    return this.request<AuditRoomProjection>(`/runs/${runId}/projection`);
  }

  async getRunBuildProjection(runId: string): Promise<BuildRoomProjection> {
    return this.request<BuildRoomProjection>(`/runs/${runId}/build-projection`);
  }

  async getControlPlane(): Promise<FactoryControlPlaneProjection> {
    return this.request<FactoryControlPlaneProjection>("/control-plane");
  }

  async startRuntime(mode: RuntimeMode): Promise<void> {
    await this.request("/runtime/start", {
      method: "POST",
      body: JSON.stringify({ mode }),
      headers: { "Content-Type": "application/json" }
    });
  }

  async startSession(): Promise<{ok: boolean, data: any, error?: string}> {
    try {
      const data = await this.request<any>("/runtime/start", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" }
      });
      return { ok: true, data };
    } catch (e: any) {
      return { ok: false, data: null, error: e.message };
    }
  }

  async setRole(role: RuntimeMode): Promise<{ok: boolean, data: any, error?: string}> {
    try {
      const data = await this.request<any>("/setup/role", {
        method: "POST",
        body: JSON.stringify({ role }),
        headers: { "Content-Type": "application/json" }
      });
      return { ok: true, data };
    } catch (e: any) {
      return { ok: false, data: null, error: e.message };
    }
  }

  async getConversations(): Promise<{ok: boolean, data: any, error?: string}> {
    try {
      const data = await this.request<any[]>("/chat/conversations");
      return { ok: true, data };
    } catch (e: any) {
      return { ok: false, data: [], error: e.message };
    }
  }

  async createConversation(title: string): Promise<{ok: boolean, data: any, error?: string}> {
    try {
      const data = await this.request<any>("/chat/conversations", {
        method: "POST",
        body: JSON.stringify({ title }),
        headers: { "Content-Type": "application/json" }
      });
      return { ok: true, data };
    } catch (e: any) {
      return { ok: false, data: null, error: e.message };
    }
  }

  async addMessage(id: string, content: string, options: { searchEnabled?: boolean } = {}): Promise<{ok: boolean, data: any, error?: string, detail?: string}> {
    try {
      const data = await this.request<any>(`/chat/conversations/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content, searchEnabled: options.searchEnabled }),
        headers: { "Content-Type": "application/json" }
      });
      return { ok: true, data };
    } catch (e: any) {
      return { ok: false, data: null, error: "Network Error", detail: e.message };
    }
  }

  async getSkills(): Promise<{ok: boolean, data: any[], error?: string}> {
    try {
      const data = await this.request<any[]>("/skills");
      return { ok: true, data };
    } catch (e: any) {
      return { ok: false, data: [], error: e.message };
    }
  }
}

export const gatewayClient = new GatewayClient();
