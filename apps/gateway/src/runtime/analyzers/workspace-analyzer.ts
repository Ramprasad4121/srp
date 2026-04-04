import { readdir, stat, access } from "node:fs/promises";
import { join, extname } from "node:path";
import type { WorkspaceAnalysis } from "@srp/shared-types";

// Limit recursion to avoid hanging on massive misconfigured workspaces
const MAX_SEARCH_DEPTH = 5;
const MAX_FILE_COUNT = 5000;

interface FindSolidityResult {
  readonly files: readonly string[];
  readonly limitReached: boolean;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findSolidityFiles(
  dir: string,
  baseDir: string,
  depth: number,
  currentCount: number
): Promise<FindSolidityResult> {
  if (depth > MAX_SEARCH_DEPTH) return { files: [], limitReached: false };
  
  let files: string[] = [];
  let limitReached = false;

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (currentCount + files.length >= MAX_FILE_COUNT) {
        return { files, limitReached: true };
      }

      // Ignore common noise directories
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === "out" ||
        entry.name === "cache" ||
        entry.name === "artifacts" ||
        entry.name === ".srp" ||
        entry.name === "lib" // we usually want to skip deps analyzing in phase 0 explicitly unless instructed
      ) {
        continue;
      }

      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        const subResult = await findSolidityFiles(fullPath, baseDir, depth + 1, currentCount + files.length);
        files = files.concat(subResult.files);
        if (subResult.limitReached) {
          limitReached = true;
          break;
        }
      } else if (entry.isFile() && extname(entry.name) === ".sol") {
        // Collect relative path
        const relativePath = fullPath.startsWith(baseDir) 
          ? fullPath.slice(baseDir.length).replace(/^[/\\]+/, '')
          : fullPath;
        files.push(relativePath);
      }
    }
  } catch (err) {
    // Ignore read errors
  }

  return { files, limitReached };
}

export async function analyzeWorkspace(rootDirectory: string): Promise<WorkspaceAnalysis> {
  let isFoundry = false;
  let isHardhat = false;
  const topLevelDirectories: string[] = [];

  try {
    // Check framework markers
    isFoundry = await fileExists(join(rootDirectory, "foundry.toml"));
    isHardhat = (await fileExists(join(rootDirectory, "hardhat.config.js"))) || 
                (await fileExists(join(rootDirectory, "hardhat.config.ts")));

    // Top-level dirs
    const entries = await readdir(rootDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== ".git" && entry.name !== "node_modules") {
        topLevelDirectories.push(entry.name);
      }
    }
  } catch (err) {
    // Error probing top level root
  }

  const { files: solidityFiles, limitReached } = await findSolidityFiles(rootDirectory, rootDirectory, 0, 0);

  const frameworks = [];
  if (isFoundry) frameworks.push("Foundry");
  if (isHardhat) frameworks.push("Hardhat");

  let summary = `Workspace at ${rootDirectory} contains ${solidityFiles.length} Solidity file(s).`;
  if (limitReached) {
    summary += ` (Limit of ${MAX_FILE_COUNT} reached).`;
  }
  if (frameworks.length > 0) {
    summary += ` Frameworks detected: ${frameworks.join(", ")}.`;
  } else {
    summary += ` No specific smart contract framework file detected.`;
  }

  return {
    rootDirectory,
    isFoundry,
    isHardhat,
    solidityFileCount: solidityFiles.length,
    solidityFiles,
    topLevelDirectories,
    summary
  };
}
