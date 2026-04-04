/**
 * Determines the initial onboarding screen from the bootstrap decision.
 */
export function deriveInitialOnboardingScreen(bootstrap) {
    if (bootstrap.decision === "needs-providers") {
        // User already completed basic onboarding but providers are unhealthy
        return "providers";
    }
    const step = bootstrap.onboarding.currentStep;
    switch (step) {
        case "welcome":
            return "welcome";
        case "role-selection":
            return "role";
        case "providers":
            return "providers";
        case "toolchain":
        case "skills":
        case "workspace":
        case "ui-preferences":
            return "workspace";
        case "ready":
            return "complete";
        default:
            return "welcome";
    }
}
export function createOnboardingState(bootstrap) {
    return {
        currentScreen: deriveInitialOnboardingScreen(bootstrap),
        bootstrap,
        setupData: null
    };
}
// ---------------------------------------------------------------------------
// Onboarding actions — each calls the gateway and returns updated state
// ---------------------------------------------------------------------------
export async function submitWelcome(client, state) {
    const result = await client.completeWelcome();
    if (!result.ok)
        return state;
    return {
        ...state,
        currentScreen: "role",
        setupData: result.data
    };
}
export async function submitRole(client, state, role) {
    const result = await client.setRole(role);
    if (!result.ok)
        return state;
    return {
        ...state,
        currentScreen: "providers",
        setupData: result.data
    };
}
export async function submitProviders(client, state, providers) {
    const setResult = await client.setProviders(providers);
    if (!setResult.ok)
        return state;
    const completeResult = await client.completeProviders();
    if (!completeResult.ok) {
        return { ...state, setupData: setResult.data };
    }
    return {
        ...state,
        currentScreen: "workspace",
        setupData: completeResult.data
    };
}
export async function submitWorkspace(client, state, patch) {
    const setResult = await client.setWorkspace(patch);
    if (!setResult.ok)
        return state;
    const completeResult = await client.completeWorkspace();
    if (!completeResult.ok) {
        return { ...state, setupData: setResult.data };
    }
    return {
        ...state,
        currentScreen: "complete",
        setupData: completeResult.data
    };
}
// ---------------------------------------------------------------------------
// Progression helpers
// ---------------------------------------------------------------------------
export const onboardingScreenOrder = [
    "welcome",
    "role",
    "providers",
    "workspace",
    "complete"
];
export function getOnboardingProgress(screen) {
    const index = onboardingScreenOrder.indexOf(screen);
    return index >= 0 ? index / (onboardingScreenOrder.length - 1) : 0;
}
export function getOnboardingStepNumber(screen) {
    const index = onboardingScreenOrder.indexOf(screen);
    return index >= 0 ? index + 1 : 1;
}
export function getOnboardingTotalSteps() {
    return onboardingScreenOrder.length;
}
//# sourceMappingURL=onboarding-state.js.map