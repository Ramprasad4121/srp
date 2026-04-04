import type { AppBootstrapResult, InternetMode, ProviderSelection, RuntimeMode, SetupManifest } from "@srp/shared-types";
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
export type ApiResult<T> = {
    readonly ok: true;
    readonly data: T;
} | {
    readonly ok: false;
    readonly error: string;
    readonly detail?: string;
};
export declare function createGatewayClient(baseUrl: string): {
    /** GET /api/bootstrap */
    readonly getBootstrap: () => Promise<ApiResult<AppBootstrapResult>>;
    /** GET /api/setup */
    readonly getSetup: () => Promise<ApiResult<SetupResponse>>;
    /** POST /api/setup/role */
    readonly setRole: (role: RuntimeMode) => Promise<ApiResult<SetupResponse>>;
    /** POST /api/setup/providers */
    readonly setProviders: (providers: readonly ProviderSelection[]) => Promise<ApiResult<SetupResponse>>;
    /** POST /api/setup/workspace */
    readonly setWorkspace: (patch: {
        readonly rootDirectory?: string;
        readonly outputDirectory?: string;
        readonly useDockerToolchains?: boolean;
        readonly internetMode?: InternetMode;
    }) => Promise<ApiResult<SetupResponse>>;
    /** POST /api/setup/complete/welcome */
    readonly completeWelcome: () => Promise<ApiResult<SetupResponse>>;
    /** POST /api/setup/complete/providers */
    readonly completeProviders: () => Promise<ApiResult<SetupResponse>>;
    /** POST /api/setup/complete/workspace */
    readonly completeWorkspace: () => Promise<ApiResult<SetupResponse>>;
};
export type GatewayClient = ReturnType<typeof createGatewayClient>;
//# sourceMappingURL=gateway-client.d.ts.map