import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { writeFile, unlink } from "node:fs/promises";
import type { ProofExecution } from "@srp/shared-types";

export async function runPoC(
  finding: Record<string, unknown>,
  projectRoot: string
): Promise<ProofExecution> {
  const tempPath = join(tmpdir(), `srp-poc-${String(finding.id ?? "temp")}.json`);
  await writeFile(tempPath, JSON.stringify(finding), "utf8");

  const child = spawn("python3", [
    "scripts/run_poc.py",
    "--finding",
    tempPath,
    "--project-root",
    projectRoot
  ], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  const chunks: string[] = [];
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => chunks.push(chunk));
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => chunks.push(chunk));

  const exitCode = await new Promise<number>((resolve) => {
    child.on("close", (code) => resolve(code ?? 0));
    child.on("error", () => resolve(1));
  });

  const output = chunks.join("") || "";
  try {
    if (exitCode !== 0 || !output.trim()) {
      return {
        findingId: String(finding.id ?? "unknown"),
        status: "skipped",
        output: output.slice(0, 4000),
        generatedAt: new Date().toISOString()
      };
    }

    const result = JSON.parse(output) as Record<string, unknown>;
    const testFile = typeof result["test_file"] === "string" ? result["test_file"] : undefined;
    return {
      findingId: String(result["id"] ?? finding.id ?? "unknown"),
      status: (result["status"] as ProofExecution["status"]) ?? "skipped",
      output: String(result["output"] ?? ""),
      ...(testFile !== undefined ? { testFile } : {}),
      generatedAt: new Date().toISOString()
    };
  } finally {
    await unlink(tempPath).catch(() => {});
  }
}
