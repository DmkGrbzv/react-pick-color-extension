import { cloudEnabled } from '@/constants/features.js';

const configuredApi = import.meta.env?.VITE_PALETTE_API_URL || '';
export const apiUrl = cloudEnabled && configuredApi ? new URL( configuredApi ).origin : '';
