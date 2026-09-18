import { EXTENSION_PAGES } from '@/constants/extensionPages.js';
import { requireExtension } from '@/runtime/sendRequest.js';
export async function openPrintPreview() {
  requireExtension();
  await chrome.tabs.create( { url: chrome.runtime.getURL( EXTENSION_PAGES.PRINT ) } );
}
