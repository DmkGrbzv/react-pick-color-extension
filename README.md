# Color Palette

A Manifest V3 Chrome extension built with React 19 and Vite 8. The side panel and full tab share a single-page React interface for the working palette, saved palettes, and print preview. Local color and gradient tools work without an account or server; Google sign-in and saved palettes use the optional Node.js/MongoDB backend.

## Run

1. Use Node.js 22.12+ and Chrome 116+.
2. Install dependencies: `npm ci`.
3. Build: `npm run build`.
4. Open `chrome://extensions`, enable Developer mode, and select **Load unpacked**.
5. Choose this project's `dist` folder. Pin the extension and click its icon to open the side panel.

After code changes, rebuild, reload the extension on `chrome://extensions`, and reopen the panel / reload existing extension tabs. Menu navigation inside the running interface does not require a reload.

On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`.

`npm run dev` serves `/sidepanel.html` and `/editor.html` for layout preview. The compatible `/library.html` and `/print.html` entries start the same app on their respective screens. Chrome storage and extension APIs only work inside the installed extension.

## Extension size and ZIP packaging

Only `dist/` is installed in Chrome. `node_modules/`, `src/`, `tests/`, the Git history,
and development tools are not part of the extension. Keep them for development; do not
include the project folder in a release archive.

On Windows, run `npm run package` (or `npm.cmd run package` in PowerShell). This first builds
a clean production `dist/`, then creates `release/color-palette-<manifest-version>.zip`
using built-in Windows compression, with `manifest.json` at the ZIP root. It reports both
the unpacked and ZIP sizes. No packaging dependency is added. Other platforms can ZIP the
contents of `dist/` using their archive tool.

The build target follows `minimum_chrome_version` from the manifest. Native module preload
is retained; its compatibility polyfill is omitted because supported Chrome versions already
implement it. Production minification and shared chunks remain enabled. Each build replaces
old hashed assets, so `dist/` does not accumulate old bundles.

`dist/` and `release/` are generated and ignored by Git. Rebuilding recreates `dist/`;
do not delete it while using it as an unpacked extension. ZIP compression reduces the download
size, not the extension's runtime memory. No features or React runtime are removed.

## Features

- Pick a color anywhere on the screen with EyeDropper. Esc cancels without an error.
- Colors are saved immediately. Duplicate HEX values are ignored and HEX is normalized to uppercase.
- Each swatch includes its HEX code, copy, and remove buttons.
- Switch Working palette, Saved palettes, and Print / PDF in place using the shared menu.
- Use Open full view to open the panel's current screen in a tab, or activate the existing app tab in the same window. Each window may have its own app tab.
- Palette changes synchronize between the panel and editor.
- `chrome.storage.local` stores the palette under `currentPalette`. It survives browser restarts; uninstalling the extension removes its data.

## SPA navigation and state

`App` owns the shared header, menu, footer, working-palette subscription,
and account/library model. WorkingPalettePage, SavedPalettesPage, and PrintPage are
content screens inside that shell. Navigation changes the URL fragment and the
visible React screen, without replacing the document or restarting the app:

- `editor.html#view=working`: current colors, color formats, and full gradient editor.
- `editor.html#view=library`: saved sets, details, renaming, deletion, and save confirmation.
- `editor.html#view=print`: A4 preview and print settings.

The side panel uses the same routes within `sidepanel.html`; clicking a menu item
keeps the interface in the panel. Open full view is the explicit panel-to-tab
action and carries the current screen. An existing full app tab is reused through
a fragment change, preserving its document and query string. Browser Back/Forward,
direct links, and gradient-edit requests are supported. Legacy library/print HTML
entries remain compatible; they are entry points into the same SPA.

Screens mount when first visited and then remain mounted while hidden. This keeps
gradient drafts, save-name input, and print settings across menu transitions.
These temporary values are not persisted across reloads or browser restarts, and
are not shared between separate tabs/panels. Theme, language, color format, and
saved working colors use their existing persistent storage independently.

