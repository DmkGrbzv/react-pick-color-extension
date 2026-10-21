import { APP_VIEWS } from '@/routes/appRoutes.js';

export function readAppOptions( { surface, initialView } = {} ) {
  return {
    panel: surface === 'panel',
    initialPage: APP_VIEWS.includes( initialView ) ? initialView : 'working',
  };
}
