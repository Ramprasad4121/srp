import type {
  AppBootstrapResult,
  InternetMode,
  ProviderSelection,
  RuntimeMode,
  SetupManifest
} from "@srp/shared-types";

// ---------------------------------------------------------------------------
// Gateway API client — typed fetch wrappers
// ---------------------------------------------------------------------------

export interface SetupResponse {
  readonly ok: true;
  readonly manifest: SetupManifest;
  readonly onboarding: {
    readonly complete: boolean;
    readonly currentStep: string;
    readonly nextStep: string;
    readonly completedCount: number;
    readonly totalCount: number;
    readonly incompleteSteps: readonly string[];
  };
}

export interface ApiErrorResponse {
  readonly error: string;
  readonly detail?: string;
}

export type ApiResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: string; readonly detail?: string };

async function apiRequest<T>(
  baseUrl: string,
  path: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });

    const body = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      const errBody = body as unknown as ApiErrorResponse;
      return {
        ok: false,
        error: errBody.error ?? "request_failed",
        detail: errBody.detail ?? `HTTP ${res.status}`
      };
    }

    return { ok: true, data: body as T };
  } catch (err) {
    return {
      ok: false,
      error: "network_error",
      detail: err instanceof Error ? err.message : String(err)
    };
  }
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

export function createGatewayClient(baseUrl: string) {
  return {
    /** GET /api/bootstrap */
    async getBootstrap(): Promise<ApiResult<AppBootstrapResult>> {
      return apiRequest<AppBootstrapResult>(baseUrl, "/api/bootstrap");
    },

    /** GET /api/setup */
    async getSetup(): Promise<ApiResult<SetupResponse>> {
      return apiRequest<SetupResponse>(baseUrl, "/api/setup");
    },

    /** POST /api/setup/role */
    async setRole(role: RuntimeMode): Promise<ApiResult<SetupResponse>> {
      return apiRequest<SetupResponse>(baseUrl, "/api/setup/role", {
        method: "POST",
        body: JSON.stringify({ role })
      });
    },

    /** POST /api/setup/providers */
    async setProviders(
      providers: readonly ProviderSelection[]
    ): Promise<ApiResult<SetupResponse>> {
      return apiRequest<SetupResponse>(baseUrl, "/api/setup/providers", {
        method: "POST",
        body: JSON.stringify({ providers })
      });
    },

    /** POST /api/setup/workspace */
    async setWorkspace(patch: {
      readonly rootDirectory?: string;
      readonly outputDirectory?: string;
      readonly useDockerToolchains?: boolean;
      readonly internetMode?: InternetMode;
    }): Promise<ApiResult<SetupResponse>> {
      return apiRequest<SetupResponse>(baseUrl, "/api/setup/workspace", {
        method: "POST",
        body: JSON.stringify(patch)
      });
    },

    /** POST /api/setup/complete/welcome */
    async completeWelcome(): Promise<ApiResult<SetupResponse>> {
      return apiRequest<SetupResponse>(baseUrl, "/api/setup/complete/welcome", {
        method: "POST",
        body: "{}"
      });
    },

    /** POST /api/setup/complete/providers */
    async completeProviders(): Promise<ApiResult<SetupResponse>> {
      return apiRequest<SetupResponse>(baseUrl, "/api/setup/complete/providers", {
        method: "POST",
        body: "{}"
      });
    },

    /** POST /api/setup/complete/workspace */
    async completeWorkspace(): Promise<ApiResult<SetupResponse>> {
      return apiRequest<SetupResponse>(baseUrl, "/api/setup/complete/workspace", {
        method: "POST",
        body: "{}"
      });
    },

    /** POST /api/runtime/start */
    async startSession(): Promise<ApiResult<any>> {
      return apiRequest<any>(baseUrl, "/api/runtime/start", {
        method: "POST",
        body: "{}"
      });
    },

    // ---------------------------------------------------------------------------
    // Chat & Skills
    // ---------------------------------------------------------------------------

    /** GET /api/chat/conversations */
    async getConversations(): Promise<ApiResult<any[]>> {
      return apiRequest<any[]>(baseUrl, "/api/chat/conversations");
    },

    /** POST /api/chat/conversations */
    async createConversation(title: string): Promise<ApiResult<any>> {
      return apiRequest<any>(baseUrl, "/api/chat/conversations", {
        method: "POST",
        body: JSON.stringify({ title })
      });
    },

    /** GET /api/chat/conversations/:id */
    async getConversation(id: string): Promise<ApiResult<any>> {
      return apiRequest<any>(baseUrl, `/api/chat/conversations/${id}`);
    },

    /** POST /api/chat/conversations/:id/messages */
    async addMessage(id: string, content: string, options: { searchEnabled?: boolean } = {}): Promise<ApiResult<{ userMessage: any, assistantMessage: any }>> {
      return apiRequest<any>(baseUrl, `/api/chat/conversations/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content, searchEnabled: options.searchEnabled })
      });
    },

    /** GET /api/skills */
    async getSkills(): Promise<ApiResult<any[]>> {
      return apiRequest<any[]>(baseUrl, "/api/skills");
    }
  } as const;
}

export type GatewayClient = ReturnType<typeof createGatewayClient>;