Each open panel/tab has its own React instance. The worker and Chrome storage are
the source of shared working-palette and authentication data; storage events keep
instances synchronized. One account model within each SPA supplies both its menu
and library screen. Saved sets are requested when entering the library; starting
the working screen or print preview does not fetch the library. Logout/account
changes clear the previous account's library cache and invalidate stale responses.

Transitions use a short content animation and respect reduced-motion preferences.
Only the active screen is visible or printable; application controls are excluded
from the printed document.

## Appearance

The shared header includes light and dark theme buttons on the panel, editor, and print preview.
Light is the default; an explicit choice is saved under `chrome.storage.local.theme`.
`ThemePreference` reads, saves, and subscribes to this one preference; `useTheme` handles UI feedback
and rejects stale reads. It never writes palette data. The saved theme is applied before mounting
the page, and open views follow `chrome.storage.onChanged`.

Theme colors are semantic CSS variables in `styles/base.css`; component and page styles live beside
their owning JSX files. Light uses an indigo accent, dark uses mint on graphite surfaces.
The A4 document keeps its selected white/warm-white paper and dark text in both themes.
Theme controls and the rest of the application UI are hidden when printing.

To verify: switch the theme with a panel and full app tab open, reload them, and check that the setting
persists. Check a narrow panel, the gradient builder, expanded color suggestions, and print preview.
No new permissions, libraries, or palette schema changes are required.

## Global i18n

Only Ukrainian (`uk`) and English (`en`) are supported, using `i18next` and `react-i18next`. All entry points share the setup in `src/i18n/index.js`.

- Dictionaries: `src/i18n/locales/uk.json` and `en.json`.
- Use `useTranslation()` and `t('key')` in components. Add matching keys and interpolation parameters to both dictionaries.
- The language selector is available in both the panel and editor.
- The initial language follows the browser UI language when it is Ukrainian or English; other languages fall back to Ukrainian.
- The selection is stored separately under `chrome.storage.local.language` and synchronized through storage events. Changing language does not modify the palette.
- Notifications store translation keys, so visible messages change language immediately.
- Worker errors use stable codes. The interface translates them rather than displaying browser/OS error strings.
- Page titles, HTML language, accessibility labels, and the default palette heading are translated.
- Chrome metadata uses `public/_locales/{uk,en}/messages.json`. Chrome selects these strings using its UI language, independently of the in-app language selector.

## Structure

```text
src/
├── main.jsx                       # shared React bootstrap for all extension HTML pages
├── App.jsx                        # screen composition and shared palette/account state
├── api/                           # HTTP client and public API configuration; requests run in the worker
├── components/
│   ├── ui/                        # generic icons, color values, and format selection
│   └── common/                    # presentational header, footer, and navigation
├── layouts/
│   └── MainLayout.jsx             # shared panel/tab frame, receiving content and action slots
├── pages/
│   ├── WorkingPalette/            # working palette screen
│   ├── SavedPalettes/             # account library screen
│   └── Print/                     # print screen and its local settings
├── features/
│   ├── auth/                      # account menu, browser sign-in, trusted session storage
│   ├── palette/                   # local palette components, subscription, repository, mutation queue
│   ├── gradients/                 # gradient builder, cards, and editing hook
│   ├── saved-palettes/            # library components, view model, and snapshot service
│   ├── color-advisor/             # suggestions, comparison, actions, and pure suggestion functions
│   ├── preferences/               # theme, language controls, and color-format preferences
│   └── printing/                  # document components and pagination
├── extension/
│   ├── background.js              # worker composition; registers browser listeners synchronously
│   ├── clients/                   # explicit UI-to-worker commands, separate from HTTP
│   ├── messaging/                 # command allowlist, sender checks, dispatch, response boundary
│   ├── panelController.js         # side-panel lifecycle
│   └── openEditorTab.js           # full-view reuse and explicit screen handoff
├── routes/                        # hash routes, history, startup options, and navigation actions
├── hooks/                         # shared UI hooks such as useNotice
├── services/                      # generic storage adapter
├── utils/                         # shared pure color, gradient, snapshot, and URL functions
├── constants/                     # shared operation codes, browser-page names, and identifiers
├── types/                         # palette JSDoc types and validation
├── i18n/                          # dictionaries and language initialization
└── styles/                        # global defaults and shared palette-card styles
```

