const configuredApi = import.meta.env?.VITE_PALETTE_API_URL || '';
export const apiUrl = configuredApi ? new URL( configuredApi ).origin : '';
