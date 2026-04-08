export type RuntimeMode = "auditor" | "developer" | "hybrid";

export type SetupStep =
  | "welcome"
  | "role-selection"
  | "providers"
  | "toolchain"
  | "skills"
  | "workspace"
  | "ui-preferences"
  | "ready";

export type ProviderKind =
  | "anthropic"
  | "hugging-face"
  | "nvidia"
  | "ollama"
  | "openai"
  | "openrouter"
  | "openai-compatible";

export type InternetMode = "local-only" | "local-plus-docs" | "local-plus-approved-web" | "open-web";

export type ArtifactKind =
  | "diagram"
  | "finding"
  | "hypothesis"
  | "invariant"
  | "note"
  | "question"
  | "report"
  | "test";

export type SessionStatus = "idle" | "running" | "completed" | "failed";

export type MethodologyPhase =
  | "discovery-docs"
  | "discovery-audits"
  | "discovery-governance"
  | "discovery-tokenomics"
  | "discovery-onchain"
  | "synthesis-intent"
  | "synthesis-actors"
  | "synthesis-invariants"
  | "synthesis-entry-exit"
  | "synthesis-functions"
  | "visual-flow-map"
  | "audit-resolve-input"
  | "audit-setup"
  | "audit-map"
  | "audit-hunt"
  | "audit-attack"
  | "audit-verify"
  | "audit-report";

export interface IntelligenceArtifact {
  readonly id: string;
  readonly domain: "docs" | "audits" | "governance" | "tokenomics" | "onchain";
  readonly title: string;
  readonly url: string;
  readonly rawContent: string;
  readonly summary: string;
  readonly metadata: Record<string, any>;
  readonly analyzedAt: string;
}

export interface DiscoveryRegistry {
  readonly artifacts: readonly IntelligenceArtifact[];
  readonly totalSources: number;
}


export type PhaseStatus = "pending" | "running" | "completed" | "failed";

export interface PhaseState {
  readonly phase: MethodologyPhase;
  readonly status: PhaseStatus;
  readonly startedAt?: string;
  readonly completedAt?: string;
}

export interface WorkspaceAnalysis {
  readonly rootDirectory: string;
  readonly isFoundry: boolean;
  readonly isHardhat: boolean;
  readonly solidityFileCount: number;
  readonly solidityFiles: readonly string[];
  readonly externalFileCount: number;
  readonly externalFiles: readonly string[];
  readonly topLevelDirectories: readonly string[];
  readonly summary: string;
}

export interface CodebaseContextSummary {
  readonly filesProcessed: number;
  readonly bytesProcessed: number;
  readonly limitReached: boolean;
  readonly targetFiles: readonly string[];
}

export interface IntentSummary {
  readonly mainContracts: readonly string[];
  readonly interfaceCount: number;
  readonly draftSummary: string;
}

export interface ArchitectureSummary {
  readonly markdownSummary: string;
  readonly keyComponents: readonly string[];
  readonly generatedByModel: string;
}

export type ExcalidrawDiagramElement = Record<string, any>;

export interface ProtocolDiagram {
  readonly type: "excalidraw";
  readonly version: 2;
  readonly source: "srp";
  readonly title: string;
  readonly summary: string;
  readonly elements: readonly ExcalidrawDiagramElement[];
  readonly appState?: Record<string, any>;
  readonly files?: Record<string, any>;
  readonly generatedByModel: string;
}

export type InvariantPriority = "High" | "Medium" | "Low";

export interface InvariantItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly category: "Global" | "Function" | "Economic";
  readonly priority: InvariantPriority;
  readonly derivedFrom?: readonly string[];
  readonly suggestedVerification?: string;
}

export interface InvariantRegistry {
  readonly summary: string;
  readonly invariants: readonly InvariantItem[];
  readonly generatedByModel: string;
}

export type VerificationType = "Fuzzing" | "Formal" | "Manual" | "Static Analysis";
export type VerificationStatus = "Planned" | "Recommended" | "Skipped";

export interface VerificationPlanItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly coversInvariantIds: readonly string[];
  readonly verificationType: VerificationType;
  readonly status: VerificationStatus;
  readonly recommendedTool: string;
}

export interface VerificationPlan {
  readonly summary: string;
  readonly items: readonly VerificationPlanItem[];
  readonly generatedByModel: string;
}

export type HypothesisLikelihood = "High" | "Medium" | "Low";

export interface AttackHypothesis {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly attackSurface: string;
  readonly targetComponent: string;
  readonly derivedFromInvariantIds: readonly string[];
  readonly relatedVerificationIds: readonly string[];
  readonly likelihood: HypothesisLikelihood;
  readonly recommendedNextStep: string;
}