The root `backend/` directory contains the independent Node.js/MongoDB API.
`public/` holds the manifest, browser icons, and browser translations.
`scripts/` contains build, packaging, and architecture checks.

Components, features, pages, and layouts keep their CSS beside the owning JSX.
Global theme variables remain in `src/styles/base.css`; shared card rules remain in
`src/styles/paletteCard.css`. JSX continues to use explicit imports without barrel files.

### Dependency and state ownership

- `App` composes pages, feature controls, and the layout. It owns one working-palette subscription and one account/library UI model per mounted surface.
- `MainLayout` owns placement only. The header and navigation receive content and action slots; they do not authenticate, save, load data, or import features.
- Pages compose features. Features can depend on shared UI, utilities, browser clients, and other required feature modules; they cannot import pages or application composition.
- Shared components, layouts, types, utilities, storage adapters, and i18n cannot import features or application orchestration.
- Services and models cannot import React or JSX. The UI dependency graph cannot reach credential storage, browser OAuth, the HTTP client, or worker handlers. The worker cannot reach React UI.
- The shared mutation queue in the worker remains the owner of persisted palette changes. HTTP requests and session credentials stay in the worker.
- Visited screens remain mounted when hidden, retaining gradient drafts and print settings. Explicitly opening a saved set still resets the working-screen draft and checks palette version/account state.

`sidepanel.html`, `editor.html`, `library.html`, and `print.html` all load
`src/main.jsx`. Their root elements explicitly declare `data-surface` and
`data-initial-view`. Existing URLs and hash links remain supported; menu navigation
does not reload HTML. The separately built service worker remains `background.js`.

Run `npm run check:architecture` to validate actual import edges, missing local
imports, cycles, layer boundaries, and transitive UI/worker separation.
`npm run lint` also runs this audit. It reports module/import counts and requires
zero cycles and zero boundary violations; these are project checks, not a claim
that a folder convention guarantees production readiness.

