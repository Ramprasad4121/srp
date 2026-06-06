# Deployment

## Local

```bash
npm test
npm run dev
```

## Docker

```bash
docker build -t srp .
docker run -p 8080:8080 srp
```

## Kubernetes

```bash
kubectl apply -f infra/k8s/deployment.yaml
```

## Production Notes

- Replace demo bearer tokens with an identity provider and short-lived JWTs.
- Configure PostgreSQL for audit and report storage.
- Configure Redis for distributed rate limiting and SSE fanout.
- Store secrets in the platform secret manager, not environment files.
- Run API instances behind TLS and a Web Application Firewall.
- Keep detector and integration adapters versioned independently from the core engine.
