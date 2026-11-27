# Contributing

Inspect the current checkout and preserve unrelated work. Work in the intended
checkout. Additional implementation clones, worktrees or copies need explicit
authorization. Keep validation exports, temporary files and evidence under
ignored repository-local directories. Preserve private configuration and use
synthetic test data.

For every PR, confirm the intended live base and count the complete base-to-head
diff, including additions, deletions, renames and binaries. Aim for at most 80
changed-file entries. The maximum is 100 without prior authorization for an
explicitly scoped exception. Recount after a base or scope change.

Run the complete [validation profile](docs/validation.md) on the exact proposed
snapshot before any authorized commit or publication. Report actual local and
hosted evidence in the [PR template](.github/PULL_REQUEST_TEMPLATE.md).
Merging requires the phase's CI, CodeQL, CodeRabbit, configured SonarCloud analysis,
an approving review and resolved conversations. A pending hosted run is not a pass.