The decisions follow [React's state ownership guidance](https://react.dev/learn/thinking-in-react),
[React's state preservation rules](https://react.dev/learn/preserving-and-resetting-state),
[Vite's HTML entry support](https://vite.dev/guide/build#multi-page-app), and
[Chrome's worker lifecycle guidance](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).
The directory names and audit boundaries are project decisions based on those constraints.

Palette mutations run through a single worker queue to prevent lost concurrent
updates. Views update after storage writes. Editor opening also handles concurrent
requests; a restarted worker finds the existing tab by URL.

```ts
type SavedColor = { id: string; hex: string };
type SavedGradient = {
  id: string;
  type: 'gradient';
  gradientType: 'linear';
  direction: 'right' | 'left' | 'down' | 'up';
  stops: [{ hex: string; position: number }, { hex: string; position: number }];
};
type Palette = {
  id: string;
  name: string;
  colors: (SavedColor | SavedGradient)[];
  cloudSource?: { id: string; ownerId: string; signature: string };
};
```

Local-mode permissions: `storage`, `sidePanel`, and `tabs`. The `tabs` permission lets the worker identify editor URLs, including direct/restored tabs and pending navigation. No content scripts are used. API-enabled builds additionally use `identity` and the API host permission.

## Saved palettes and backend

The extension remains a Vite/React project at the repository root. Its independent
Node.js/MongoDB API lives in [`backend/`](backend/README.md), with its own
`package.json` and lockfile. Next.js and a separate repository are not required.
The server runs separately; it is never copied into the extension's `dist/` or ZIP.

Server-backed palette storage is opt-in at build time. Copy root `.env.example` to
`.env.local`, set `VITE_PALETTE_API_URL` to your actual API origin, and build.
Only the public API URL enters the extension. The generated manifest adds
`identity` and the configured host permission. An unset URL keeps local mode and
does not add these permissions. For development use a loopback API; production
requires HTTPS. Never put OIDC secrets or database credentials in `VITE_*`.

Signing in is independent of saving. It gives access to the account library without
uploading or replacing the working palette; the list loads when its screen is active.
Save first captures a snapshot of
all colors **and gradients**, including the set name; a guest signs in and then
explicitly confirms that snapshot. Changes made during sign-in/request remain
local and do not change the pending snapshot. Failed saves retain their original
key for explicit retries, including after a worker restart within the browser
session. There is no automatic background sync.

The menu contains Working palette, Saved palettes, Print / PDF, Save palette, and
Account; see [SPA navigation and state](#spa-navigation-and-state) for screen routing.
All entry points read the same worker session and follow storage notifications on
account changes and logout. The worker admits
only the explicit page allowlist from its own extension; websites and unknown
extension pages cannot send library commands. Menus outside the library read session
state without fetching the saved palette list; entering the library activates its load.
**Open as working palette** replaces the shared working set after confirmation;
the panel and editor receive the same storage update, and the current interface
switches to Working palette. Full app tabs disable their own side panel.
**Retry loading palettes** appears only after a state/library loading failure and
disappears after a successful retry. Save retries remain in the save confirmation.

Each library card previews up to five items and shows the complete count and
save date. Details show all items, derived color formats and set renaming.
Opening a set requires confirmation before replacing a nonempty local palette;
the worker refuses if the local value changed in the meantime. Editing item
contents uses the existing local editor; save again to create a new snapshot.
Library pagination does not merge unrelated sets.

The extension loads four library cards per page. Save confirmation includes an
editable name; after the first submission, retries keep the same name and payload.
Opening or successfully saving a set stores its saved-set ID, account ID and original
content locally. Save is disabled while the working content matches that source;
editing colors or gradients enables it, reverting the edits disables it again.
This reference survives extension restarts and is not part of the HTTP payload.
Deleting a library card requires confirmation and leaves the working colors intact.
Deleting its source in this extension enables saving the working set again.

Sessions last 24 hours, survive browser restarts and are not silently renewed.
Logout clears account/pending data and revokes the session, preserving local
colors. A network error during logout is reported because server revocation
cannot be confirmed. Credentials are confined to trusted extension storage and
not returned in UI messages; they are not protected against device compromise.

Root `npm test` runs extension tests only. `npm run backend:test` runs the server
suite after `npm ci --prefix backend`. See the backend README for OAuth setup,
MongoDB replica-set setup, integration tests and independent deployment.

## Checks

```sh
npm run format:check
npm run lint
npm test
npm run build
npm run verify:extension
```

`npm test` runs the extension suite sequentially because UI tests share Vite's
dependency cache; this avoids concurrent cache writes and Windows `EPERM` failures.

Architecture refactor verification (2026-10-21): 98 extension tests and 23 backend
tests passed. The import audit checked 84 source modules and 213 internal imports,
with zero cycles and zero boundary violations. Formatting, ESLint, API-enabled and
local-only builds, and build-content checks passed. The local-only manifest has no
identity or API-host permissions. Live Google sign-in, a real MongoDB integration
run, and manual Chrome layout checks were not repeated for this refactor.

Automated tests use simulated Chrome APIs. Real browser verification is still required:

1. Pick colors from a website or image. Check swatches, HEX, duplicates, and Esc cancellation.
2. Copy a HEX code and paste it into a text field.
3. Open the editor. Add in the panel, delete in the editor, and verify both directions synchronize.
4. Repeatedly open the editor in one window: the same tab must be reused. Repeat in a second window: it must have its own editor.
5. Close the browser and reopen: colors and language must persist.
6. Switch between Ukrainian and English in either view: both views, titles, labels, and visible notifications must update.
7. Confirm existing colors remain unchanged when switching languages.
8. Without EyeDropper support, the pick button is disabled with an explanation; saved colors remain usable.
9. In both panel and full tab, switch Working / Saved / Print and use Back/Forward: the document, header, menu, and account state must stay in place.
10. Leave a gradient draft or change print settings, switch screens and return: temporary input must remain. A reload may reset it.
11. From each panel screen, use Open full view: the corresponding screen must open in a reused app tab in the same window.
12. Save explicitly, confirm the name/snapshot, and open the saved set. Opening must switch to Working palette; an unchanged saved set must have Save disabled. Verify cancellation, offline failure, logout, and account change preserve working colors.

Scenes are outside this iteration. Color recommendations remain local. Account/server configuration and acceptance checks are described in the saved-palettes/backend section.

## Side panel lifecycle (Chrome 116+)

The global panel is disabled. Ordinary website tabs receive their own enabled panel via sidePanel.setOptions({ tabId, path, enabled: true }). Full app entries (`editor.html`, `library.html`, `print.html`), including their SPA routes, receive enabled: false and a disabled toolbar action. There is no placeholder panel next to the full app.

Chrome owns the native open/closed state of each tab's panel. Opening an editor does not close or disable the source tab's panel. Returning to the source site restores a previously open panel; a manually closed or never-opened panel is not opened by extension code. There are no calls to sidePanel.open() or sidePanel.close() on tab changes.

The worker reconciles current tabs on every start and handles creation, navigation, activation, replacement, and removal. Existing panel options are not rewritten when unchanged. Editor requests are serialized per source window, and each new editor is created inactive, configured, then activated. An existing editor is found from Chrome's tabs rather than a remembered worker variable.

Views reload the palette on visibility, focus, and pageshow, in addition to storage notifications. Stale read results cannot overwrite newer storage events or newer reads. Visibility changes never write or clear the palette.

Minimum supported version remains Chrome 116. The implementation does not require the newer close/onOpened/onClosed APIs (Chrome 141/142+). Automatic restoration relies on Chrome's documented tab-specific panel behavior, not an extension-controlled reopen. Browser UI state is not promised to survive an extension reload; reopen the panel once after updating. Saved palette data is unaffected.

Manual acceptance after reloading the extension:

1. Open a site panel, open the editor, and verify no panel occupies space next to the editor. Return to the site: its panel should return.
2. Close the site panel manually, switch to the editor and back: it must remain closed. Repeat with a site where the panel was never opened.
3. Click the extension icon in the editor: no panel or new editor should open.
4. Open editor.html directly, reload it, and restore it after restarting Chrome: the panel must be disabled there.
5. Add/delete colors, switch views, then close the editor: the current palette must remain correct.
6. Test in two windows: editor reuse and panel visibility must stay within the originating window. Palette data still intentionally synchronizes between windows.
7. Let the service worker stop (close its DevTools), then repeat navigation and editor opening.

Reference: https://developer.chrome.com/docs/extensions/reference/api/sidePanel#enable-a-side-panel-on-a-specific-site

## Linear gradients

The editor has a Create gradient button above the palette. The builder supports two opaque colors, each selected using EyeDropper, manual #RGB/#RRGGBB input, or a saved solid color. Picking a draft color never creates a separate solid-color item. Esc keeps the previous field value.

Directions: right, left, down, up. Positions are independent integer percentages (0 through 100), measured along the chosen direction. Stop 1 cannot exceed stop 2; equal stops create a hard edge. Sliders clamp at the other stop. Invalid manual input shows inline errors and prevents saving while keeping the last valid preview values. Swap colors preserves positions and direction.

The draft is local React state and is not persisted on slider movement or page reload. Save creates one gradient item, resets the builder, and leaves it open. Edit loads a copy into the builder and updates the same item ID only on Save changes. Cancel discards the draft and closes the builder. Switching to a different gradient with unsaved changes asks for confirmation. Failed saves leave the draft intact; a deleted item cannot be resurrected by saving a stale editing draft.

Gradient cards appear in both views. Copy CSS uses a full background declaration, generated by the same function as the preview and card. Edit in the side panel reuses the editor in the same window and passes the selected item via a fragment navigation. The editor handles this without replacing its current dirty draft unless confirmed.

Storage retains the existing currentPalette.colors array, now accepting solid-color and gradient objects. Legacy { id, hex } entries need no destructive migration. Gradient commands update only the requested item through the worker queue, preserving unrelated concurrent additions/deletions.

Gradient acceptance checks:

1. Open Create gradient; verify black/white, 0/100, left-to-right defaults.
2. Try all three input methods per color. Cancel EyeDropper with Esc; verify the field and palette stay unchanged.
3. Enter #abc, then invalid text. Verify normalization on save, inline errors, disabled saving, and stable preview during invalid input.
4. Set 30/70, then 50/50; check all four directions and Swap colors. Try crossing sliders and invalid numeric values.
5. Save once (including rapid clicks): one card appears, the builder resets and stays open. Compare copied CSS with its swatch.
6. Edit a saved gradient. Before saving, its card must not change; after saving, the same card updates. Cancel must leave it unchanged.
7. Modify a draft, then edit another gradient: reject and accept the discard confirmation in separate attempts.
8. Edit from the side panel with an editor already open; verify reuse, selected item, and dirty-draft confirmation.
9. Delete the edited item from another view, then save: an error must be shown without recreating the item.
10. Reload both views and confirm solid colors and gradients persist and synchronize.

## Formatting

Run `npm.cmd run format` to format all supported project files, `npm.cmd run format:check` for a read-only check, or `npm.cmd run lint:fix` for JavaScript/JSX fixes only.

JavaScript and JSX use ESLint Stylistic. Nonempty parentheses and JSX expression braces have spaces: `{ t( 'gradient.directions.' + item.direction ) }`. Object braces also have spaces. Empty calls remain `fn()`. Single quotes and semicolons remain enabled. These custom rules come after eslint-config-prettier so they stay active.

Prettier formats JSON, CSS, HTML, and Markdown. JavaScript/JSX files are excluded through .prettierignore so Prettier cannot undo the requested spacing. Prettier still uses the project's pinned version and root configuration.

VS Code uses the ESLint extension (dbaeumer.vscode-eslint) as the JavaScript/JSX formatter on save, and Prettier (esbenp.prettier-vscode) for other supported formats. Install both recommended extensions. Existing i18n-ally settings are preserved.

## Service boundaries and errors

Components call extension/clients/paletteClient or extension/clients/editorClient. Requests pass through extension/messaging/sendRequest to the worker's createListener and dispatchMessage. The router invokes explicit paletteService methods: getPalette, addColor, saveGradient, and removeItem.

paletteService owns local item operations, version-checked palette replacement, and local saved-source tracking in one shared queue. SavedPaletteService coordinates snapshots, HTTP requests and session checks; it does not bypass that queue when opening a saved set. The reusable gradient normalization and CSS functions remain in utils/gradient.js. paletteRepository validates persisted data and supplies an empty default. services/storage.js only adapts Chrome's key/value and change-event API; it contains no palette logic, routing, validation, or catches.

Read/write failures reject with the original error through the repository and service. The internal queue recovers independently, while the promise returned to each caller remains rejected. Only the worker response boundary serializes failures for messaging. The client rejects with AppError and retains diagnostic details in cause; transport failures also retain their original cause. The UI remains responsible for translated error messages. Subscription failures are forwarded through onError because browser events cannot reject an earlier subscription call.

The storage key and mixed colors/gradients remain compatible with existing local data. An optional `cloudSource` reference (a persisted legacy field name) records the saved set, account, and original content signature; it is excluded from HTTP snapshots. The editor-open command additionally accepts the requested SPA view. Local item operations retain their existing message values and concurrent-update behavior.

Existing session keys (`cloudSession`, `cloudEpoch`, `cloudPendingSave`), `cloud:*` message values, and error codes remain stable for compatibility. These legacy values do not select a hosting provider. Current modules use account, session, library, and saved-palette names; data is stored by the project's Node.js/MongoDB API.

## Color formats and printing

HEX remains the only stored color source. `utils/colorConversion.js` derives RGB and approximate CMYK on demand; `features/preferences/services/colorFormatPreference.js` persists only the `colorFormat` preference, independently of `currentPalette`. Both palette views subscribe to preference changes.

`src/pages/Print/PrintPage.jsx` is the print screen inside App and receives the same working palette as the other screens. Its settings stay in React state across menu transitions, but reset on reload. `print.html` remains a compatible entry into that screen. `features/printing/utils/printLayout.js` paginates mixed colors and gradients using A4 dimensions and card size. Components under `src/features/printing/components/` render controls, sheets and cards; styles live beside the screen and print components.

Use Print / Save as PDF to open the browser dialog. For matching pagination: A4, selected orientation, 100% scale, no additional margins, background graphics enabled, browser headers/footers disabled. The sheets include their own 15 mm padding. Browser/printer overrides may change pagination or colors. Long optional names are shortened on the sheet and available in screen tooltips. No PDF library, server, ICC conversion, or derived color storage is used. For a future direct PDF exporter, reuse the conversion/layout utilities and add a separate document renderer rather than extending palette storage.

## Architecture boundaries

Palette, SavedColor, and SavedGradient are data records (see `types/palette.js`), not service instances. Their persisted shape stays plain and serializable. Conversion, validation, draft updates, and print pagination are pure functions. React components render data; hooks own UI state and subscriptions.

Use a class when several operations share an injected dependency or a lifecycle. Method count alone does not justify a class, and hypothetical future methods are not a reason to introduce one.

| Class                 | Public methods                                                                                        | Responsibility                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| StorageAdapter        | get, set, subscribe (3)                                                                               | Chrome key/value transport; no palette rules.                                          |
| PaletteRepository     | read, write (2)                                                                                       | Palette storage key, validation, and empty default.                                    |
| PaletteService        | getPalette, addColor, saveGradient, removeItem, replacePalette, markSavedSource, clearSavedSource (7) | Local item operations, confirmed replacement, and saved-content tracking in one queue. |
| ColorFormatPreference | read, save, subscribe (3)                                                                             | One persisted display preference; no palette mutation or message transport.            |
| ThemePreference       | read, save, subscribe (3)                                                                             | One persisted appearance preference; no palette mutation or DOM access.                |
| LanguagePreference    | start, set, stop (3)                                                                                  | Language preference and its storage listener lifecycle.                                |
| PaletteSubscription   | refresh, dispose (2)                                                                                  | Subscription lifetime and protection against stale reads.                              |
| PanelController       | initialize, sync, forget (3)                                                                          | Per-tab panel settings and cancellation; native Chrome visibility stays authoritative. |

Classes keep dependencies and internal state in private fields. New methods belong here only if they operate within the same responsibility: for example, renaming a palette belongs to PaletteService, while PDF rendering does not. No extra methods are added in anticipation of future work.

Opening the editor is a single operation. createOpenEditor binds its Chrome/panel dependencies and a per-window queue once at worker startup, returning a callable function. It returns no object with a method API. dispatchMessage is a stateless function translating transport commands into application operations. createListener provides the synchronous callback required by Chrome and serializes errors at that boundary.

background.js composes these dependencies. UI api modules send messages; preferences persist settings; services enforce palette rules; the repository and adapter handle persistence. Shared URL matching lives in utils/tabUrl.js so opening the editor does not import the panel controller implementation. Existing camelCase module filenames are preserved; operation modules use verbs and exported class names use PascalCase.

## Color advisor

The lightbulb on each solid-color card opens an inline advisor; only one source is expanded per view. Suggestions stay local until Add is pressed. Copy uses the currently selected HEX/RGB/CMYK format. Saved colors are marked Already added, and the existing palette service remains responsible for deduplication and persistence. Gradients keep their existing editing flow.

`features/color-advisor/utils/colorSuggestions.js` is pure: shades mix RGB channels with black or white at 20%, 40%, and 60%; neighboring hues rotate HSL hue by 30 degrees; complementary and triadic variants rotate by 180 and 120/240 degrees. Hue values are not persisted. A source with an RGB channel spread of 16 or less is treated as nearly neutral and offers shades only. Results are deterministic, not a guarantee of aesthetic suitability or text contrast.

Components in `src/features/color-advisor/components/` have separate roles: ColorAdvisor coordinates categories and selection; ColorSuggestions renders choices; ColorComparison renders the pair and reversible background/accent composition. useColorAdvisorActions handles explicit save/copy actions and local feedback. Styles live beside those components, and category identifiers in constants/advisorTypes.js.
