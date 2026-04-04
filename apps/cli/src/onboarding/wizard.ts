import {
  intro,
  outro,
  select,
  text,
  isCancel,
  cancel,
  confirm,
  spinner,
  note
} from "@clack/prompts";
import pc from "picocolors";
import { 
  loadOrCreateSetupManifest, 
  saveSetupManifest,
  runtimeModes,
  defaultRuntimeMode
} from "@srp/config";
import { 
  providerCatalog, 
  evaluateProviderSetHealth 
} from "@srp/providers";
import type { 
  RuntimeMode, 
  ProviderSelection, 
  ProviderKind 
} from "@srp/shared-types";
import { writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";

function printHeader() {
  const header = [
    pc.cyan(" ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄ "),
    pc.cyan("█​▀​▀​▀​▀​▀​▀​▀​▀​▀​▀​█ █​▀​▀​▀​▀​▀​▀​▀​▀​▀​▀​█ █​▀​▀​▀​▀​▀​▀​▀​▀​▀​▀​█"),
    pc.cyan("█​ ▄▄▄▄▄▄▄▄▄​█ █​ ▄▄▄▄▄▄▄▄▄​█ █​ ▄▄▄▄▄▄▄▄▄​█"),
    pc.cyan("█​ █​▀​▀​▀​▀​▀​▀​▀​▀​ █​ █​▀​▀​▀​▀​▀​▀​▀​▀​ █​ █​▀​▀​▀​▀​▀​▀​▀​▀​█"),
    pc.cyan("█​ █​▄​▄​▄​▄​▄​▄​▄​▄​ █​ █​▄​▄​▄​▄​▄​▄​▄​▄​ █​ █​▄​▄​▄​▄​▄​▄​▄​▄​█"),
    pc.cyan("█​▄​▄​▄​▄​▄​▄​▄​▄​▄​▄​█ █​▄​▄​▄​▄​▄​▄​▄​▄​▄​▄​█ █​▄​▄​▄​▄​▄​▄​▄​▄​▄​▄​█"),
    pc.cyan(" ▀​▀​▀​▀​▀​▀​▀​▀​▀​▀​▀​  ▀​▀​▀​▀​▀​▀​▀​▀​▀​▀​▀​  ▀​▀​▀​▀​▀​▀​▀​▀​▀​▀​▀​ "),
    pc.white("       SECURITY REASONING PROTOCOL       "),
    ""
  ].join("\n");
  console.log(header);
}

export async function runSetupWizard(rootDir: string) {
  printHeader();
  intro(pc.bgCyan(pc.black(" SRP — ONBOARDING WIZARD ")));

  const manifest = await loadOrCreateSetupManifest(rootDir);
  const state = manifest.state;

  // Step 1: Risk Acknowledgement (OpenClaw style)
  const acceptedRisk = await confirm({
    message: "I acknowledge that SRP agents can read files and perform security analysis on this codebase.",
    initialValue: true
  });

  if (isCancel(acceptedRisk) || !acceptedRisk) {
    cancel("Setup cancelled. You must accept the risk to proceed.");
    process.exit(0);
  }

  // Step 2: Role Selection
  const role = await select({
    message: "Choose your primary role:",
    options: [
      { value: "auditor", label: "Auditor", hint: "Focus on findings, invariants, and exploits" },
      { value: "developer", label: "Developer", hint: "Focus on NatSpec, tests, and code review" },
      { value: "hybrid", label: "Both (Hybrid)", hint: "Full security workbench" }
    ],
    initialValue: state.role || defaultRuntimeMode
  });

  if (isCancel(role)) {
    cancel("Setup cancelled.");
    process.exit(0);
  }

  // Step 3: Provider Selection
  const providerChoices = providerCatalog.map(p => ({
    value: p.kind,
    label: p.label,
    hint: `Default model: ${p.defaultModel}`
  }));

  const selectedProviderKind = await select({
    message: "Select your primary LLM provider:",
    options: providerChoices,
  }) as ProviderKind;

  if (isCancel(selectedProviderKind)) {
    cancel("Setup cancelled.");
    process.exit(0);
  }

  const definition = providerCatalog.find(p => p.kind === selectedProviderKind)!;
  
  // Step 4: Provider Configuration (API Keys / Base URL)
  const envUpdates: Record<string, string> = {};
  
  for (const profile of definition.credentialProfiles) {
    const value = await text({
      message: `Enter ${profile.envVar}${profile.required ? " (required)" : " (optional)"}:`,
      placeholder: profile.envVar.includes("KEY") ? "sk-..." : "http://...",
      validate: (input) => {
        if (profile.required && !input) return `${profile.envVar} is required`;
      }
    });

    if (isCancel(value)) {
      cancel("Setup cancelled.");
      process.exit(0);
    }

    if (value) {
      envUpdates[profile.envVar] = value;
    }
  }

  // Step 5: Model Selection (Optional, defaults to provider default)
  const customModel = await text({
    message: "Specify a custom model (leave blank for default):",
    placeholder: definition.defaultModel,
  });

  if (isCancel(customModel)) {
    cancel("Setup cancelled.");
    process.exit(0);
  }

  const model = customModel || definition.defaultModel;

  // Step 6: Update .env and Manifest
  const s = spinner();
  s.start("Finalizing setup...");

  try {
    // Update .env
    await updateEnvFile(rootDir, envUpdates);

    // Update manifest
    const provider: ProviderSelection = {
      kind: selectedProviderKind,
      label: definition.label,
      model,
      enabled: true
    };

    // Replace existing providers with the newly configured one to keep it simple,
    // as per user request to avoid "selecting all providers" confusion.
    const newState = {
      ...state,
      role: role as RuntimeMode,
      providers: [provider],
      currentStep: "ready" as const,
      completedSteps: ["welcome", "role-selection", "providers", "workspace", "ready"] as any[]
    };

    await saveSetupManifest(rootDir, {
      ...manifest,
      updatedAt: new Date().toISOString(),
      state: newState
    });

    s.stop("Onboarding complete!");
  } catch (err) {
    s.stop("Failed to finalize onboarding.");
    console.error(pc.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }

  note(
    `Role: ${pc.cyan(role as string)}\nProvider: ${pc.cyan(definition.label)}\nModel: ${pc.cyan(model)}\nConfig: ${pc.dim(join(rootDir, ".srp/config/setup.json"))}`,
    "Onboarding Summary"
  );

  outro(pc.green("SRP is now configured. Run 'srp gateway start' to open the UI."));
}

async function updateEnvFile(rootDir: string, updates: Record<string, string>) {
  const envPath = join(rootDir, ".env");
  let content = "";
  try {
    content = await readFile(envPath, "utf8");
  } catch {
    // If .env doesn't exist, start fresh
  }

  const lines = content.split("\n");
  for (const [key, value] of Object.entries(updates)) {
    const index = lines.findIndex(l => l.startsWith(`${key}=`));
    if (index !== -1) {
      lines[index] = `${key}=${value}`;
    } else {
      lines.push(`${key}=${value}`);
    }
    // Also update process.env for immediate use in health checks if needed
    process.env[key] = value;
  }

  await writeFile(envPath, lines.join("\n").trim() + "\n", "utf8");
}
