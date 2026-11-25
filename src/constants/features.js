// Build-time public configuration. Only the explicit string true enables cloud.
export function isCloudEnabled( value ) {
  return value === 'true';
}
export const cloudEnabled = isCloudEnabled( import.meta.env?.VITE_ENABLE_CLOUD );
