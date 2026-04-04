# Extending SRP

SRP is designed to be extensible through an SDK that allows adding new skills, specialist agents, and custom methodology phases.

## Extension SDK

Extensions interact with the core through the `ExtensionSDK`, which provides a scoped API for registration.

### Registration Example

```typescript
import { ExtensionSDK } from "@srp/skills";

const manifest = {
  id: "my-extension",
  name: "Custom Security Checks",
  version: "1.0.0",
  type: "analysis",
  entryPoint: "index.js"
};

const sdk = new ExtensionSDK(manifest, globalRegistry);
const api = sdk.getApi();

// Register a new skill
api.registerSkill({
  id: "access-control-expert",
  name: "Advanced Access Control",
  category: "Security",
  // ... metadata
  content: "Use these patterns to identify broken access control..."
});
```

## Extension Types

1. **Skills**: Markdown-based knowledge bundles with frontmatter metadata.
2. **Agents**: Custom specialist workers that can be plugged into the `orchestrator`.
3. **Phases**: Entire methodology steps that can be inserted into the audit pipeline.

## Separation of Concerns

- **Core**: Handles session management, artifact persistence, and event routing.
- **Extensions**: Provide specialized reasoning logic and domain knowledge.
- **Tools**: Provide low-level execution data from third-party security tools.
