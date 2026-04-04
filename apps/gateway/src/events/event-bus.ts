import type { SrpEvent } from "@srp/events";
import { EventEmitter } from "node:events";

// ---------------------------------------------------------------------------
// Server-side Event Bus
// ---------------------------------------------------------------------------

export interface GatewayEventBus {
  /** Registers a listener and returns an unsubscribe function. */
  readonly subscribe: (listener: (event: SrpEvent) => void) => () => void;
  /** Emits an event to all subscribers. */
  readonly emit: (event: SrpEvent) => void;
}

export function createGatewayEventBus(): GatewayEventBus {
  const emitter = new EventEmitter();
  // Increase max listeners since each SSE connection adds one
  emitter.setMaxListeners(100);

  return {
    subscribe: (listener: (event: SrpEvent) => void) => {
      emitter.on("srp-event", listener);
      return () => {
        emitter.off("srp-event", listener);
      };
    },
    emit: (event: SrpEvent) => {
      emitter.emit("srp-event", event);
    }
  };
}

// Global shared bus for the gateway
export const sharedEventBus = createGatewayEventBus();
