# SRP Dockerization Recommendation

## 1. Short Answer

Yes, Dockerizing SRP is worth it.

But only if you do it the **right way**.

The correct answer is:

- Dockerize SRP infrastructure and execution surfaces
- Do **not** blindly shove the entire product into one giant container
- Use Docker as a reliability, isolation, and portability layer
- Keep local developer ergonomics and host project access in mind

So:

- `yes` to Docker
- `no` to naive Dockerization

## 2. Why Dockerizing SRP Is Worth It

SRP is a hard product to run cleanly because it depends on:

- Python right now
- web server runtime
- Foundry / `forge`
- `anvil`
- possibly Hardhat / Node projects
- Slither
- Aderyn
- local Solidity projects as audit targets
- PoC execution
- optional sandboxing

That is exactly the kind of product where Docker helps.

## 3. What Docker Solves For SRP

Docker helps with:

### 3.1 Reproducibility

Every contributor and user gets the same:

- Foundry version
- Slither version
- Python runtime
- system packages
- optional Node/Hardhat toolchain

### 3.2 Toolchain sanity

Right now SRP clearly depends on external binaries:

- `forge`
- `anvil`
- `slither`
- `aderyn`
- `uvicorn`

Docker reduces "works on my machine" failure.

### 3.3 Safer execution

SRP runs analysis and PoC-related code against untrusted or semi-trusted projects.

Docker gives:

- process isolation
- dependency isolation
- cleaner execution boundaries

### 3.4 Easier onboarding

Users should not need to hand-install 12 things before trying SRP.

### 3.5 Better future TypeScript migration path

When SRP moves to a TS monorepo, Docker becomes even more useful because you can cleanly separate:

- gateway
- web
- worker
- tool runners

## 4. What Docker Does Not Automatically Solve

Docker does **not** solve:

- bad architecture
- bad repo structure
- unclear runtime boundaries
- poor security policy
- poor UX

So Docker is useful, but it is not the architecture.

## 5. Current SRP Signals That Dockerization Makes Sense

There are already local signs in the codebase that Docker is a good fit:

- Docker sandbox helper:
  [src/srp/core/sandbox/docker_env.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/core/sandbox/docker_env.py)
- exploit sandbox using Docker:
  [src/srp/agents/exploit/sandbox.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/agents/exploit/sandbox.py)
- Foundry / Anvil heavy workflow:
  [src/srp/core/poc_verifier.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/core/poc_verifier.py)
  [src/srp/core/anvil.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/core/anvil.py)
- web server runtime:
  [src/srp/server/server.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/server/server.py)
- project requires Foundry:
  [README.md](/Users/ramprasadgoud/Downloads/building/srp/README.md)

So the repo already points toward controlled container execution.

## 6. The Correct Docker Strategy

Do **not** start with:

- one giant `Dockerfile`
- one container doing everything
- mounting half the machine into it

Instead use a **multi-service, layered strategy**.

## 7. Recommended Docker Topology

For future SRP, the best setup is:

```text
docker/
  base/
  gateway/
  worker/
  toolchains/
  compose/
```

And the runtime topology should be:

- `srp-gateway`
- `srp-web` (optional if served separately)
- `srp-worker`
- `srp-toolchain-foundry`
- `srp-toolchain-static`
- optional `srp-db`

## 8. Recommended Container Roles

## 8.1 `srp-gateway`

Purpose:

- API server
- WebSocket event stream
- session control
- orchestration surface

Should contain:

- app runtime
- config loading
- event routing
- approval endpoints

Should not contain:

- heavy static analysis binaries
- PoC execution runtimes

## 8.2 `srp-worker`

Purpose:

- long-running jobs
- report generation
- diagram generation
- phase execution dispatch

Should contain:

- worker runtime
- job consumers
- artifact generation

Should not contain:

- interactive UI server

## 8.3 `srp-toolchain-foundry`

Purpose:

- `forge`
- `anvil`
- Foundry-based tests
- PoC execution

This should be isolated because it is execution-heavy and most likely to need tuned security controls.

## 8.4 `srp-toolchain-static`

Purpose:

- Slither
- Aderyn
- other static analysis tooling

This should be separate from Foundry because:

- different dependency stack
- cleaner upgrades
- less bloated images

## 8.5 `srp-web`

Optional.

If the gateway serves the frontend directly, you may not need this.

If the frontend becomes a full TS app, then a separate web container is useful.

## 8.6 `srp-db`

Only if SRP moves to:

- Postgres
- Redis
- or another external datastore

If SRP uses SQLite locally, the DB can live on a volume instead.

## 9. What Should Be Dockerized First

Do not Dockerize everything at once.

Recommended order:

### Phase 1

Dockerize:

- SRP web/API server
- minimal runtime dependencies

Goal:

- `docker compose up`
- open localhost
- app boots reliably

### Phase 2

Dockerize:

- Foundry toolchain runner
- static analysis toolchain runner

Goal:

- analysis tools run through controlled containers

### Phase 3

