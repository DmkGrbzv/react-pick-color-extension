const configuredApi = import.meta.env?.VITE_PALETTE_API_URL || '';
export const cloudApiUrl = configuredApi ? new URL( configuredApi ).origin : '';
