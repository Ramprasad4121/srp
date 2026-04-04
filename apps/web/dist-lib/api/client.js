export class GatewayClient {
    baseUrl;
    constructor(baseUrl = "/api") {
        this.baseUrl = baseUrl;
    }
    async request(path, options) {
        const res = await fetch(`${this.baseUrl}${path}`, options);
        if (!res.ok) {
            throw new Error(`Gateway request failed: ${res.status} ${res.statusText}`);
        }
        return res.json();
    }
    async getBootstrap() {
        return this.request("/bootstrap");
    }
    async getSetup() {
        return this.request("/setup");
    }
    async getRuntime() {
        return this.request("/runtime");
    }
    async startRuntime(mode) {
        await this.request("/runtime/start", {
            method: "POST",
            body: JSON.stringify({ mode }),
            headers: { "Content-Type": "application/json" }
        });
    }
}
export const gatewayClient = new GatewayClient();
//# sourceMappingURL=client.js.map