# CI reporting to Google Docs

The existing CI triggers are unchanged. Frontend and Backend remain independent.
`Google Docs report` waits for both jobs and runs with `always()` only for `push`
to `master` or `workflow_dispatch` on `master`. Pull requests and manual runs on
other branches never get Google credentials or update the document.

## Data flow and access

1. `scripts/ci/runCheck.js` executes the existing npm commands, preserves their
   exit codes, and captures a bounded stdout/stderr tail in memory. Original
   command output goes to the normal Actions log, not into diagnostic files.
2. `checkResults.js` exports only numeric counters and a fixed list of diagnostic
   codes. Arbitrary messages, assertion values, source lines, filenames, URLs,
   tokens, headers, cookies, credentials, MongoDB URIs and `.env` contents are
   never copied into these diagnostic artifacts.
3. Check jobs upload explicit JSON filenames for seven days, even after failure
   when the runner is still able to execute the upload step. Job outputs provide
   GitHub's actual conclusions and the attempt that produced the checks.
4. `report.js` combines those conclusions with validated diagnostics. Missing,
   malformed, expired or mismatched reports are shown as unavailable; they never
   become zero failures or a fabricated passing check. Source attempts are kept
   when only the reporting job is rerun. Reports include UTC time, full SHA,
   commit/run links and check-artifact links. Detailed errors remain behind
   GitHub's normal log access controls.
5. The complete sanitized JSON/text report is uploaded **before** authenticating
   to Google. `google-github-actions/auth` uses WIF through a dedicated service
   account and obtains a short-lived token with only the `documents` scope. No
   service-account JSON key or credential file is created.
6. `googleDocReport.js` reads only the configured document, then atomically deletes
   its old body and inserts the full report with `documents.batchUpdate` and
   `writeControl.requiredRevisionId`. It rereads the document to verify the result.
   It never calls Drive APIs, changes sharing/ownership or operates on other files.

Google tokens exist only in the publishing step's environment, after all test
commands and report preparation. The publisher prints only fixed delivery states
or safe HTTP error codes; Google response bodies and document text are not logged.
The prepared report and delivery status artifacts have seven-day retention, also
when Google authentication or sending fails. Only this job has `id-token: write`.
No project dependencies or permanent credentials are needed for the scripts.

## One-time Google Cloud setup

These are owner/admin actions. Run the commands in **Google Cloud Shell (bash)**
using your own authorized Google Cloud session. Do not send anyone your password,
create a JSON key, enable domain-wide delegation or grant project Editor to the
service account.

1. Choose a Google Cloud project. Confirm the GitHub identity: currently
   `DmkGrbzv/react-pick-color-extension`, repository ID `1373728893`, owner ID
   `33005762` (verified 2026-11-05). Numeric IDs protect against name reuse.
   Check them again if the repository is renamed, transferred or forked:
   `gh api repos/DmkGrbzv/react-pick-color-extension --jq '{repository_id: .id, owner_id: .owner.id}'`.
2. Set the project and enable the APIs:

   ```bash
   REPORT_PROJECT_ID="replace-with-your-project-id"
   REPORT_PROJECT_NUMBER=$(gcloud projects describe "$REPORT_PROJECT_ID" --format='value(projectNumber)')
   REPORT_REPO="DmkGrbzv/react-pick-color-extension"
   REPORT_REPO_ID="1373728893"
   REPORT_OWNER_ID="33005762"
   gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com docs.googleapis.com --project="$REPORT_PROJECT_ID"
   ```

3. Create a dedicated account and pool. Leave project roles empty for the account:

   ```bash
   gcloud iam service-accounts create github-ci-reporter --display-name="CI document reporter" --project="$REPORT_PROJECT_ID"
   REPORT_SERVICE_ACCOUNT="github-ci-reporter@${REPORT_PROJECT_ID}.iam.gserviceaccount.com"
   gcloud iam workload-identity-pools create github-ci --location=global --display-name="GitHub CI" --project="$REPORT_PROJECT_ID"
   ```

4. Create the OIDC provider. The condition restricts repository/owner IDs,
   repository name, `master`, this exact workflow and the two allowed events:

   ```bash
   gcloud iam workload-identity-pools providers create-oidc github-master \
     --project="$REPORT_PROJECT_ID" --location=global --workload-identity-pool=github-ci \
     --issuer-uri="https://token.actions.githubusercontent.com" \
     --attribute-mapping="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.repository_owner_id=assertion.repository_owner_id,attribute.repository=assertion.repository,attribute.ref=assertion.ref,attribute.workflow_ref=assertion.workflow_ref,attribute.event_name=assertion.event_name" \
     --attribute-condition="assertion.repository_id == '${REPORT_REPO_ID}' && assertion.repository_owner_id == '${REPORT_OWNER_ID}' && assertion.repository == '${REPORT_REPO}' && assertion.ref == 'refs/heads/master' && assertion.workflow_ref == '${REPORT_REPO}/.github/workflows/ci.yml@refs/heads/master' && (assertion.event_name == 'push' || assertion.event_name == 'workflow_dispatch')"
   ```

