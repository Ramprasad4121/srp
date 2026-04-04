import type { 
  AppBootstrapResult, 
  RuntimeSessionState, 
  SetupManifest, 
  RuntimeMode,
  MethodologyPhase
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

  async startRuntime(mode: RuntimeMode): Promise<void> {
    await this.request("/runtime/start", {
      method: "POST",
      body: JSON.stringify({ mode }),
      headers: { "Content-Type": "application/json" }
    });
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

  async addMessage(id: string, content: string): Promise<{ok: boolean, data: any, error?: string, detail?: string}> {
    try {
      const data = await this.request<any>(`/chat/conversations/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
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
