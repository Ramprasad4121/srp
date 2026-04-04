import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { WorkspaceAnalysis, CodebaseContextSummary, IntentSummary } from "@srp/shared-types";

// Safety limits
const MAX_BYTES_TOTAL = 500 * 1024; // 500 KB across all read files
const MAX_FILE_SIZE = 100 * 1024;   // 100 KB max per individual file
const MAX_FILES = 50;               // Maximum number of files to deeply inspect

export interface AnalyzedFileContext {
  readonly path: string;
  readonly content: string;
  readonly isInterface: boolean;
  readonly isLibrary: boolean;
  readonly isContract: boolean;
  readonly mainDeclarationName: string | null;
}

export interface CodebaseContextResult {
  readonly summary: CodebaseContextSummary;
  readonly intent: IntentSummary;
  // In a full implementation, we would keep 'files' here to feed the LLM later
}

function extractPrimaryDeclaration(content: string): { type: "contract"|"interface"|"library"|"none", name: string | null } {
  // Simple heuristic regex to find standard declarations
  const match = content.match(/\b(contract|interface|library)\s+([a-zA-Z0-9_]+)/);
  if (match) {
    return {
      type: match[1] as "contract"|"interface"|"library",
      name: match[2] ?? null
    };
  }
  return { type: "none", name: null };
}

export async function buildCodebaseContext(wa: WorkspaceAnalysis): Promise<CodebaseContextResult> {
  const root = wa.rootDirectory;
  let bytesProcessed = 0;
  let limitReached = false;
  
  const filesProcessed: AnalyzedFileContext[] = [];
  const targetFiles = wa.solidityFiles.slice(0, MAX_FILES);

  if (wa.solidityFiles.length > MAX_FILES) {
    limitReached = true;
  }

  for (const relativePath of targetFiles) {
    if (bytesProcessed >= MAX_BYTES_TOTAL) {
      limitReached = true;
      break;
    }

    try {
      const fullPath = join(root, relativePath);
      // Read as buffer to strictly enforce byte limit without massive string allocs
      // A full implementation would stream, but this is a reasonable bounded mockup.
      let contentString = "";
      try {
        const content = await readFile(fullPath, "utf8");
        // Enforce per-file size cap
        if (content.length > MAX_FILE_SIZE) {
          contentString = content.slice(0, MAX_FILE_SIZE) + "\n// ... [TRUNCATED DUE TO SIZE]";
          limitReached = true;
        } else {
          contentString = content;
        }
      } catch (err) {
        continue; // ignore unreadable files
      }

      // Pre-flight byte calc (utf8 approximation)
      bytesProcessed += Buffer.byteLength(contentString, "utf8");

      const declaration = extractPrimaryDeclaration(contentString);

      filesProcessed.push({
        path: relativePath,
        content: contentString,
        isContract: declaration.type === "contract",
        isInterface: declaration.type === "interface",
        isLibrary: declaration.type === "library",
        mainDeclarationName: declaration.name
      });
    } catch {
      // safe fallback on IO bounds
    }
  }

  // Generate Intent Draft from extracted context
  const mainContracts: string[] = [];
  let interfaceCount = 0;

  for (const f of filesProcessed) {
    if (f.isInterface) interfaceCount++;
    if (f.isContract && f.mainDeclarationName && !f.path.includes("test") && !f.path.includes("mock")) {
      mainContracts.push(f.mainDeclarationName);
    }
  }

  let draftSummary = `Found ${wa.solidityFileCount} Solidity files. Analyzed ${filesProcessed.length} context files natively. `;
  if (wa.isFoundry) draftSummary += "Detected Foundry framework constraints. ";
  if (wa.isHardhat) draftSummary += "Detected Hardhat framework constraints. ";
  
  if (mainContracts.length > 0) {
    draftSummary += `Core logic appears to revolve around: ${mainContracts.slice(0, 5).join(", ")}${mainContracts.length > 5 ? " and others" : ""}. `;
  } else {
    draftSummary += "No primary non-test contracts identified in the scanned subset. ";
  }

  if (interfaceCount > 0) {
    draftSummary += `The codebase explicitly interfaces with ${interfaceCount} defined interfaces.`;
  }

  return {
    summary: {
      filesProcessed: filesProcessed.length,
      bytesProcessed,
      limitReached,
      targetFiles: filesProcessed.map(f => f.path)
    },
    intent: {
      mainContracts,
      interfaceCount,
      draftSummary
    }
  };
}