5. Permit only this pool/repository identity to impersonate that service account:

   ```bash
   gcloud iam service-accounts add-iam-policy-binding "$REPORT_SERVICE_ACCOUNT" \
     --project="$REPORT_PROJECT_ID" --role=roles/iam.workloadIdentityUser \
     --member="principalSet://iam.googleapis.com/projects/${REPORT_PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-ci/attribute.repository_id/${REPORT_REPO_ID}"
   ```

   This binding is on the service account, not the entire project. Standard WIF
   impersonation needs no additional Token Creator role or user impersonation.
   Keep this pool dedicated; do not add another broadly trusted provider to it.

6. In Google Docs, the owner manually gives this service-account email **Editor**
   access to **only** the target document `logs github`. Use one ordinary document
   tab, with no child tabs. Leave ownership, link visibility and every other user's
   permissions unchanged; do not share a folder or other Drive files. The initial
   publication replaces the document body, so use this document exclusively for CI.

References: [Google WIF deployment pipelines](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines),
[service-account WIF configuration](https://github.com/google-github-actions/auth#workload-identity-federation-through-a-service-account),
[Docs batchUpdate and revision checks](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/batchUpdate).

## GitHub Variables and first run

Under **Settings → Secrets and variables → Actions → Variables**, add repository
Variables (configuration IDs, not passwords):

| Variable                         | Value                                                                                              |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `GOOGLE_DOC_ID`                  | The supplied target document ID, without the URL                                                   |
| `GCP_PROJECT_ID`                 | `$REPORT_PROJECT_ID`                                                                               |
| `GCP_REPORT_SERVICE_ACCOUNT`     | `$REPORT_SERVICE_ACCOUNT`                                                                          |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-ci/providers/github-master` |

The provider value uses the project **number**, not its ID. Obtain the exact value:

```bash
gcloud iam workload-identity-pools providers describe github-master --project="$REPORT_PROJECT_ID" --location=global --workload-identity-pool=github-ci --format='value(name)'
```

Publish the workflow and scripts through a PR into `master`. The merge push runs
the checks and reporting. Alternatively, after the workflow exists on the default
branch, choose **Actions → CI → Run workflow → master**. Inspect all three jobs.
Only `published-and-verified` confirms a new verified Google write. Check the
document's commit/run links against that Actions run. A missing Variable, denied
WIF binding or missing document permission fails the reporting job while leaving
the Frontend/Backend results intact. Use **Re-run failed jobs** after fixing setup.

## Dry-run and validation

From the repository root, without any Google credentials:

```sh
node scripts/ci/report.js --dry-run --context scripts/ci/example.json
node scripts/ci/googleDocReport.js --dry-run
node --test tests/ciReporting.test.js
```

The example contains a fake SHA/run and mixed success/failure results; its links
are demonstration values, not evidence of a real run. Generated files live under
ignored `.ci-reports/`. Tests use a fake Docs server: they cover secret exclusion,
missing reports, success/failure/skipped/cancelled states, reused check attempts,
duplicate publication, old-run rejection, concurrent revision conflicts, API
errors, unsupported tabs and post-write verification. They never contact Google.

For the first live validation: test a passing master run; in an authorized test
change, test a failing check; rerun the failed reporting job; and try rerunning an
older run after a newer report exists. Check retained artifacts and the document.
Do not merge an intentionally broken test into a protected production branch just
to exercise reporting; use a controlled test of the pipeline and restore the test.

## Ordering, retries and limits

The footer `CI_REPORT_STATE` reserves the repository/workflow identity, run number,
attempt, run ID and content digest. Do not edit or remove it. The document must
have one tab; multiple tabs fail explicitly instead of updating only part of it.

Reporting jobs are serialized for this repository/document. The document's marker
and required-revision compare-and-swap are the final ordering check: even an old
job that resumes late cannot overwrite a newer report. A reporting retry may use
an earlier attempt's completed check artifacts, but a newer job never borrows
another attempt's diagnostics. Duplicate identical writes are skipped; an
unexpected different report for the same attempt fails. Revision conflicts and
ambiguous write failures reread the document before retrying, at most three times.

Forced cancellation, runner loss or GitHub/Google outages can stop the reporting
or artifact-upload steps entirely. `always()` is best effort, not a separate
out-of-band notification service. The next completed run can publish normally.
Missing/expired diagnostics remain explicit. Native Actions log retention follows
repository policy; the sanitized artifacts request seven-day retention.

Keep the existing Frontend/Backend required checks in branch rules. Reporting is
skipped on PRs; its credentials and success must not be required to test a fork.
If this workflow's run-number sequence is deliberately reset, coordinate a manual
reset of the reserved footer before publishing the new sequence.
