import type { IncomingMessage, ServerResponse } from "node:http";
import { sendError, sendJson } from "../http-utils.js";
import { getSkill, listSkills } from "../runtime/skills-catalog.js";

export async function handleListSkills(
  _req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const skills = await listSkills();
    sendJson(res, 200, skills);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    sendError(res, 500, "skills_list_failed", detail);
  }
}

export async function handleGetSkill(
  _req: IncomingMessage,
  res: ServerResponse,
  params: { id: string }
): Promise<void> {
  try {
    const skill = await getSkill(params.id);
    if (!skill) {
      sendError(res, 404, "not_found", `Skill ${params.id} not found`);
      return;
    }

    sendJson(res, 200, skill);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    sendError(res, 500, "skill_detail_failed", detail);
  }
}
