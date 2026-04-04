export function createEventClient(baseUrl) {
    const url = `${baseUrl}/api/events`;
    const listeners = new Set();
    let eventSource = null;
    let retryTimer = null;
    let isClosed = false;
    function connect() {
        if (isClosed)
            return;
        if (eventSource)
            return;
        eventSource = new EventSource(url);
        eventSource.onmessage = (e) => {
            try {
                const event = JSON.parse(e.data);
                for (const listener of listeners) {
                    listener(event);
                }
            }
            catch (err) {
                console.error("Failed to parse SSE message:", err);
            }
        };
        eventSource.onerror = () => {
            // Browser EventSource auto-reconnects, but we can do manual cleanup
            // if the connection hard fails. We let the browser handle standard
            // reconnects, but log it for visibility.
            console.warn("SSE connection error, browser will attempt reconnect.");
        };
    }
    function disconnect() {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
        }
    }
    return {
        subscribe: (listener) => {
            listeners.add(listener);
            if (listeners.size > 0 && !eventSource) {
                connect();
            }
        },
        unsubscribe: (listener) => {
            listeners.delete(listener);
            if (listeners.size === 0) {
                disconnect();
            }
        },
        close: () => {
            isClosed = true;
            listeners.clear();
            disconnect();
        }
    };
}
//# sourceMappingURL=event-client.js.map