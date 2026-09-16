# Color Palette

A Manifest V3 Chrome extension built with React 19 and Vite 8. One current palette, a side panel, and a separate editor tab. No server required.

## Run

1. Use Node.js 22.12+ and Chrome 116+.
2. Install dependencies: `npm ci`.
3. Build: `npm run build`.
4. Open `chrome://extensions`, enable Developer mode, and select **Load unpacked**.
5. Choose this project's `dist` folder. Pin the extension and click its icon to open the side panel.

After code changes, rebuild, reload the extension on `chrome://extensions`, and reopen the panel / reload the editor.

On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`.

`npm run dev` serves `/sidepanel.html` and `/editor.html` for layout preview. Chrome storage and extension APIs only work inside the installed extension.

## Features

- Pick a color anywhere on the screen with EyeDropper. Esc cancels without an error.
- Colors are saved immediately. Duplicate HEX values are ignored and HEX is normalized to uppercase.
- Each swatch includes its HEX code, copy, and remove buttons.
- Open the editor in a separate tab, or activate the existing editor in the same window. Each window may have its own editor.
- Palette changes synchronize between the panel and editor.
- `chrome.storage.local` stores the palette under `currentPalette`. It survives browser restarts; uninstalling the extension removes its data.

## Global i18n

Only Ukrainian (`uk`) and English (`en`) are supported, using `i18next` and `react-i18next`. Both entry points share the setup in `src/i18n/index.js`.

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

- `sidepanel.html` → `src/sidepanel.jsx`: panel entry point.
- `editor.html` → `src/editor.jsx`: editor entry point.
- `src/components/`: shared palette, swatches, and language selector.
- `src/types.js`: shared JSDoc data types.
- `src/storage.js`: palette reads, writes, and subscriptions.
- `src/usePalette.js`: React subscription with stale initial-read protection.
- `src/background.js`: service worker, panel behavior, command handling.
- `src/editorTab.js`: editor tab reuse.
- `src/i18n/`: translation resources and language preferences.
- `src/errors.js`: language-independent error codes.

Palette mutations run through a single worker queue to prevent lost concurrent updates. Views update after storage writes. Editor opening also handles concurrent requests; a restarted worker finds the existing tab by URL.

```ts
type SavedColor = { id: string; hex: string };
type SavedGradient = {
  id: string;
  type: 'gradient';
  gradientType: 'linear';
  direction: 'right' | 'left' | 'down' | 'up';
  stops: [{ hex: string; position: number }, { hex: string; position: number }];
};
type Palette = { id: string; name: string; colors: (SavedColor | SavedGradient)[] };
```

Permissions: `storage`, `sidePanel`, and `tabs`. The `tabs` permission lets the worker identify editor URLs, including direct/restored tabs and pending navigation. No content scripts or host permissions are used.

## Checks

```sh
npm run lint
npm test
npm run build
```

Automated tests use simulated Chrome APIs. Real browser verification is still required:

1. Pick colors from a website or image. Check swatches, HEX, duplicates, and Esc cancellation.
2. Copy a HEX code and paste it into a text field.
3. Open the editor. Add in the panel, delete in the editor, and verify both directions synchronize.
4. Repeatedly open the editor in one window: the same tab must be reused. Repeat in a second window: it must have its own editor.
5. Close the browser and reopen: colors and language must persist.
6. Switch between Ukrainian and English in either view: both views, titles, labels, and visible notifications must update.
7. Confirm existing colors remain unchanged when switching languages.
8. Without EyeDropper support, the pick button is disabled with an explanation; saved colors remain usable.

Scenes, recommendations, accounts, and a server are outside this iteration.

## Side panel lifecycle (Chrome 116+)

The global panel is disabled. Each non-editor tab receives its own enabled panel via sidePanel.setOptions({ tabId, path, enabled: true }). Editor tabs receive enabled: false and a disabled toolbar action. There is no placeholder panel next to the editor.

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