export interface HypothesisRegistry {
  readonly summary: string;
  readonly hypotheses: readonly AttackHypothesis[];
  readonly generatedByModel: string;
}

export type EconomicRiskSeverity = "Critical" | "High" | "Medium" | "Low";

export interface EconomicRiskItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly impact: string;
  readonly severity: EconomicRiskSeverity;
  readonly relevantComponents: readonly string[];
  readonly mitigationStrategy: string;
}

export interface EconomicAnalysis {
  readonly summary: string;
  readonly risks: readonly EconomicRiskItem[];
  readonly generatedByModel: string;
}

export interface CallPathStep {
  readonly contract: string;
  readonly method: string;
  readonly reason: string;
}

export interface CallPath {
  readonly id: string;
  readonly title: string;
  readonly steps: readonly CallPathStep[];
  readonly criticalPoints: readonly string[];
}

export interface CrossContractAnalysis {
  readonly summary: string;
  readonly paths: readonly CallPath[];
  readonly generatedByModel: string;
}

export type FindingSeverity = "Critical" | "High" | "Medium" | "Low" | "Informational";
export type FindingStatus = "Draft" | "Confirmed" | "False Positive" | "Mitigated";

export interface SecurityFinding {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly severity: FindingSeverity;
  readonly status: FindingStatus;
  readonly targetComponent: string;
  readonly derivedFromHypothesisId?: string;
  readonly derivedFromRiskId?: string;
  readonly impactedInvariantIds: readonly string[];
  readonly mitigation?: string;
  readonly proof?: ProofExecution;
}

export interface FindingRegistry {
  readonly summary: string;
  readonly findings: readonly SecurityFinding[];
  readonly generatedByModel: string;
}

export type RemediationComplexity = "Low" | "Medium" | "High";

export interface RemediationAction {
  readonly id: string;
  readonly relatedFindingId: string;
  readonly title: string;
  readonly description: string;
  readonly complexity: RemediationComplexity;
  readonly estimatedEffort: string;
  readonly technicalDebtImpact: string;
}

export interface RemediationPlan {
  readonly summary: string;
  readonly actions: readonly RemediationAction[];
  readonly generatedByModel: string;
}

export interface FormalReport {
  readonly id: string;
  readonly title: string;
  readonly markdownContent: string;
  readonly generatedAt: string;
  readonly generatedByModel: string;
}

export interface ToolchainExecution {
  readonly tool: string;
  readonly success: boolean;
  readonly logs: string;
  readonly generatedAt: string;
}

export interface ProofExecution {
  readonly findingId: string;
  readonly status: "proven" | "unproven" | "compile_error" | "skipped";
  readonly output: string;
  readonly testFile?: string;
  readonly generatedAt: string;
}

export interface ArtifactMetadata {
  readonly artifactId: string;
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly phase: MethodologyPhase;
  readonly createdAt: string;
  readonly runId: string;
  readonly projectId: string;
}

export interface RunManifest {
  readonly runId: string;
  readonly projectId: string;
  readonly sessionId: string;
  readonly status: SessionStatus;
  readonly createdAt: string;
  readonly completedAt?: string;
  readonly currentPhase?: MethodologyPhase;
  readonly artifacts: readonly ArtifactMetadata[];
}

export type RunEventType = "session.started" | "phase.status.changed" | "artifact.created";

export interface RunEventLogEntry {
  readonly eventId: string;
  readonly runId: string;
  readonly projectId: string;
  readonly type: RunEventType;
  readonly emittedAt: string;
  readonly phase?: MethodologyPhase;
  readonly status?: PhaseStatus;
  readonly artifactId?: string;
  readonly artifactKind?: ArtifactKind;
  readonly artifactTitle?: string;
}

export interface RuntimeSessionState {
  readonly hasSession: boolean;
  readonly isRunning: boolean;
  readonly sessionId: string | null;
  readonly runId: string | null;
  readonly currentPhase: MethodologyPhase | null;
  readonly phases: readonly PhaseState[];
  readonly discoveryRegistry?: DiscoveryRegistry;
  readonly workspaceAnalysis?: WorkspaceAnalysis;
  readonly codebaseContext?: CodebaseContextSummary;
  readonly intentSummary?: IntentSummary;
  readonly architectureSummary?: ArchitectureSummary;
  readonly protocolDiagram?: ProtocolDiagram;
  readonly invariantRegistry?: InvariantRegistry;
  readonly verificationPlan?: VerificationPlan;
  readonly hypothesisRegistry?: HypothesisRegistry;
  readonly functionAnnotations?: readonly any[];
  readonly questionLog?: readonly any[];
  readonly economicAnalysis?: EconomicAnalysis;
  readonly crossContractAnalysis?: CrossContractAnalysis;
  readonly entryExitMatrix?: EntryExitMatrix;
  readonly functionMap?: ProtocolFunctionMap;
  readonly findingRegistry?: FindingRegistry;
  readonly remediationPlan?: RemediationPlan;
  readonly formalReport?: FormalReport;
  readonly toolchainExecution?: ToolchainExecution;
  readonly agentRegistry?: AgentRegistryState;
  readonly knowledgeBus?: KnowledgeBusState;
}

