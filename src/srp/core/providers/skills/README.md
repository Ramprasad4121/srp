# Skills Provider

This package provides OpenAI-compatible skills functionality for the SRP (Security Research Platform) project.

## Overview

The skills provider implements the OpenAI Skills API, allowing users to create, manage, and interact with skills within the SRP ecosystem. Skills are reusable AI capabilities that can be shared and versioned.

## Features

- **Skill Management**: Create, retrieve, update, and delete skills
- **Version Control**: Manage multiple versions of skills with default version selection
- **Content Handling**: Retrieve skill content and version content
- **Provider Integration**: Compatible with NVIDIA NIM, OpenRouter, LM Studio, and llama.cpp
- **Rate Limiting**: Configurable rate limiting and concurrency controls
- **Streaming Support**: Full streaming response support

## Architecture

```
providers/skills/
├── __init__.py              # Package exports
├── skills.py               # Main Skills API implementation
├── content.py              # Skill content retrieval
├── versions.py             # Skill version management
├── __pycache__/           # Compiled bytecode
└── types/                 # Type definitions
    ├── __init__.py
    ├── skill.py            # Skill model
    ├── skill_version.py    # Skill version model
    ├── deleted_skill.py    # Deleted skill model
    ├── skill_list.py       # Skill list model
    ├── skill_create_params.py
    ├── skill_update_params.py
    ├── skill_list_params.py
    ├── skill_version_list.py
    ├── version_create_params.py
    ├── version_list_params.py
    └── deleted_skill_version.py
```

## Configuration

The skills provider uses the same configuration as the main application:

```dotenv
MODEL_OPUS="provider/model/name"
MODEL_SONNET="provider/model/name"
MODEL_HAIKU="provider/model/name"
MODEL="provider/model/name"  # fallback
```

## Usage

```python
from providers.skills import Skills

# Initialize with client
client = SomeClient()
skills = Skills(client)

# Create a skill
skill = skills.create(files=["path/to/skill.zip"])

# List skills
skill_list = skills.list()

# Retrieve skill
skill = skills.retrieve("skill_id")

# Update skill
skill = skills.update("skill_id", default_version="1.0")

# Delete skill
deleted = skills.delete("skill_id")
```

## Provider Support

The skills provider works with all supported LLM providers:

- **NVIDIA NIM**: Fast, free tier available
- **OpenRouter**: Wide model selection
- **LM Studio**: Local execution
- **llama.cpp**: Lightweight local inference

## Security Considerations

- All provider API keys are validated
- Rate limiting prevents abuse
- Input validation for model strings
- Proper error handling and logging

## Development

This package follows the SRP project's coding standards:
- Use `uv run` for execution
- Follow type checking with `ty check`
- Format with `ruff format`
- Test with `pytest`

## Integration

The skills provider integrates with the main application through the provider factory and configuration system. It's designed to work seamlessly with the existing provider architecture.

## License

MIT License - see LICENSE file for details.