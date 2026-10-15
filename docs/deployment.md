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

The image runs as `node`, listens on `0.0.0.0:8080`, stores state in `/data/state.json`, and has demo tokens disabled.

## Kubernetes

```bash
kubectl create secret generic srp-tokens --from-literal=SRP_TOKENS="$(openssl rand -hex 16):admin:ops"
kubectl apply -f infra/k8s/deployment.yaml
```

The manifest runs one replica with a persistent volume. The JSON file store is single-process; more replicas need the planned PostgreSQL store and shared SSE fanout.

## Production Notes

- Replace demo bearer tokens with an identity provider and short-lived JWTs.
- Configure PostgreSQL for audit and report storage.
- Configure Redis for distributed rate limiting and SSE fanout.
- Store secrets in the platform secret manager, not environment files.
- Run API instances behind TLS and a Web Application Firewall.
- Keep detector and integration adapters versioned independently from the core engine.
