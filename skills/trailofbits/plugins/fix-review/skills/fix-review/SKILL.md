# Trail of Bits Fix Review (Bridge)

Use this skill to review proposed security patches for secondary risk
introduction.

Checklist:
- verify exploit path is closed
- ensure no privilege bypass was added
- validate state invariants still hold
- check upgrade/storage compatibility for changed structs or layouts
- identify new external-call, DoS, and accounting attack surfaces

Output expectations:
- explicit statement whether new attack surface is introduced
- concrete notes on residual risks and follow-up tests
