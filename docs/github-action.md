# GitHub Action

Scan every pull request and show findings in GitHub code scanning (SARIF). No install step, no dependencies.

```yaml
name: srp
on: [pull_request, push]
permissions:
  contents: read
  security-events: write
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Ramprasad4121/srp@main   # pin a release tag once one exists
        with:
          path: .
          fail-on: high
```

| Input | Default | |
| --- | --- | --- |
| `path` | `.` | project directory |
| `fail-on` | `high` | `none`, `low`, `medium`, `high`, `critical`. Uses the detector's proposed severity. |
| `chain` | detected | `ethereum` or `solana` |
| `sarif-file` | `srp.sarif` | report path |
| `upload-sarif` | `true` | needs `security-events: write`; on private repos code scanning needs GitHub Advanced Security. Set `false` to only gate. |

The job fails with SRP's exit code (1 = findings at or above `fail-on`). The SARIF is uploaded first, so alerts appear even when the job fails.

SRP is a static scanner. It reports what it could not analyze as residual unknowns and does not claim a finding is exploitable without a PoC you ran. See [eval.md](eval.md) for measured precision and misses.
