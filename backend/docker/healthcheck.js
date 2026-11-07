// No dependencies, credentials or response bodies are printed by container probes.
try {
  const response = await fetch( `http://127.0.0.1:${process.env.PORT || 3001}/ready`, {
    signal: AbortSignal.timeout( 2000 ),
  } );
  process.exitCode = response.ok ? 0 : 1;
} catch { process.exitCode = 1; }
