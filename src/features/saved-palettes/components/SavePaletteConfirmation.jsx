import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SavedPalettePreview from '@/features/saved-palettes/components/SavedPalettePreview.jsx';

export default function SavePaletteConfirmation( { pending, user, busy, onSave, onCancel } ) {
  const { t } = useTranslation();
  const [name, setName] = useState( pending.snapshot.name );
  function submit( event ) {
    event.preventDefault();
    if ( user && !busy ) void onSave( name );
  }
  return (
    <form className="saved-confirm" aria-label={ t( 'library.confirmTitle' ) } onSubmit={ submit }>
      <h3>{ t( 'library.confirmTitle' ) }</h3>
      <label>
        { t( 'library.name' ) }
        <input value={ name } maxLength={ 120 } disabled={ busy || pending.submitted }
          onChange={ ( event ) => setName( event.target.value ) } />
      </label>
      <SavedPalettePreview items={ pending.snapshot.items } />
      <p>{ t( 'library.count', { count: pending.snapshot.items.length } ) }</p>
      <p className="hint">{ t( user ? 'library.confirmHint' : 'library.loginBeforeSave' ) }</p>
      { pending.submitted && <p className="hint">{ t( 'library.nameLocked' ) }</p> }
      <div className="saved-actions">
        { user && <button type="submit" disabled={ busy }>{ t( 'library.confirm' ) }</button> }
        <button type="button" disabled={ busy } onClick={ onCancel }>{ t( 'library.cancel' ) }</button>
      </div>
    </form>
  );
}
