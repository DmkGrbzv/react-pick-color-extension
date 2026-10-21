import { useState } from 'react';
import { openEditor } from '@/extension/clients/editorClient.js';

export function useNavigationActions( page, navigate, model ) {
  const [opening, setOpening] = useState( false );
  const [failure, setFailure] = useState( null );

  async function expand() {
    if ( opening ) return;
    setOpening( true );
    setFailure( null );
    try {
      await openEditor( undefined, page );
    } catch ( error ) {
      setFailure( error );
    } finally {
      setOpening( false );
    }
  }

  async function save() {
    const prepared = await model.prepare();
    if ( prepared?.pending ) navigate( 'library' );
  }

  return { opening, failure, expand, save };
}
