import { completeProviderSetup, completeWelcomeStep, createInitialSetupState, createSetupChecklist, createSetupManifest, defaultInternetMode, defaultSetupDefaults, getModelPolicyForMode, getNextSetupStep, getRuntimeModeDefaults, runtimeModes, setupSteps, summarizeProviderSetup } from "@srp/config";
import { createRecommendedProviderSelections, evaluateProviderSetHealth, providerCatalog, summarizeProviderHealth } from "@srp/providers";
import { createInternetPolicy, describeInternetPolicy } from "@srp/security";
export const primaryNavigation = [
    { id: "overview", label: "Overview", supportedModes: runtimeModes },
    { id: "audit-flow", label: "Audit Flow", supportedModes: ["auditor", "hybrid"] },
    { id: "protocol-map", label: "Protocol Map", supportedModes: ["auditor", "hybrid"] },
    { id: "contracts", label: "Contracts", supportedModes: ["auditor", "hybrid"] },
    { id: "functions", label: "Functions", supportedModes: ["auditor", "hybrid"] },
    { id: "invariants", label: "Invariants", supportedModes: ["auditor", "hybrid"] },
    { id: "hypotheses", label: "Hypotheses", supportedModes: ["auditor", "hybrid"] },
    { id: "questions", label: "Questions", supportedModes: ["auditor", "hybrid"] },
    { id: "economic-risks", label: "Economic Risks", supportedModes: ["auditor", "hybrid"] },
    { id: "cross-contract-paths", label: "Cross-Contract Paths", supportedModes: ["auditor", "hybrid"] },
    { id: "findings", label: "Findings", supportedModes: ["auditor", "hybrid"] },
    { id: "pocs", label: "PoCs", supportedModes: ["auditor", "hybrid"] },
    { id: "report", label: "Report", supportedModes: ["auditor", "hybrid"] },
    { id: "dev", label: "Developer Workbench", supportedModes: ["developer", "hybrid"] },
    { id: "chat", label: "Chat", supportedModes: runtimeModes },
    { id: "trace", label: "Run Trace", supportedModes: runtimeModes },
    { id: "settings", label: "Settings", supportedModes: runtimeModes }
];
export const setupScreens = setupSteps.map((step) => ({
    step,
    title: step
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
}));
export const webDefaults = {
    defaultInternetMode,
    defaultLandingPage: "overview"
};
export const providerCards = providerCatalog.map((provider) => ({
    kind: provider.kind,
    label: provider.label,
    defaultModel: provider.defaultModel,
    supportsTools: provider.supportsTools
}));
export const internetPolicySummary = describeInternetPolicy(createInternetPolicy(defaultSetupDefaults.internetMode, defaultSetupDefaults.approvedDomains));
const defaultManifest = createSetupManifest({
    state: createInitialSetupState()
});
const roleReadyManifest = createSetupManifest({
    state: completeWelcomeStep(defaultManifest.state)
});
const providersReadyManifest = createSetupManifest({
    state: completeProviderSetup(roleReadyManifest.state)
});
export const onboardingChecklist = createSetupChecklist(defaultManifest);
export const providerSetupSummary = summarizeProviderSetup(defaultManifest.state.providers);
export const onboardingHero = {
    currentStep: defaultManifest.state.currentStep,
    role: defaultManifest.state.role,
    readyItems: onboardingChecklist.filter((item) => item.complete).length,
    totalItems: onboardingChecklist.length
};
export const onboardingProgression = {
    initialStep: defaultManifest.state.currentStep,
    afterWelcome: roleReadyManifest.state.currentStep,
    afterProviders: providersReadyManifest.state.currentStep,
    nextIncompleteStep: getNextSetupStep(providersReadyManifest)
};
export function createWebOnboardingViewModel(manifest, environment) {
    const checklist = createSetupChecklist(manifest);
    const providerHealth = summarizeProviderHealth(evaluateProviderSetHealth(manifest.state.providers, environment));
    return {
        currentStep: manifest.state.currentStep,
        nextStep: getNextSetupStep(manifest),
        readyItems: checklist.filter((item) => item.complete).length,
        totalItems: checklist.length,
        providerConfigured: providerHealth.configured,
        providerHealthy: providerHealth.healthy,
        failingProviderKinds: providerHealth.failingKinds
    };
}
export function createModelsProvidersViewModel(manifest) {
    const runtimeDefaults = getRuntimeModeDefaults(manifest.state.role);
    const modelPolicy = getModelPolicyForMode(manifest.state.role);
    const recommendedKinds = createRecommendedProviderSelections(runtimeDefaults.recommendedProviderKinds).map((provider) => provider.kind);
    const selectedKinds = manifest.state.providers.filter((provider) => provider.enabled).map((provider) => provider.kind);
    return {
        role: manifest.state.role,
        defaultTask: modelPolicy.defaultTask,
        recommendedProviderKinds: recommendedKinds,
        selectedProviderKinds: selectedKinds,
        providerCards: providerCatalog.map((provider) => ({
            kind: provider.kind,
            label: provider.label,
            defaultModel: provider.defaultModel,
            supportsTools: provider.supportsTools,
            recommended: recommendedKinds.includes(provider.kind),
            selected: selectedKinds.includes(provider.kind)
        }))
    };
}
export function createWorkspaceViewModel(manifest) {
    return {
        rootDirectory: manifest.state.workspace.rootDirectory,
        outputDirectory: manifest.state.workspace.outputDirectory,
        useDockerToolchains: manifest.state.workspace.useDockerToolchains,
        internetMode: manifest.state.workspace.internetMode,
        internetSummary: describeInternetPolicy(createInternetPolicy(manifest.state.workspace.internetMode, manifest.approvedDomains))
    };
}
export function createOverviewViewModel(sessionState, manifest) {
    return {
        protocolName: "Generic Protocol",
        protocolType: "DeFi / Lending",
        currentPhase: sessionState.currentPhase || "Not Started",
        auditHealth: "healthy",
        runId: sessionState.runId || "N/A",
        lastUpdated: new Date().toISOString(),
        valueProposition: manifest.state.workspace.rootDirectory,
        moneyInMoneyOut: "N/A",
        adversarialActors: ["External Attacker", "Governance Admin"],
        worstCaseOutcome: "Complete drain of protocol liquidity.",
        metrics: {
            contractsInScope: sessionState.workspaceAnalysis?.solidityFileCount || 0,
            externalDependencies: 0,
            invariantsExtracted: sessionState.invariantRegistry?.invariants.length || 0,
            openQuestions: 0,
            pendingHypotheses: sessionState.hypothesisRegistry?.hypotheses.length || 0,
            validatedFindings: sessionState.findingRegistry?.findings.length || 0
        }
    };
}
export function deriveNavigationBootstrap(bootstrap) {
    const visibleNavItems = primaryNavigation.filter((item) => item.supportedModes.includes(bootstrap.role));
    const onboardingProgress = bootstrap.onboarding.totalCount > 0
        ? bootstrap.onboarding.completedCount / bootstrap.onboarding.totalCount
        : 0;
    return {
        initialRoute: bootstrap.initialRoute,
        visibleNavItems,
        showOnboarding: bootstrap.decision === "needs-onboarding",
        onboardingProgress,
        hasWorkingProvider: bootstrap.providers.anyHealthy,
        role: bootstrap.role
    };
}
//# sourceMappingURL=lib-index.js.map