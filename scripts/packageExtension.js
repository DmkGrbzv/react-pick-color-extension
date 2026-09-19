import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const root = fileURLToPath( new URL( '../', import.meta.url ) );
const dist = path.join( root, 'dist' );
const release = path.join( root, 'release' );
const manifest = JSON.parse( await readFile( path.join( dist, 'manifest.json' ), 'utf8' ) );
if ( !/^\d+(\.\d+){0,3}$/.test( manifest.version ) ) throw new Error( 'Invalid extension version' );
if ( process.platform !== 'win32' ) throw new Error( 'ZIP packaging currently requires Windows PowerShell.' );

const archive = path.join( release, 'color-palette-' + manifest.version + '.zip' );
await mkdir( release, { recursive: true } );
// Only overwrite this generated ZIP, never the project or dist directory.
await rm( archive, { force: true } );
execFileSync( 'powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', [
  "$ErrorActionPreference = 'Stop'",
  'Add-Type -AssemblyName System.IO.Compression.FileSystem',
  // Use ZIP-standard forward slashes even with Windows PowerShell / .NET Framework.
  "$zip = [IO.Compression.ZipFile]::Open($env:PALETTE_ZIP_PATH, 'Create')",
  'try { foreach ($file in Get-ChildItem -LiteralPath $env:PALETTE_DIST_DIR -Recurse -File) {',
  '$name = $file.FullName.Substring($env:PALETTE_DIST_DIR.Length + 1).Replace([char]92, [char]47)',
  '[IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $name, [IO.Compression.CompressionLevel]::Optimal) | Out-Null',
  '} } finally { $zip.Dispose() }',
].join( '; ' )], {
  env: { ...process.env, PALETTE_DIST_DIR: dist, PALETTE_ZIP_PATH: archive },
  stdio: 'inherit',
} );

const files = await readdir( dist, { recursive: true, withFileTypes: true } );
const sizes = await Promise.all( files.filter( ( file ) => file.isFile() ).map(
  ( file ) => stat( path.join( file.parentPath, file.name ) )
) );
const total = sizes.reduce( ( sum, file ) => sum + file.size, 0 );
const compressed = ( await stat( archive ) ).size;
console.log( 'Extension: ' + ( total / 1000 ).toFixed( 1 ) + ' kB (' + sizes.length + ' files)' );
console.log( 'ZIP: ' + ( compressed / 1000 ).toFixed( 1 ) + ' kB' );
console.log( archive );
