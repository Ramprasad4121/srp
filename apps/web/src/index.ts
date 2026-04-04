export * from "./lib-index.js";

// Import the app components so they are registered in the custom elements registry
import "./srp-app.js";

// Force inclusion of API clients for tests
import "./api/client.js";
import "./api/gateway-client.js";
import "./api/runtime-client.js";
import "./api/event-client.js";
