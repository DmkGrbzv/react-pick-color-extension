# Tintoom Local-Only release candidate

RPC-6; baseline master 6a16507bfbb084d6ba4de142357e5ef63c8091d9.
This is preparation only. Do not upload or publish automatically.

## Reproduce on Windows (repository root)

Use the Node version permitted by package.json (verified locally with 22.22.3).
Keep real secrets out of VITE_ configuration. Existing .env.local is not changed.

```powershell
$previousCloudFlag = $env:VITE_ENABLE_CLOUD
try {
  $env:VITE_ENABLE_CLOUD = 'false'
  npm.cmd run lint
  if ($LASTEXITCODE -ne 0) { throw 'Lint failed' }
  npm.cmd test
  if ($LASTEXITCODE -ne 0) { throw 'Tests failed' }
  npm.cmd run package
  if ($LASTEXITCODE -ne 0) { throw 'Package failed' }
  npm.cmd run verify:extension
  if ($LASTEXITCODE -ne 0) { throw 'Extension verification failed' }
} finally {
  $env:VITE_ENABLE_CLOUD = $previousCloudFlag
}
```

Package script builds first and writes release/color-palette-1.0.0.zip using the
manifest version. Only dist contents enter the ZIP. Recheck version against the
owner's Store Dashboard before upload; no previous store release is assumed.
Generated ZIP timestamps can differ between builds; use the recorded SHA-256 to
identify the exact accepted artifact rather than claiming byte-identical archives.

Local-Only manifest: MV3, Chrome 116+, storage / sidePanel / tabs; no identity,
host_permissions, content scripts or remote executable code. Storage keeps the
working palette and preferences. sidePanel drives the native panel. tabs supports
existing URL/pendingURL inspection and extension-tab reuse; it is not used for
browsing-history collection. Chrome documents that sensitive tab properties need
tabs/host access, while basic tab creation does not: [Tabs API permissions](https://developer.chrome.com/docs/extensions/reference/api/tabs).

EyeDropper is the browser-provided, explicitly invoked color picker; the app stores
the returned HEX, not screen images: [EyeDropper API](https://developer.chrome.com/docs/capabilities/web-apis/eyedropper).

## Data and behavior

- VITE_ENABLE_CLOUD defaults off; only true plus an API URL opts into the existing
  cloud build. UI, worker HTTP client and generated manifest use the same flag.
- Working palette, gradients, preferences, local copies and old account data are
  not migrated/deleted. The device-backup block is omitted from the Local-Only
  working screen by owner request; backup services remain available for later backend work.
- Legacy library.html and #view=library links safely show the working screen.
  Print/full-view/navigation and reload use the same app and worker queue.
- One visible Already added / Вже додано state is derived from current local data;
  origin remains in aria labels, and Classic / With my color semantics are retained.
- No analytics, cloud/OAuth requests, content scraping or remote code are introduced.
  Clipboard writes happen only on explicit copy actions; browser print is explicit.

## P0 before Store submission — owner/manual

1. Extract the generated ZIP into a separate folder, confirm manifest.json is at its
   root, and use chrome://extensions > Developer mode > Load unpacked for that
   extracted folder. Reload/reopen panels and app tabs after changing the build.
   Use a separate test profile so installation/testing cannot affect real data.
2. Go offline and verify EyeDropper pick and Esc cancel; one/batch add and dedup;
   clear/reorder/remove; gradients and HEX/CSS copy; historical modes and exact
   source HEX; narrow panel at 240–430 px and 125/200% zoom; keyboard focus; en/uk
   and light/dark; print; two-window/tab sync; close/reopen/browser reload.
3. Verify fresh and upgraded profiles: no cloud/sign-in/save prompts, no network
   cloud attempts or device-backup controls, safe old library links, and preserved
   prior account/pending/backup data. Record the tested ZIP
   hash, Chrome version and results. Automated substituted-browser tests do not
   satisfy this step. The owner selected manual browser verification.
4. Provide the real publisher/support contact and public privacy-policy URL; owner
   must review and publish accurate disclosures for this exact build. Local-only
   processing/storage still requires data-handling disclosure: [Chrome policy FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq).
5. Finalize listing name/description and screenshots using the actual build. Name:
   Tintoom; manifest currently version 1.0.0, uk default with en/uk metadata. Supply
   panel/full-view screenshots, single-purpose and permission explanations, audience
   and distribution selections, and confirm any account requirements in Dashboard.
6. Check manifest/icons/locales, MIT notices and all archive entry points. Follow
   the [preparation checklist](https://developer.chrome.com/docs/webstore/prepare)
   and [publishing instructions](https://developer.chrome.com/docs/webstore/publish).
   Upload/submission/publication remains an owner action with separate approval.

Privacy disclosure drafting facts (owner to review, no fictitious contact/URL):
Tintoom processes selected color HEX values, palette names/items and preferences
locally in the Chrome profile to provide color tools and printing. Local copies
remain readable in that profile until explicitly removed. This build does not send
those data to a backend or initiate Google sign-in. Legacy sessions/pending saves
from earlier versions are retained locally for compatibility and are not used or
transmitted while cloud is disabled. Tab URLs are compared locally only to manage
Tintoom's own panels/tabs; browsing history is not collected or transmitted. Copy
and printing are user-triggered. Explain access/deletion/retention and protection
of the device/profile; local storage is not an encrypted vault. State the owner's
real support contact and effective policy date when publishing the policy.

## P1 after release

Consider reducing tabs permission only after testing restored/pending own-extension
URLs and multi-window reuse in Chrome. Track any deferred optional UX separately;
keep cloud re-enablement behind an explicit build decision and appropriate QA.

## Evidence and decision

Record exact branch/commit, commands/results, ZIP path/hash/size and remaining P0
in the single RPC-6 Notion journal. GO requires all P0 evidence and owner materials.
Until then: NO-GO for Chrome Web Store, even when code checks are green.

## Reminder when backend work resumes

Owner request, 2026-11-26: revisit the device-backup block before restoring it.
Agree its purpose and placement first. Check whether a saved backup actually exists;
hide or disable view/delete when none exists, avoid empty confirmation/success flows,
and refresh the state after deletion. Verify guest/signed-in and offline cases.
The block was removed from the Local-Only working screen; the reusable component
and storage services were retained. No actual user backup was inspected.
