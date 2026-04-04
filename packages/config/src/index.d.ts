import type { ApprovedDomainRule, InternetMode, ProviderSelection, RuntimeMode, SetupManifest, SetupState, SetupStep, WorkspaceSelection } from "@srp/shared-types";
export declare const runtimeModes: readonly RuntimeMode[];
export declare const setupSteps: readonly SetupStep[];
export declare const defaultRuntimeMode: RuntimeMode;
export declare const defaultInternetMode: InternetMode;
export interface ModelPolicy {
    readonly defaultTask: "chat" | "analysis" | "generation";
    readonly fallbackOrder: readonly string[];
}
export declare const defaultModelPolicy: ModelPolicy;
export interface SetupDefaults {
    readonly role: RuntimeMode;
    readonly internetMode: InternetMode;
    readonly providers: readonly ProviderSelection[];
    readonly workspace: WorkspaceSelection;
    readonly approvedDomains: readonly ApprovedDomainRule[];
}
export declare const defaultSetupDefaults: SetupDefaults;
export declare function createInitialSetupState(overrides?: Partial<Pick<SetupState, "role" | "providers" | "workspace">>): SetupState;
export declare function advanceSetupState(state: SetupState, nextStep: SetupStep): SetupState;
export declare function markSetupStepCompleted(state: SetupState, step: SetupStep): SetupState;
export declare const defaultSetupConfigRelativePath: string;
export interface SetupChecklistItem {
    readonly step: SetupStep;
    readonly complete: boolean;
    readonly reason: string;
}
export interface ProviderSetupSummary {
    readonly enabledCount: number;
    readonly readyCount: number;
    readonly missingProviderKinds: readonly string[];
}
export declare function createSetupManifest(overrides?: Partial<Pick<SetupManifest, "approvedDomains" | "state" | "version">>): SetupManifest;
export declare function getSetupConfigPath(rootDirectory: string): string;
export declare function loadSetupManifest(rootDirectory: string): Promise<SetupManifest | null>;
export declare function saveSetupManifest(rootDirectory: string, manifest: SetupManifest): Promise<string>;
export declare function summarizeProviderSetup(providers: readonly ProviderSelection[]): ProviderSetupSummary;
export declare function createSetupChecklist(manifest: SetupManifest): readonly SetupChecklistItem[];
export declare function getNextSetupStep(manifest: SetupManifest): SetupStep;
export declare function createWelcomeMessage(manifest: SetupManifest): string;
//# sourceMappingURL=index.d.ts.map