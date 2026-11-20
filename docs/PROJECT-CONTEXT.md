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

## Device-backup local preview

The approved first backup slice is implemented as a local working diff based on 449636590b3ce4655f3f2f56d616973f5a83f957. The pre-existing BETA-SPEC and SECURITY-AUDIT drafts are preserved. BETA-SPEC has an appended section recording the narrow approved scope and chosen device safety bounds. The broader independent security audit remains unfinished.

The saved-palettes feature owns validation, capture/persistence and UI. Four backup commands use the existing extension-page sender allowlist and sanitized worker error boundary. Trusted Chrome storage initializes even when cloud configuration is unavailable. One versioned key stores names/items, timestamp and count. Explicit access is separate from cloud cards, survives sign-out, and remains available for offline viewing/deletion. Opening uses the existing working-palette queue and confirmation version. Every stored read is validated. Account-specific React remounts and storage-change invalidation clear displayed copies.

Creation captures all API pages with duplicate/cursor/size limits, cancellation, a session epoch/token guard and a final guarded atomic storage write. The old copy survives request/validation/storage failure. Deletion cancels capture and shares the local commit queue, preventing resurrection. The API currently offers no point-in-time snapshot across pages. One copy per profile and four-card local view pagination are implementation choices for the preview. Unsupported data fails the whole capture. Gradient values must match the existing local normalizer, including its integer stop positions.

### Try the preview in Chrome

From the repository root run npm.cmd run build and npm.cmd run verify:extension. Open chrome://extensions, enable Developer mode, and reload the existing unpacked extension or Load unpacked from D:/PetProjects/react-pick-color-extension/dist. Open Saved palettes and find Backup on this device. An active configured cloud API and application sign-in are required for creation. Existing local development launch instructions remain in docs/backend-delivery.md.

Save a backup, accept the shared-device/persistence warning, then explicitly view it. Check mixed gradients, names and multiple pages. Sign out or stop the local API, reopen Saved palettes and explicitly view the device copy. Copy a color, open a set into the working palette with confirmation, and delete the device copy. A new account starts with device contents hidden. Anyone using the same browser profile can still explicitly view this unencrypted copy until deletion. The copy is independent of the cloud library and its records.

The Chrome extension and real account flows still require manual acceptance. Automated UI tests use jsdom and a mocked extension transport. Tests, review status and remaining limitations are recorded in the project journal after the final checks.

## Backup merge gate on 2026-11-15

The worktree remains based on 449636590b3ce4655f3f2f56d616973f5a83f957 with local backup edits and preserved beta/security drafts. Open-PR discovery returned no open PRs. The root suite passed 136 tests during this resumed check.

A targeted local source-level reproduction found a merge blocker that existing tests missed. DeviceBackupService.create commits under SessionStore.withSession and calls assertSession again inside that lock. When the session expires during that nested read, SessionStore.session awaits clear(), which queues behind the same held lock. A mocked-storage reproduction advances Date.now on the fifth persistent read and races capture against a 150 ms timer. Result was persistentReads=5, outcome=blocked. No network or user data was used. This is a reproduced deadlock rather than a confirmed deployed incident.

Proposed repair separates ordinary session checks from the final locked guard. Under withSession, verify captured epoch, cancellation and expiry without calling session()/clear() again. Add a deterministic expiry-at-commit regression and verify queue recovery, unchanged prior copy and logout completion. The user requested discussion before nontrivial fixes, so approval was requested and implementation/merge is paused at this gate. An isolated independent review was requested, with its actual outcome to be recorded separately.

The existing Nginx runbook validates config and reloads as separate fail-fast commands. Templates use TLS 1.2/1.3, HTTP-01 renewal, loopback proxying and overwritten forwarding headers. Access logs exclude URLs/query/credentials and per-site error logs are disabled to avoid callback leakage. Application image rollback preserves MongoDB data and does not undo startup/index or data changes. AWS account/region/budget/domain/SSH/Atlas/OAuth prerequisites remain unverified pending owner inputs.

## RPC-1 resumed on 2026-11-20

The user explicitly authorized RPC-1 through the project manager handoff on 2026-11-20, including the minimal expiry deadlock repair and regressions. This later authorization resolves the earlier discussion gate. The retained backup diff was reconciled against master 449636590b3ce4655f3f2f56d616973f5a83f957. Beta/security drafts remain local user documents.

The final commit guard now uses epoch, cancellation and captured expiry checks under withSession without re-entering session()/clear(). A deterministic regression advances the clock at the locked epoch read. It failed before the change with blocked instead of sessionChanged and passed after the fix. It also verifies unchanged prior backup, successful logout, queue recovery and a later successful capture. Ten focused backup tests passed. Independent review and final PR/CI outcomes are recorded in the single RPC-1 journal entry.

Previously authorized delivery checks are covered by the actual CI/publication runs linked in the journal and the existing Nginx/rollback source review. Real EC2/HTTPS/reboot/rollback acceptance remains dependent on AWS account, region, budget, domain/IP, SSH identity/permissions, Atlas egress and OAuth inputs. Dependency diagnostics remain deferred under their separate approval workflow. Broader beta/security audit drafts and upstream testing research remain review-stage follow-ups, outside this minimal repair.
