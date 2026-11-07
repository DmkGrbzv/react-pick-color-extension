export const IMAGE_REPOSITORY = 'ghcr.io/dmkgrbzv/react-pick-color-extension-backend';

export function validImage( image ) {
  return typeof image === 'string' && ( image.startsWith( IMAGE_REPOSITORY + ':' ) &&
    /^[a-f0-9]{40}$/.test( image.slice( IMAGE_REPOSITORY.length + 1 ) ) ||
    image.startsWith( IMAGE_REPOSITORY + '@sha256:' ) && /^[a-f0-9]{64}$/.test( image.slice( IMAGE_REPOSITORY.length + 8 ) ) );
}
