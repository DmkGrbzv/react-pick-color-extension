# React Pick Color: delivery context

## 2026-11-13 — first-deployment recovery

Scope: PR #9 prepares a manual EC2 staging deployment. It does not deploy production or create cloud resources.

An interrupted deployment is different from a failed deployment that completed its cleanup. An interruption may leave a `pending` image in the local deployment state. For the first release, there is no previous working version to roll back to. The new `--resume-first` command retries only that recorded immutable image digest after operator inspection. It rejects an unrelated existing container or a mismatched digest. If recovery fails, it keeps the pending state so another ordinary update cannot silently treat the partial release as a working rollback target.

An image digest identifies exact image contents. A readiness check confirms that the service is ready to accept traffic. Neither establishes that database startup side effects have been reversed: this procedure is not database recovery.

Both Nginx setup blocks now run configuration validation and reload as separate commands under `set -e`, so failed validation stops the block before subsequent setup steps.

Validation before publication: all 14 deployment tests passed, including recovery before/after container creation, failed recovery and retry with a retained stopped container, mismatched digest/container, and invalid recovery state. Focused ESLint and whitespace checks passed. Independent review found no remaining blockers in the implementation; the manager checked the final fixture/retry enhancement. These tests simulate Docker I/O; actual EC2 and production behavior is not verified. Existing Backend CI includes these tests through `npm test` and `tests/*.test.js`. CI and merge outcomes must be checked on GitHub for the exact final revision.

## Remaining delivery gates

1. Pass PR CI and merge the reviewed revision. Check post-merge application jobs, image publication, and Google Docs reporting separately.
2. Track a separate existing edge case: after an ordinary first deployment fails and clears `pending`, a later ordinary update may treat the retained stopped container as a previous release. Resolve and test this before relying on first-deployment retry in staging.
3. Agree the concrete staging plan: cloud cost/resources, domain/IP/SSH identity, credentials and permissions, OAuth/Atlas configuration, and the exact published image digest. Do not store secrets here.
4. Perform and record staging acceptance: HTTPS/API checks, restart recovery, readiness failure, and rollback after a second working release. A passing unit test is not an EC2 acceptance result.
5. Production remains a separate release decision after staging evidence, backups/recovery planning, access controls, monitoring, and deployment approval. The requested cloud/Kubernetes architecture is a target; this EC2/Compose runbook does not establish that Kubernetes exists.

Project journal: https://app.notion.com/p/12dc5a4578cc4d3cb987722ff2ac5b1d
PR: https://github.com/DmkGrbzv/react-pick-color-extension/pull/9

Keep subsequent project changes, outcomes, and explanations in this project context and its journal. The manager repository holds coordination rules and links, not the full application history.
