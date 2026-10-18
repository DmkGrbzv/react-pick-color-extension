import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import CloudPalettePreview from '@/components/CloudPalettePreview.jsx';

export default function CloudSaveConfirmation( { pending, user, busy, onSave, onCancel } ) {
  const { t } = useTranslation();
  const [name, setName] = useState( pending.snapshot.name );
  function submit( event ) {
    event.preventDefault();
    if ( user && !busy ) void onSave( name );
  }
  return (
    <form className="cloud-confirm" aria-label={ t( 'cloud.confirmTitle' ) } onSubmit={ submit }>
      <h3>{ t( 'cloud.confirmTitle' ) }</h3>
      <label>
        { t( 'cloud.name' ) }
        <input value={ name } maxLength={ 120 } disabled={ busy || pending.submitted }
          onChange={ ( event ) => setName( event.target.value ) } />
      </label>
      <CloudPalettePreview items={ pending.snapshot.items } />
      <p>{ t( 'cloud.count', { count: pending.snapshot.items.length } ) }</p>
      <p className="hint">{ t( user ? 'cloud.confirmHint' : 'cloud.loginBeforeSave' ) }</p>
      { pending.submitted && <p className="hint">{ t( 'cloud.nameLocked' ) }</p> }
      <div className="cloud-actions">
        { user && <button type="submit" disabled={ busy }>{ t( 'cloud.confirm' ) }</button> }
        <button type="button" disabled={ busy } onClick={ onCancel }>{ t( 'cloud.cancel' ) }</button>
      </div>
    </form>
  );
}
