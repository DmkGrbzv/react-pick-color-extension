// Pending navigation takes precedence; fragments and queries identify the same page.
export function matchesTabUrl( tab, pageUrl ) {
  return ( tab.pendingUrl || tab.url )?.split( /[?#]/ )[0] === pageUrl;
}
