import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { normalizeContext, renderReport, reportDigest, validateReport } from './report.js';

const MARKER = 'CI_REPORT_STATE: ';

export function compareReports( first, second ) {
  if ( first.repository !== second.repository || first.workflow !== second.workflow ) throw new Error( 'document-identity-conflict' );
  for ( const key of ['runNumber', 'attempt'] ) {
    if ( BigInt( first[key] ) !== BigInt( second[key] ) ) return BigInt( first[key] ) > BigInt( second[key] ) ? 1 : -1;
  }
  if ( first.runId !== second.runId ) throw new Error( 'run-identity-conflict' );
  return 0;
}

function documentState( document ) {
  if ( !document.revisionId ) throw new Error( 'document-revision-missing' );
  if ( document.tabs && ( document.tabs.length !== 1 || document.tabs[0].childTabs?.length ) ) throw new Error( 'single-tab-document-required' );
  const tab = document.tabs?.[0];
  const content = ( tab?.documentTab || document ).body?.content;
  if ( !Array.isArray( content ) || !content.length ) throw new Error( 'document-body-missing' );
  const text = content.flatMap( ( item ) => item.paragraph?.elements || [] ).map( ( item ) => item.textRun?.content || '' ).join( '' );
  let marker = null;
  if ( text.includes( MARKER ) ) {
    const stateLine = text.trimEnd().split( '\n' ).at( -1 );
    if ( !stateLine.startsWith( MARKER ) || stateLine.length > 1024 ) throw new Error( 'document-state-invalid' );
    const supplied = JSON.parse( stateLine.slice( MARKER.length ) );
    marker = { ...normalizeContext( supplied ), digest: supplied.digest };
    if ( !/^[a-f0-9]{64}$/.test( marker.digest ) ) throw new Error( 'document-state-invalid' );
  }
  const endIndex = content.at( -1 ).endIndex - 1;
  if ( !Number.isInteger( endIndex ) || endIndex < 1 ) throw new Error( 'document-range-invalid' );
  return { revisionId: document.revisionId, tabId: tab?.tabProperties?.tabId, text, endIndex, marker };
}

export async function publishReport( reportValue, credentials, request = fetch ) {
  const report = validateReport( reportValue );
  const text = renderReport( report );
  const digest = reportDigest( report );
  const incoming = { ...report.context, digest };
  const replacement = text + '\n' + MARKER + JSON.stringify( incoming ) + '\n';
  const { documentId, accessToken } = credentials;
  if ( !/^[\w-]{20,200}$/.test( documentId || '' ) || !accessToken ) throw new Error( 'google-configuration-missing' );
  const url = 'https://docs.googleapis.com/v1/documents/' + documentId;
  async function api( suffix, body ) {
    let response;
    try {
      response = await request( url + suffix, { method: body ? 'POST' : 'GET', redirect: 'error',
        headers: { Authorization: 'Bearer ' + accessToken, ...( body ? { 'Content-Type': 'application/json' } : {} ) },
        body: body ? JSON.stringify( body ) : undefined, signal: AbortSignal.timeout( 20_000 ) } );
    } catch { throw new Error( 'google-network-error' ); }
    if ( !response.ok ) throw new Error( 'google-http-' + response.status );
    const value = await response.text();
    if ( value.length > 2_000_000 ) throw new Error( 'google-response-too-large' );
    try { return JSON.parse( value ); } catch { throw new Error( 'google-response-invalid' ); }
  }
  for ( let attempt = 0; attempt < 3; attempt++ ) {
    const document = await api( '?includeTabsContent=true' );
    if ( document.documentId !== documentId ) throw new Error( 'document-id-mismatch' );
    const current = documentState( document );
    const order = current.marker ? compareReports( current.marker, incoming ) : -1;
    if ( order > 0 ) return { status: 'superseded' };
    if ( order === 0 ) {
      if ( current.marker.digest !== digest || current.text.trimEnd() !== replacement.trimEnd() ) throw new Error( 'same-attempt-content-conflict' );
      return { status: 'already-published' };
    }
    const requests = [];
    if ( current.endIndex > 1 ) requests.push( { deleteContentRange: { range: {
      startIndex: 1, endIndex: current.endIndex, ...( current.tabId ? { tabId: current.tabId } : {} ),
    } } } );
    requests.push( { insertText: { location: { index: 1, ...( current.tabId ? { tabId: current.tabId } : {} ) }, text: replacement } } );
    try {
      await api( ':batchUpdate', { writeControl: { requiredRevisionId: current.revisionId }, requests } );
    } catch ( error ) {
      if ( !/^google-(?:network-error|http-(?:400|409|412|429|5\d\d))$/.test( error.message ) || attempt === 2 ) throw error;
      continue;
    }
    const verified = documentState( await api( '?includeTabsContent=true' ) );
    if ( verified.marker && compareReports( verified.marker, incoming ) > 0 ) return { status: 'superseded' };
    if ( verified.text.trimEnd() !== replacement.trimEnd() ) throw new Error( 'google-write-verification-failed' );
    return { status: 'published-and-verified' };
  }
  throw new Error( 'google-write-retry-limit' );
}

async function main() {
  await mkdir( '.ci-reports/delivery', { recursive: true } );
  let result;
  try {
    const content = await readFile( '.ci-reports/report/report.json', 'utf8' );
    if ( content.length > 64 * 1024 ) throw new Error( 'report-too-large' );
    const report = JSON.parse( content );
    result = process.argv.includes( '--dry-run' ) ? { status: 'dry-run', characters: renderReport( report ).length } :
      await publishReport( report, { documentId: process.env.GOOGLE_DOC_ID, accessToken: process.env.GOOGLE_ACCESS_TOKEN } );
  } catch ( error ) {
    // No exception body, Google response, credential or document text is logged.
    const code = /^(?:google-|document-|single-tab-|same-attempt-|run-identity-)[a-z0-9-]+$/.test( error.message ) ? error.message : 'report-delivery-failed';
    result = { status: 'failure', code };
    process.exitCode = 1;
  }
  await writeFile( '.ci-reports/delivery/status.json', JSON.stringify( result, null, 2 ) + '\n' );
  console.log( JSON.stringify( result ) );
}

if ( process.argv[1] && pathToFileURL( path.resolve( process.argv[1] ) ).href === import.meta.url ) {
  main().catch( () => { console.error( 'Report delivery failed; diagnostics could not be saved.' ); process.exitCode = 1; } );
}
