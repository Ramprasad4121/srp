# Deployment

## Local

```bash
npm test
npm run dev
```

## Docker

```bash
docker build -t srp .
docker run -p 8080:8080 -e SRP_TOKENS="$(openssl rand -hex 16):admin:me" -v srp-data:/data srp
```

The image runs as `node`, listens on `0.0.0.0:8080`, stores state in `/data/state.json`, and has demo tokens disabled. `bash scripts/docker-smoke.sh` builds and checks it (CI runs this on every PR).

## Kubernetes

```bash
kubectl create secret generic srp-tokens --from-literal=SRP_TOKENS="$(openssl rand -hex 16):admin:ops"
kubectl apply -f infra/k8s/deployment.yaml
```

The manifest runs one replica with a persistent volume. The JSON file store is single-process; more replicas need the planned PostgreSQL store and shared SSE fanout.

## Behind a reverse proxy

Unauthenticated requests are rate limited per client IP. Behind a load balancer or ingress every request arrives from the proxy's address, so all anonymous clients would share one bucket. Set `SRP_TRUST_PROXY` to the number of proxies in front of SRP (`true` means 1):

```bash
docker run -p 8080:8080 -e SRP_TRUST_PROXY=1 -e SRP_TOKENS=... srp
```

SRP then uses the Nth `X-Forwarded-For` entry from the right, the address your outermost trusted proxy saw. Entries further left are set by the client and ignored. Leave it unset (the default) when clients connect directly, otherwise anyone could pick their own bucket by sending the header. Authenticated requests are limited per token subject either way.

## Production Notes

- Replace demo bearer tokens with an identity provider and short-lived JWTs.
- Configure PostgreSQL for audit and report storage.
- Configure Redis for distributed rate limiting and SSE fanout.
- Store secrets in the platform secret manager, not environment files.
- Run API instances behind TLS and a Web Application Firewall.
- Keep detector and integration adapters versioned independently from the core engine.


## Launch scope: local and CI first

The public launch is the CLI (`srp scan`), the MCP server, and the GitHub Action. The web server stores state in a single JSON file and rewrites it per request, including the audit log, so it is meant for one operator on a trusted machine or private network. We do not run a hosted demo and do not recommend exposing it to the internet. A SQLite or Postgres backend with append-only audit entries is on the roadmap before any hosted offering.
