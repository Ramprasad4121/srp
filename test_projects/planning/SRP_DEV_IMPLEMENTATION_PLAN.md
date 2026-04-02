# SRP Dev Implementation Plan

## 1. Goal

`srp dev` should become the developer-side counterpart to `srp audit`.

It should feel like:

- a super senior smart contract engineering team
- sitting next to the developer
- helping them write, explain, test, document, refine, and harden code

This is not just “generate comments”.

This is a full developer workbench for Solidity/EVM engineering.

## 2. What `srp dev` Should Be

`srp dev` should help developers with:

- NatSpec generation
- full documentation generation
- comments and inline code explanation
- contract generation from user preference/spec
- test generation
- review and refactor help
- architecture support
- upgrade safety support
- access control mapping
- invariant suggestions
- fuzz and invariant testing support
- regression verification
- integration and fork testing support

## 3. Core Product Positioning

If `srp audit` is:

- auditor workbench

Then `srp dev` is:

- developer copilot for secure smart contract engineering

The two should share:

- provider system
- skills system
- toolchain system
- localhost UI shell
- artifact system

But they should present differently.

## 4. Main `srp dev` Capabilities

## 4.1 NatSpec generation

### Goal

Generate high-quality NatSpec for:

- contracts
- interfaces
- functions
- errors
- events
- modifiers

### What it should do

- infer intent from code and architecture
- write concise but high-signal NatSpec
- avoid generic garbage comments
- surface uncertain sections for human review

### UI requirements

Add `NatSpec` page in localhost UI:

- contracts list
- undocumented functions
- generated suggestions
- accepted / rejected / edited state

## 4.2 Documentation generation

### Goal

Generate project docs for developers:

- protocol overview
- architecture docs
- contract docs
- role docs
- upgrade docs
- test strategy docs

### UI requirements

Add `Docs` page in localhost UI:

- generated docs
- architecture docs
- missing docs coverage
- export options

## 4.3 Code comments and explanations

### Goal

Write meaningful comments where they help:

- tricky math
- non-obvious invariants
- storage layout assumptions
- security-sensitive flows

### Important rule

Do not generate noisy comments.

### UI requirements

Add `Code Explain` mode:

- select file/function
- see suggested comments
- accept/edit/reject

## 4.4 Contract generation from user preferences

### Goal

Let a user specify:

- protocol type
- constraints
- token model
- upgradeability choice
- admin model
- pausing model
- testing expectations

And have SRP generate:

- contract set
- interfaces
- tests
- docs

### UI requirements

Add `Contract Builder` page:

- spec form
- generated architecture
- generated code preview
- generated tests preview

## 4.5 Test generation

You explicitly want all major test classes.

SRP dev should support:

- Unit tests
- Fuzz tests
- Fork tests
- Invariant tests
- Regression tests
- Integration tests
- Mutation testing

And these should also connect back into `srp audit`.

## 5. Detailed Test Strategy

## 5.1 Unit tests

### Goal

Cover function-level correctness.

### SRP should do

- generate tests for critical functions
- cover happy path + failure path
- cover access control and parameter validation

### UI

`Tests > Unit`

- missing test coverage
- generated tests
- run results

## 5.2 Fuzz tests

### Goal

Explore input space and edge cases.

### SRP should do

- identify fuzz-worthy functions
- generate fuzz inputs and assumptions
- connect fuzzing to invariants

### UI

`Tests > Fuzz`

- fuzz targets
- generated fuzz tests
- failing seeds

## 5.3 Fork tests

### Goal

Validate behavior against real onchain or near-real state.

### SRP should do

- detect fork-test-worthy flows
- generate fork setup
- support configurable RPC endpoints and block numbers

### UI

`Tests > Fork`

- selected RPC
- block pin
- generated tests
- replay logs

## 5.4 Invariant tests

### Goal

Turn inferred invariants into executable tests.

### SRP should do

- infer invariant candidates
- rank them
- generate invariant test scaffolds

### UI

`Tests > Invariants`

- inferred invariants
- executable status
- broken invariants

## 5.5 Regression tests

### Goal

Prove that a fix killed a bug and didn’t regress.

### SRP should do

- turn findings into regression tests
- rerun after patch
- compare before/after status

### UI

`Tests > Regression`

- finding linked
- failing before / passing after

## 5.6 Integration tests

### Goal

Test multiple contracts and workflows together.

### SRP should do

- generate scenario-level tests
- cover cross-contract flows
- cover role transitions and funds movement

### UI

`Tests > Integration`

- workflow scenarios
- generated test suite

## 5.7 Mutation testing

### Goal

Measure whether tests are meaningful.

### SRP should do

- introduce code mutations
- rerun tests
- identify weak test areas

### UI

`Tests > Mutation`

