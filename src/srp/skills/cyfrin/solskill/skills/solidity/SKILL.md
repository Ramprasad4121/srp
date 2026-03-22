# Cyfrin Solidity Production Standards (Bridge)

This bridge skill maps the `cyfrin-solskill` registry key to an available
solidity methodology in this workspace.

Primary guidance:
- keep fixes minimal and localized
- preserve contract behavior outside the vulnerable path
- add explicit guards over implicit assumptions
- include clear reasoning and test coverage for each fix

Reference source:
- `skills/cyfrin/solskill/solidity/SKILL.md`
