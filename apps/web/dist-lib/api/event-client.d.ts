import type { SrpEvent } from "@srp/events";
export interface EventClient {
    readonly subscribe: (listener: (event: SrpEvent) => void) => void;
    readonly unsubscribe: (listener: (event: SrpEvent) => void) => void;
    readonly close: () => void;
}
export declare function createEventClient(baseUrl: string): EventClient;
//# sourceMappingURL=event-client.d.ts.map