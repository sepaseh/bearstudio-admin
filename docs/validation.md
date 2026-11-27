# Validate a source-preparation snapshot

The [publication policy](../.github/bootstrap-policy.json) determines admitted
paths. The [validation manifest](../.agents/validation.json) lists the ten
required checks and their canonical order. The full profile verifies the exact
admitted source snapshot. This phase does not provide an application build, browser
journeys, provider compatibility, visual approval or deployment.

Export the exact proposed source into an ignored repository-local directory.
Keep fixtures under an ignored scratch directory and set TMP, TEMP and TMPDIR
to it. Set GIT_CEILING_DIRECTORIES to the common verification parent so tests
cannot discover an implementation checkout through an ancestor. Use the Node
release in [.nvmrc](../.nvmrc) and run these commands from the export root:

```sh
npm ci --strict-peer-deps --no-audit --no-fund
npm run validate -- full
```

The local full profile uses no browser. The historical single-pass workflow
installs its selected browser before running the canonical profile. The required
audit uses the npm registry; an unavailable or incomplete audit remains a failure.
The unit report measures the admitted modules and dependency-audit tooling. The governance report
measures the admitted policy tools, guidance guards and their support code.

Record the checked commit and tree when available, included changes, actual check
outcomes and remaining limits. GitHub Actions, CodeQL, SonarCloud and CodeRabbit
results come from their execution on the applicable review revision.
