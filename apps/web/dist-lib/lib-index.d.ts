import type { AppBootstrapResult, RuntimeMode, SetupManifest, SetupStep, RuntimeSessionState } from "@srp/shared-types";
export interface WebNavigationItem {
    readonly id: string;
    readonly label: string;
    readonly supportedModes: readonly RuntimeMode[];
}
export declare const primaryNavigation: readonly WebNavigationItem[];
export interface SetupScreenDefinition {
    readonly step: SetupStep;
    readonly title: string;
}
export declare const setupScreens: readonly SetupScreenDefinition[];
export declare const webDefaults: {
    readonly defaultInternetMode: import("@srp/shared-types").InternetMode;
    readonly defaultLandingPage: "overview";
};
export declare const providerCards: {
    kind: import("@srp/shared-types").ProviderKind;
    label: string;
    defaultModel: string;
    supportsTools: boolean;
}[];
export declare const internetPolicySummary: string;
export declare const onboardingChecklist: readonly import("@srp/config").SetupChecklistItem[];
export declare const providerSetupSummary: import("@srp/config").ProviderSetupSummary;
export declare const onboardingHero: {
    readonly currentStep: SetupStep;
    readonly role: RuntimeMode;
    readonly readyItems: number;
    readonly totalItems: number;
};
export declare const onboardingProgression: {
    readonly initialStep: SetupStep;
    readonly afterWelcome: SetupStep;
    readonly afterProviders: SetupStep;
    readonly nextIncompleteStep: SetupStep;
};
export interface WebOnboardingViewModel {
    readonly currentStep: string;
    readonly nextStep: string;
    readonly readyItems: number;
    readonly totalItems: number;
    readonly providerConfigured: number;
    readonly providerHealthy: number;
    readonly failingProviderKinds: readonly string[];
}
export declare function createWebOnboardingViewModel(manifest: SetupManifest, environment: NodeJS.ProcessEnv): WebOnboardingViewModel;
export interface ModelsProvidersViewModel {
    readonly role: RuntimeMode;
    readonly defaultTask: string;
    readonly recommendedProviderKinds: readonly string[];
    readonly selectedProviderKinds: readonly string[];
    readonly providerCards: readonly {
        kind: string;
        label: string;
        defaultModel: string;
        supportsTools: boolean;
        recommended: boolean;
        selected: boolean;
    }[];
}
export interface WorkspaceViewModel {
    readonly rootDirectory: string;
    readonly outputDirectory: string;
    readonly useDockerToolchains: boolean;
    readonly internetMode: string;
    readonly internetSummary: string;
}
export declare function createModelsProvidersViewModel(manifest: SetupManifest): ModelsProvidersViewModel;
export declare function createWorkspaceViewModel(manifest: SetupManifest): WorkspaceViewModel;
export interface NavigationBootstrap {
    /** The route the app shell should navigate to on load. */
    readonly initialRoute: string;
    /** Nav items visible for the current role. */
    readonly visibleNavItems: readonly WebNavigationItem[];
    /** Whether the setup/onboarding flow should be shown instead of the main shell. */
    readonly showOnboarding: boolean;
    /** Onboarding progress 0–1. */
    readonly onboardingProgress: number;
    /** If false the user has no working provider and should be warned. */
    readonly hasWorkingProvider: boolean;
    /** The role string for role-aware rendering. */
    readonly role: string;
}
export interface OverviewViewModel {
    readonly protocolName: string;
    readonly protocolType: string;
    readonly currentPhase: string;
    readonly auditHealth: "healthy" | "at-risk" | "critical";
    readonly runId: string;
    readonly lastUpdated: string;
    readonly valueProposition: string;
    readonly moneyInMoneyOut: string;
    readonly adversarialActors: readonly string[];
    readonly worstCaseOutcome: string;
    readonly metrics: {
        readonly contractsInScope: number;
        readonly externalDependencies: number;
        readonly invariantsExtracted: number;
        readonly openQuestions: number;
        readonly pendingHypotheses: number;
        readonly validatedFindings: number;
    };
}
export declare function createOverviewViewModel(sessionState: RuntimeSessionState, manifest: SetupManifest): OverviewViewModel;
export declare function deriveNavigationBootstrap(bootstrap: AppBootstrapResult): NavigationBootstrap;
//# sourceMappingURL=lib-index.d.ts.map