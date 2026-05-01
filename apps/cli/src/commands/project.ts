import { ProjectStore } from "@srp/project-memory";

/**
 * CLI handler for `srp project <subcommand>`.
 *
 * Sub-commands:
 *   list                   — print all projects
 *   current                — print the active project
 *   use <projectId>        — switch the active project
 *   create <name...>       — create a new project (name may have spaces)
 */
export async function runProjectCommand(
  subArgs: readonly string[],
  rootDir: string
): Promise<void> {
  const sub = subArgs[0];

  if (!sub || sub === "--help" || sub === "-h") {
    printProjectHelp();
    return;
  }

  const store = new ProjectStore(rootDir);
  await store.init();

  switch (sub) {
    case "list": {
      const projects = await store.list();
      const active = await store.getActive();
      if (projects.length === 0) {
        console.log("No projects found.");
        return;
      }
      for (const p of projects) {
        const marker = p.id === active?.id ? "*" : " ";
        console.log(`${marker} ${p.id}  "${p.name}"  (created ${p.createdAt})`);
      }
      break;
    }

    case "current": {
      const active = await store.getActive();
      if (!active) {
        console.log("No active project.");
      } else {
        console.log(`${active.id}  "${active.name}"`);
      }
      break;
    }

    case "use": {
      const projectId = subArgs[1];
      if (!projectId) {
        console.error("Usage: srp project use <projectId>");
        process.exit(1);
      }
      await store.setActive(projectId);
      console.log(`Active project set to: ${projectId}`);
      break;
    }

    case "create": {
      const nameParts = subArgs.slice(1);
      if (nameParts.length === 0) {
        console.error("Usage: srp project create <name>");
        process.exit(1);
      }
      const name = nameParts.join(" ");
      const project = await store.create({ name });
      console.log(`Created project: ${project.id}  "${project.name}"`);
      break;
    }

    default: {
      console.error(`Unknown project sub-command: ${sub}`);
      printProjectHelp();
      process.exit(1);
    }
  }
}

function printProjectHelp(): void {
  console.log(`
srp project — manage SRP projects

Usage:
  srp project list                  List all projects (* = active)
  srp project current               Show the active project
  srp project use <projectId>       Switch to an existing project
  srp project create <name>         Create a new project
  `);
}
