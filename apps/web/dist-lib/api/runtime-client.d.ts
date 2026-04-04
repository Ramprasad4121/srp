import type { RuntimeSessionState } from "@srp/shared-types";
import type { ApiResult } from "./gateway-client.js";
export declare function createRuntimeClient(baseUrl: string): {
    readonly getSessionState: () => Promise<ApiResult<RuntimeSessionState>>;
    readonly startSession: () => Promise<ApiResult<RuntimeSessionState>>;
};
export type RuntimeClient = ReturnType<typeof createRuntimeClient>;
//# sourceMappingURL=runtime-client.d.ts.map