// ---------------------------------------------------------------------------
// Agentic Factory & Hive Mind
// ---------------------------------------------------------------------------

export type AgentRole = "researcher" | "architect" | "auditor" | "developer" | "sentinel";

export interface AgentDefinition {
  readonly id: string;
  readonly name: string;
  readonly role: AgentRole;
  readonly skills: readonly string[];
  readonly toolAccess: readonly string[];
  readonly defaultModel?: string;
}

export interface AgentInstance {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly status: "idle" | "busy" | "finished" | "failed";
  readonly lastThought?: string;
  readonly activeTask?: string;
}

export interface AgentRegistryState {
  readonly definitions: readonly AgentDefinition[];
  readonly activeInstances: readonly AgentInstance[];
}

export type KnowledgeKind = "contract" | "actor" | "invariant" | "risk" | "flow";

export interface KnowledgeNode {
  readonly id: string;
  readonly kind: KnowledgeKind;
  readonly title: string;
  readonly data: any;
  readonly sourceAgentId: string;
  readonly discoveredAt: string;
}

export interface KnowledgeBusState {
  readonly nodes: readonly KnowledgeNode[];
  readonly lastUpdateAt: string;
}




export interface IdentifiedRecord {
  readonly projectId: string;
  readonly runId: string;
}

export interface ProviderSelection {
  readonly kind: ProviderKind;
  readonly label: string;
  readonly model: string;
  readonly enabled: boolean;
}

export interface WorkspaceSelection {
  readonly rootDirectory: string;
  readonly outputDirectory: string;
  readonly useDockerToolchains: boolean;
  readonly internetMode: InternetMode;
}

export interface ApprovedDomainRule {
  readonly hostname: string;
  readonly reason: string;
}

export interface ProviderCredentialProfile {
  readonly envVar: string;
  readonly required: boolean;
}

export interface ProviderDefinition {
  readonly kind: ProviderKind;
  readonly label: string;
  readonly authStrategy: "api-key" | "base-url" | "local";
  readonly supportsStreaming: boolean;
  readonly supportsTools: boolean;
  readonly supportsReasoning: boolean;
  readonly defaultModel: string;
  readonly credentialProfiles: readonly ProviderCredentialProfile[];
}

export interface SetupState {
  readonly currentStep: SetupStep;
  readonly completedSteps: readonly SetupStep[];
  readonly role: RuntimeMode;
  readonly providers: readonly ProviderSelection[];
  readonly workspace: WorkspaceSelection;
}

export interface SetupManifest {
  readonly version: string;
  readonly updatedAt: string;
  readonly approvedDomains: readonly ApprovedDomainRule[];
  readonly state: SetupState;
}

// ---------------------------------------------------------------------------
// Bootstrap contract — produced by gateway, consumed by web/CLI
// ---------------------------------------------------------------------------

export interface OnboardingReadiness {
  /** Whether the minimum required setup steps are complete. */
  readonly complete: boolean;
  /** The step the user should be on right now. */
  readonly currentStep: SetupStep;
  /** The next incomplete step. */
  readonly nextStep: SetupStep;
  /** Number of checklist items that are complete. */
  readonly completedCount: number;
  /** Total checklist items. */
  readonly totalCount: number;
  /** Steps that are still incomplete. */
  readonly incompleteSteps: readonly SetupStep[];
}

export interface ProviderHealthBundle {
  /** The provider kinds that are configured and healthy. */
  readonly healthyKinds: readonly ProviderKind[];
  /** The provider kinds that are failing (enabled but missing credentials). */
  readonly failingKinds: readonly ProviderKind[];
  /** Whether at least one provider is healthy and ready. */
  readonly anyHealthy: boolean;
  readonly total: number;
  readonly healthy: number;
  readonly configured: number;
}

export type BootstrapDecision =
  | "needs-onboarding"
  | "needs-providers"
  | "ready";