Dockerize:

- worker runtime
- queue/job execution
- persistent volumes

### Phase 4

Optional:

- dev containers
- CI images
- production deployment images

## 10. What Should Not Be Bundled Into One Container

Do not put all of these into one runtime image:

- UI app
- gateway server
- Foundry
- Slither
- Aderyn
- PoC sandbox
- browser tooling
- DB

Why not:

- image becomes huge
- slower builds
- poor caching
- poor security isolation
- hard to debug
- hard to upgrade toolchains independently

## 11. Host Mount Strategy

This matters a lot.

SRP audits local projects.
So containers must access the audit target cleanly.

Recommended strategy:

- mount the target project read-only by default
- mount a separate writable SRP workspace for:
  - traces
  - notes
  - reports
  - generated PoCs
  - temporary files

Example logical mounts:

- `/workspace/target` -> audited project, read-only
- `/workspace/srp-data` -> SRP outputs, writable
- `/workspace/cache` -> tool caches, writable

This is much better than mounting the target project writable by default.

## 12. Volume Strategy

Use named volumes for:

- tool caches
- database state
- report output if needed
- npm/pnpm/pip cache layers

Use bind mounts for:

- local source code during development
- audit target repo

## 13. Security Model

Docker is especially worth it for SRP because of security.

Recommended security posture:

- run containers as non-root
- read-only root filesystem where possible
- explicit writable mounts only
- no privileged containers
- no host networking by default
- constrained CPU/memory for risky execution containers
- separate execution container for PoCs
- separate execution container for static analysis

SRP is literally a security product.
Its runtime should not be sloppy.

## 14. Development Workflow Recommendation

For local development, the best experience is:

### Option A: Hybrid dev mode

- run app code locally
- run heavy toolchains in Docker

This is best early on.

Why:

- faster iteration
- simpler debugging
- still gets toolchain reproducibility

### Option B: Full Docker dev mode

- gateway in Docker
- worker in Docker
- toolchains in Docker

This is good later, but it is heavier.

Recommendation:

- start with hybrid dev mode
- move to full Docker mode after architecture stabilizes

## 15. CI/CD Recommendation

Docker is very worth it for CI.

Best uses:

- deterministic test environment
- deterministic static analysis environment
- deterministic report rendering environment
- deterministic release packaging

CI should absolutely use Docker images for:

- toolchain tests
- integration tests
- end-to-end audit runs

## 16. Production/Hosted Deployment Recommendation

If SRP ever becomes hosted or team-based, Docker is basically required.

Why:

- orchestration becomes manageable
- worker scaling becomes manageable
- execution boundaries become manageable

If SRP stays mostly local-first, Docker is still worth it for:

- install simplicity
- stable tooling

## 17. Best File And Folder Layout For Docker Support

Recommended:

```text
docker/
  README.md
  base/
    Dockerfile.python
    Dockerfile.node
  gateway/
    Dockerfile
  worker/
    Dockerfile
  toolchains/
    Dockerfile.foundry
    Dockerfile.static-analysis
  compose/
    docker-compose.dev.yml
    docker-compose.local.yml
    docker-compose.ci.yml
```

And root files:

```text
.dockerignore
docker-compose.yml           # optional convenience entrypoint
```

## 18. Best Compose Strategy

Recommended compose profiles:

- `dev`
- `local`
- `ci`

### `dev`

- app code bind-mounted
- hot reload if relevant
- toolchain containers available

### `local`

- production-like local run
- stable containers

### `ci`

- deterministic testing
- no unnecessary dev mounts

## 19. Suggested Build Strategy

Use:

- multi-stage builds
- layer caching
- separate base images for Python and Node if needed during migration

If SRP becomes TS-first later, then:

- gateway/web/worker can share Node base layers
- toolchain containers remain separate

## 20. One Important Warning

Do not let Docker become an excuse to avoid fixing architecture.

Bad pattern:

- "just run it in Docker"
- giant container
- hidden complexity
- unclear volumes
- unclear trust boundaries

Good pattern:

- clean boundaries first
- Docker reflects the architecture

## 21. Practical Recommendation For SRP Specifically

For SRP, the best answer is:

### Yes, Dockerize SRP

Because SRP has:

- heavy toolchains
- local project auditing
- PoC execution
- web server
- sandboxing needs

### But Dockerize it in layers

Recommended final model:

- one container for gateway
- one for worker
- one for Foundry execution
- one for static analysis tools
- optional one for frontend

### Do not start by containerizing everything

Start with:

- gateway container
- toolchain containers

That gives you the biggest benefit earliest.

## 22. Final Recommendation

Dockerizing SRP is a good idea and worth doing.

The correct implementation approach is:

1. Dockerize SRP selectively, not monolithically
2. Separate app runtime from toolchain runtime
3. Mount audit targets read-only by default
4. Use a writable SRP workspace volume for outputs
5. Use Docker heavily for CI and toolchain reproducibility
6. Start with hybrid local dev, then expand

That is the best Docker strategy for SRP.
