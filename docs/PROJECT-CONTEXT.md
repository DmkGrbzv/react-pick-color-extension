# React Pick Color: delivery context

## 2026-11-13 — first-deployment recovery

Scope: PR #9 prepares a manual EC2 staging deployment. It does not deploy production or create cloud resources.

An interrupted deployment is different from a failed deployment that completed its cleanup. An interruption may leave a `pending` image in the local deployment state. For the first release, there is no previous working version to roll back to. The new `--resume-first` command retries only that recorded immutable image digest after operator inspection. It rejects an unrelated existing container or a mismatched digest. If recovery fails, it keeps the pending state so another ordinary update cannot silently treat the partial release as a working rollback target.

An image digest identifies exact image contents. A readiness check confirms that the service is ready to accept traffic. Neither establishes that database startup side effects have been reversed: this procedure is not database recovery.

Both Nginx setup blocks now run configuration validation and reload as separate commands under `set -e`, so failed validation stops the block before subsequent setup steps.

Validation before publication: all 14 deployment tests passed, including recovery before/after container creation, failed recovery and retry with a retained stopped container, mismatched digest/container, and invalid recovery state. Focused ESLint and whitespace checks passed. Independent review found no remaining blockers in the implementation; the manager checked the final fixture/retry enhancement. These tests simulate Docker I/O; actual EC2 and production behavior is not verified. Existing Backend CI includes these tests through `npm test` and `tests/*.test.js`. CI and merge outcomes must be checked on GitHub for the exact final revision.

## Remaining delivery gates

1. Pass PR CI and merge the reviewed revision. Check post-merge application jobs, image publication, and Google Docs reporting separately.
2. Verify and merge the focused ordinary-first-failure retry fix described below, then check its exact post-merge CI and publication before staging acceptance.
3. Agree the concrete staging plan: cloud cost/resources, domain/IP/SSH identity, credentials and permissions, OAuth/Atlas configuration, and the exact published image digest. Do not store secrets here.
4. Perform and record staging acceptance: HTTPS/API checks, restart recovery, readiness failure, and rollback after a second working release. A passing unit test is not an EC2 acceptance result.
5. Production remains a separate release decision after staging evidence, backups/recovery planning, access controls, monitoring, and deployment approval. The requested cloud/Kubernetes architecture is a target; this EC2/Compose runbook does not establish that Kubernetes exists.

Project journal: https://app.notion.com/p/12dc5a4578cc4d3cb987722ff2ac5b1d
PR: https://github.com/DmkGrbzv/react-pick-color-extension/pull/9

Keep subsequent project changes, outcomes, and explanations in this project context and its journal. The manager repository holds coordination rules and links, not the full application history.

## Ordinary failed first deployment retry

The regression was reproduced on merged revision b892ce0a2f129044951117f4a5eb7b4edb532aab. Two added cases failed before the fix. Retrying the same digest and trying another digest both attempted rollback to the retained image that had failed its initial deployment.

The fix recognizes persisted current=null, no pending operation and a valid failed image. It checks any retained container against that failed image and keeps the rollback target null until a deployment succeeds. A mismatched container requires operator inspection. Existing interrupted-first recovery continues through --resume-first. Legacy state without a recorded failed first image retains its existing behavior.

Focused verification passed 17 deployment tests. The regressions cover repeated failures, same/different digest retries, a successful retry with no prior release, the following successful update and rollback, and refusal of an unrelated retained container. These tests simulate Docker I/O. PR CI and independent review are recorded in the project journal.

The preceding merge b892ce0 passed all five jobs in push CI run 43422580566. Its publication receipt recorded image digest sha256:0fbb679b97f9ee60f013153ae63e562370a78c6491415773b8ded0fb00fd82de. Google reporting returned published-and-verified.

## AWS staging discovery and approval inputs

Read-only discovery found no AWS CLI or local AWS profile directory. Available connected browser surfaces exposed no AWS session. Project materials contain placeholders for account, region, server, domain and budget. Existing AWS resources and effective IAM permissions therefore remain unverified. The Notion Materials page is blank. Earlier project evidence establishes a configured Atlas staging database and local connection probe, while EC2 egress allowlisting and staging HTTPS OAuth callbacks still need confirmation.

Proposed plan for owner approval uses one Ubuntu 24.04 amd64 EC2, a t3.small sizing candidate, 20 GiB encrypted gp3, one stable public IPv4, host Nginx, and Atlas palette_staging. Confirm the Atlas region before choosing an AWS region. The initial estimate assumes 730 running hours/month, Standard burst-credit mode, and ordinary Ubuntu licensing. Cost is regional EC2 hourly rate times 730 plus regional 20 GiB gp3 storage plus IPv4 and any transfer, DNS/domain, snapshots and Atlas charges. AWS currently lists public IPv4 at USD 0.005/hour, approximately USD 3.65 over 730 hours. A complete monthly quote requires the region and account credit terms. Sources are https://aws.amazon.com/ec2/pricing/on-demand/ , https://aws.amazon.com/ebs/pricing/ and https://aws.amazon.com/vpc/pricing/ .

Required owner inputs are account/region, existing instance details if any, accepted monthly budget, domain/DNS control, administrator public IP and SSH identity, deployment permissions, GHCR read access, and confirmation of Atlas role/network rules and real staging Google OAuth settings. Enter runtime secrets directly in the private server file.

After those inputs, review the concrete cost estimate and existing resources with the owner. Obtain approval of that plan before resource, IAM, network, DNS or deployment actions. Then prepare the verified release bundle, pull the exact published digest, run the existing deploy tool, and record localhost/HTTPS readiness, unauthenticated API rejection and reboot recovery. Rehearse rollback after a second working release. Kubernetes remains a future architecture decision.