export interface AppBootstrapResult {
  /** The persisted setup manifest version. */
  readonly manifestVersion: string;
  /** ISO timestamp of the last manifest update. */
  readonly manifestUpdatedAt: string;
  /** The role the user configured (or the default). */
  readonly role: RuntimeMode;
  /** Onboarding readiness derived from the manifest. */
  readonly onboarding: OnboardingReadiness;
  /** Provider health evaluated against the current environment. */
  readonly providers: ProviderHealthBundle;
  /** High-level routing decision for the app shell. */
  readonly decision: BootstrapDecision;
  /** The initial route/page the app shell should navigate to. */
  readonly initialRoute: string;
  /** Absolute path to the setup manifest on disk. */
  readonly configPath: string;
}

// ---------------------------------------------------------------------------
// Chat Section (Phase 11)
// ---------------------------------------------------------------------------

export type ChatRole = "user" | "assistant" | "system";

export interface ChatCitation {
  readonly artifactId?: string;
  readonly artifactKind?: ArtifactKind;
  readonly artifactTitle?: string;
  readonly externalUrl?: string;
  readonly relevance: string;
}

export interface ChatMessage {
  readonly id: string;
  readonly role: ChatRole;
  readonly content: string;
  readonly createdAt: string;
  readonly citations?: readonly ChatCitation[];
  readonly toolCalls?: readonly unknown[];
}

export interface ConversationMetadata {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly runId?: string;
  readonly projectId?: string;
}

export interface Conversation extends ConversationMetadata {
  readonly messages: readonly ChatMessage[];
}

export interface ChatContext {
  readonly attachedArtifactIds: readonly string[];
  readonly selectedContractNames: readonly string[];
  readonly selectedFindingIds: readonly string[];
  readonly internetMode: InternetMode;
}

// ---------------------------------------------------------------------------
// Skills and Extensions (Phase 12)
// ---------------------------------------------------------------------------

export interface SkillManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly requiredTools: readonly string[];
  readonly requiredSkills: readonly string[];
}

export interface Skill extends SkillManifest {
  readonly content: string;
  readonly eligibility?: string;
}

export interface ExtensionManifest {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly type: "search" | "analysis" | "tool" | "ui";
  readonly entryPoint: string;
}

// ---------------------------------------------------------------------------
// Toolchain Integration (Phase 13)
// ---------------------------------------------------------------------------

export interface SlitherFinding {
  readonly check: string;
  readonly impact: string;
  readonly confidence: string;
  readonly description: string;
  readonly elements: readonly {
    readonly type: string;
    readonly name: string;
    readonly source_mapping: {
      readonly filename_relative: string;
      readonly lines: readonly number[];
    };
  }[];
}

export interface ForgeTestResult {
  readonly name: string;
  readonly status: "success" | "failure";
  readonly gas_used: number;
  readonly reason?: string;
}

// ---------------------------------------------------------------------------
// Team & Collaboration (Phase 14)
// ---------------------------------------------------------------------------

export interface TeamMember {
  readonly id: string;
  readonly name: string;
  readonly role: RuntimeMode | "guest";
  readonly status: "active" | "idle" | "offline";
  readonly lastActiveAt: string;
}

export interface TeamRoom {
  readonly id: string;
  readonly name: string;
  readonly members: readonly TeamMember[];
  readonly activeAuditors: number;
  readonly activeDevelopers: number;
  readonly sharedActivity: readonly string[];
}

// ---------------------------------------------------------------------------
// Web Research (Phase 4)
// ---------------------------------------------------------------------------

export interface WebSearchResult {
  readonly url: string;
  readonly title: string;
  readonly snippet: string;
  readonly hostname: string;
  readonly source: "search-engine" | "documentation" | "approved-domain";
}

export interface WebResearchRequest {
  readonly query: string;
  readonly limit?: number;
  readonly includeDocumentation?: boolean;
}

// ---------------------------------------------------------------------------
// Technical Audit Artifacts
// ---------------------------------------------------------------------------

export interface EntryExitPoint {
  readonly id: string;
  readonly type: "entry" | "exit";
  readonly contract: string;
  readonly functionName: string;
  readonly description: string;
  readonly accessControl: string;
}

export interface EntryExitMatrix {
  readonly summary: string;
  readonly points: readonly EntryExitPoint[];
}

export interface FunctionMapEntry {
  readonly functionName: string;
  readonly contract: string;
  readonly visibility: string;
  readonly isStateModifying: boolean;
  readonly description: string;
}

export interface ProtocolFunctionMap {
  readonly summary: string;
  readonly functions: readonly FunctionMapEntry[];
}


