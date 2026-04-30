/**
 * Smoke tests: ProjectStore round-trips and ProjectMemory derivation.
 */

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_PROJECT_ID,
  ProjectMemory,
  ProjectStore,
  projectMetadataPath,
  projectRunsDir,
  registryPath
} from "../../packages/project-memory/dist/index.js";

async function freshRoot() {
  return mkdtemp(join(tmpdir(), "srp-pm-store-"));
}

test("ProjectStore.init seeds default project on a fresh workspace", async (t) => {
  const root = await freshRoot();
  t.after(() => rm(root, { recursive: true, force: true }));

  const store = new ProjectStore(root);
  await store.init();

  const projects = await store.list();
  assert.equal(projects.length, 1, "exactly one project after init");
  assert.equal(projects[0].id, DEFAULT_PROJECT_ID);
  assert.equal(projects[0].name, "Default Project");

  const active = await store.getActive();
  assert.ok(active, "active project resolves");
  assert.equal(active.id, DEFAULT_PROJECT_ID);

  const reg = JSON.parse(await readFile(registryPath(root), "utf8"));
  assert.equal(reg.version, 1);
  assert.equal(reg.activeProjectId, DEFAULT_PROJECT_ID);
});

test("ProjectStore.create persists registry and per-project metadata", async (t) => {
  const root = await freshRoot();
  t.after(() => rm(root, { recursive: true, force: true }));

  const store = new ProjectStore(root);
  const created = await store.create({ name: "My Audit" });

  assert.equal(created.name, "My Audit");
  assert.equal(created.id, "my-audit", "id is slugified from name");

  const list = await store.list();
  assert.equal(list.length, 2, "default + new project");
  assert.ok(list.some((p) => p.id === "my-audit"));

  const meta = JSON.parse(
    await readFile(projectMetadataPath(root, "my-audit"), "utf8")
  );
  assert.equal(meta.id, "my-audit");
  assert.equal(meta.name, "My Audit");
  assert.equal(meta.version, 1);
});

test("ProjectStore.create with explicit id and conflict handling", async (t) => {
  const root = await freshRoot();
  t.after(() => rm(root, { recursive: true, force: true }));

  const store = new ProjectStore(root);
  await store.create({ name: "First", id: "alpha" });

  await assert.rejects(
    () => store.create({ name: "Second", id: "alpha" }),
    /already exists/i
  );
});

test("ProjectStore.create rejects empty name", async (t) => {
  const root = await freshRoot();
  t.after(() => rm(root, { recursive: true, force: true }));

  const store = new ProjectStore(root);
  await assert.rejects(() => store.create({ name: "   " }), /non-empty/i);
});

test("ProjectStore.setActive switches active project and persists", async (t) => {
  const root = await freshRoot();
  t.after(() => rm(root, { recursive: true, force: true }));

  const store = new ProjectStore(root);
  await store.create({ name: "Other" });

  await store.setActive("other");
  const active = await store.getActive();
  assert.equal(active?.id, "other");

  // New store reads the same on-disk state.
  const reopened = new ProjectStore(root);
  const reopenedActive = await reopened.getActive();
  assert.equal(reopenedActive?.id, "other");
});

test("ProjectStore.setActive rejects unknown id", async (t) => {
  const root = await freshRoot();
  t.after(() => rm(root, { recursive: true, force: true }));

  const store = new ProjectStore(root);
  await store.init();

  await assert.rejects(
    () => store.setActive("does-not-exist"),
    /unknown project id/i
  );
});

test("ProjectMemory.forActive resolves to the active project's runs dir", async (t) => {
  const root = await freshRoot();
  t.after(() => rm(root, { recursive: true, force: true }));

  const store = new ProjectStore(root);
  await store.create({ name: "Active One" });
  await store.setActive("active-one");

  const mem = await ProjectMemory.forActive(root, store);
  assert.equal(mem.projectId, "active-one");
  assert.equal(mem.runsDir, projectRunsDir(root, "active-one"));
});

test("ProjectMemory.forProject throws on unknown id", async (t) => {
  const root = await freshRoot();
  t.after(() => rm(root, { recursive: true, force: true }));

  await assert.rejects(
    () => ProjectMemory.forProject(root, "nope"),
    /unknown project id/i
  );
});
