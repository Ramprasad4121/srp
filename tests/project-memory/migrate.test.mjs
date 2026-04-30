/**
 * Smoke tests: legacy `.srp/runs/` migration into the project-scoped layout.
 */

import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_PROJECT_ID,
  legacyRunsDir,
  migrateLegacyLayout,
  projectMetadataPath,
  projectRunsDir,
  registryPath
} from "../../packages/project-memory/dist/index.js";

async function freshRoot() {
  return mkdtemp(join(tmpdir(), "srp-pm-migrate-"));
}

/** Create a fake legacy run directory with a manifest + one event line. */
async function seedLegacyRun(root, runId) {
  const dir = join(legacyRunsDir(root), runId);
  await mkdir(join(dir, "artifacts"), { recursive: true });
  await writeFile(
    join(dir, "manifest.json"),
    JSON.stringify({ runId, status: "completed", artifacts: [] }, null, 2),
    "utf8"
  );
  await writeFile(
    join(dir, "events.jsonl"),
    JSON.stringify({ type: "phase.started" }) + "\n",
    "utf8"
  );
}

test("migrate: no-op on a brand-new workspace creates registry and seed default", async (t) => {
  const root = await freshRoot();
  t.after(() => rm(root, { recursive: true, force: true }));

  const result = await migrateLegacyLayout(root);
  assert.equal(result.movedRunCount, 0);
  assert.equal(result.registryCreated, true);
  // No legacy data → no default project directory was needed → registry has
  // zero projects and `activeProjectId` is null.
  const reg = JSON.parse(await readFile(registryPath(root), "utf8"));
  assert.equal(reg.projects.length, 0);
  assert.equal(reg.activeProjectId, null);
});

test("migrate: moves legacy `.srp/runs/<runId>` data into the default project", async (t) => {
  const root = await freshRoot();
  t.after(() => rm(root, { recursive: true, force: true }));

  await seedLegacyRun(root, "run_aaa");
  await seedLegacyRun(root, "run_bbb");

  const result = await migrateLegacyLayout(root);
  assert.equal(result.performed, true);
  assert.equal(result.movedRunCount, 2);
  assert.equal(result.registryCreated, true);
  assert.equal(result.defaultProjectCreated, true);

  const moved = await readdir(projectRunsDir(root, DEFAULT_PROJECT_ID));
  assert.deepEqual(moved.sort(), ["run_aaa", "run_bbb"]);

  // Original legacy dir is now empty (rename, not copy).
  const legacyAfter = await readdir(legacyRunsDir(root));
  assert.deepEqual(legacyAfter, []);

  // Manifest survives bit-for-bit.
  const manifest = JSON.parse(
    await readFile(
      join(projectRunsDir(root, DEFAULT_PROJECT_ID), "run_aaa", "manifest.json"),
      "utf8"
    )
  );
  assert.equal(manifest.runId, "run_aaa");
  assert.equal(manifest.status, "completed");

  // Registry now lists the default project.
  const reg = JSON.parse(await readFile(registryPath(root), "utf8"));
  assert.equal(reg.activeProjectId, DEFAULT_PROJECT_ID);
  assert.equal(reg.projects.length, 1);
  assert.equal(reg.projects[0].id, DEFAULT_PROJECT_ID);

  // Default project metadata file exists.
  const meta = JSON.parse(
    await readFile(projectMetadataPath(root, DEFAULT_PROJECT_ID), "utf8")
  );
  assert.equal(meta.id, DEFAULT_PROJECT_ID);
});

test("migrate: idempotent — second run is a no-op", async (t) => {
  const root = await freshRoot();
  t.after(() => rm(root, { recursive: true, force: true }));

  await seedLegacyRun(root, "run_xxx");
  await migrateLegacyLayout(root);

  const second = await migrateLegacyLayout(root);
  assert.equal(second.performed, false);
  assert.equal(second.movedRunCount, 0);
  assert.equal(second.registryCreated, false);
  assert.equal(second.defaultProjectCreated, false);

  // Data is unchanged.
  const moved = await readdir(projectRunsDir(root, DEFAULT_PROJECT_ID));
  assert.deepEqual(moved, ["run_xxx"]);
});

test("migrate: never overwrites a target run that already exists", async (t) => {
  const root = await freshRoot();
  t.after(() => rm(root, { recursive: true, force: true }));

  // Pre-existing target run with distinctive content.
  const targetRun = join(projectRunsDir(root, DEFAULT_PROJECT_ID), "run_dup");
  await mkdir(targetRun, { recursive: true });
  await writeFile(
    join(targetRun, "manifest.json"),
    JSON.stringify({ runId: "run_dup", status: "kept" }, null, 2),
    "utf8"
  );

  // Conflicting legacy run with different content.
  await seedLegacyRun(root, "run_dup");

  await migrateLegacyLayout(root);

  // Target was not overwritten.
  const manifest = JSON.parse(
    await readFile(join(targetRun, "manifest.json"), "utf8")
  );
  assert.equal(manifest.status, "kept");
});
