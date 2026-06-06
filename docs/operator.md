# Operator Guide

## Local Operation

Run:

```bash
npm run dev
```

Open `http://localhost:8080`. Use `srp_demo_admin_token` for all local dashboard features.

## Security Rules

- Do not treat candidate findings as final audit findings.
- Do not publish high severity issues unless status is `proven`.
- Review every `partial` PoC result before remediation guidance is sent to customers.
- Monitor audit logs for privileged API access.
- Rotate demo tokens before any shared environment is exposed.

## Runtime Monitoring

Signals include protocol, chain, source, metric, value, and threshold. Values above threshold create incidents. Values above twice the threshold are high severity.
