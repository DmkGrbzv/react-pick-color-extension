import { requireExtension } from '@/runtime/sendRequest.js';
export async function openPrintPreview() {
  requireExtension();
  await chrome.tabs.create( { url: chrome.runtime.getURL( 'print.html' ) } );
}