- surviving mutations
- dead mutations
- weak coverage areas

## 6. Additional `srp dev` Capabilities That Will Make It Better

## 6.1 Secure code review mode

This should review developer code before audit.

Should focus on:

- missing access control
- bad assumptions
- bad upgrade patterns
- weak docs
- missing tests

## 6.2 Architecture guidance

Help developers choose:

- contract boundaries
- storage structure
- upgradeability pattern
- admin model
- pause model

## 6.3 Spec-to-code mode

Let the user input:

- product spec
- protocol rules
- user stories

And SRP helps produce:

- contracts
- tests
- NatSpec
- docs

## 6.4 Refactor mode

Help improve code while preserving behavior.

### UI

- complexity hotspots
- refactor proposals
- risk notes

## 6.5 Explain mode

For developers and juniors:

- explain contract
- explain function
- explain state machine
- explain why this test matters

## 7. The `srp dev` Localhost UI

`srp dev` should not use the exact same UI as `srp audit`.

It should share the shell, but have a developer-focused structure.

## Recommended top-level `Dev` sections

- Overview
- Codebase
- NatSpec
- Docs
- Contract Builder
- Tests
- Review
- Refactor
- Explain
- Skills
- Models & Providers
- Toolchain

## 8. The Most Important `srp dev` Screens

## 8.1 Dev Overview

Show:

- codebase summary
- docs coverage
- NatSpec coverage
- test coverage
- missing invariant tests
- security review warnings

## 8.2 NatSpec screen

Show:

- undocumented contracts/functions
- generated NatSpec
- approve/edit/reject workflow

## 8.3 Docs screen

Show:

- project docs tree
- architecture summary
- generated explanations

## 8.4 Tests screen

Should have tabs for:

- Unit
- Fuzz
- Fork
- Invariant
- Regression
- Integration
- Mutation

## 8.5 Contract Builder screen

Should let the developer:

- describe what they want
- choose protocol style
- choose patterns
- preview generated code

## 8.6 Review screen

Should provide:

- code review
- architecture review
- test review
- documentation review

## 8.7 Explain screen

Should provide:

- contract explanations
- function walkthroughs
- state flow explanations
- beginner mode and advanced mode

## 9. Skills In `srp dev`

The Skills section should also exist for developers.

Recommended developer skills:

- NatSpec writer
- docs writer
- contract builder
- test generator
- fuzz strategy generator
- invariant suggester
- upgrade safety reviewer
- access control reviewer
- gas optimization reviewer

## 10. Agent And Runtime Implications

`srp dev` should not be one giant agent.

Recommended dev-side top-level agents:

- `DevPlanningAgent`
- `NatSpecAgent`
- `DocsAgent`
- `ContractGenerationAgent`
- `TestPlanningAgent`
- `TestGenerationAgent`
- `ReviewAgent`
- `RefactorAgent`
- `ExplainAgent`
- `TraceAgent`

Specialist workers:

- `UnitTestWorker`
- `FuzzTestWorker`
- `ForkTestWorker`
- `InvariantTestWorker`
- `RegressionTestWorker`
- `IntegrationTestWorker`
- `MutationTestWorker`

## 11. How To Make `srp dev` Even Better

Beyond the requested scope, here is how to make it stronger:

## 11.1 Protocol templates

Provide starter templates for:

- ERC20
- vesting
- staking
- vault
- AMM
- lending

## 11.2 Security-first coding patterns

Let SRP recommend:

- CEI pattern
- pause model
- auth model
- upgrade model
- emergency flows

## 11.3 Test health scoring

Score the generated test suite by:

- breadth
- depth
- mutation resistance
- invariant coverage

## 11.4 Documentation health scoring

Score:

- NatSpec coverage
- architecture docs quality
- role clarity
- threat model documentation

## 11.5 Design/spec alignment

SRP should check:

- does code match docs?
- do tests reflect claims?
- do comments lie?

This is very high value.

## 12. How `srp dev` And `srp audit` Should Connect

These should not be isolated products.

`srp dev` outputs should feed `srp audit`.

Examples:

- generated NatSpec helps audit understanding
- generated invariant tests help audit verification
- generated docs help intent extraction
- review notes become audit context

And `srp audit` outputs should feed `srp dev`.

Examples:

- findings become regression tests
- invariants become executable tests
- trust boundaries become docs
- exploit paths become architecture warnings

## 13. Final Recommendation

`srp dev` should become a full smart contract developer workbench, not just a side feature.

It should help developers:

- write code
- explain code
- document code
- comment code
- generate tests of every important kind
- review and improve code
- prepare code for serious audit

And it should do all of that in the localhost web UI with dedicated screens, not as hidden backend capabilities.

That is the right direction for `srp dev`.
