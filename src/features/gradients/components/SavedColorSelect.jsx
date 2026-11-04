import { useEffect, useId, useRef, useState } from 'react';
import { normalizeHex } from '@/utils/gradient.js';
import './SavedColorSelect.css';

export default function SavedColorSelect( { colors, value, label, onChange } ) {
  const id = useId();
  const root = useRef( null );
  const search = useRef( { text: '', time: 0 } );
  const [open, setOpen] = useState( false );
  const [active, setActive] = useState( 0 );
  const hex = normalizeHex( value );
  const selected = colors.findIndex( ( color ) => normalizeHex( color.hex ) === hex );
  const expanded = open && colors.length > 0;
  const activeIndex = Math.min( active, colors.length - 1 );

  useEffect( () => {
    if ( !expanded ) return;
    function dismiss( event ) {
      if ( !root.current?.contains( event.target ) ) setOpen( false );
    }
    document.addEventListener( 'pointerdown', dismiss );
    return () => document.removeEventListener( 'pointerdown', dismiss );
  }, [expanded] );

  useEffect( () => {
    if ( expanded ) root.current?.querySelector( '[data-active="true"]' )?.scrollIntoView( { block: 'nearest' } );
  }, [expanded, activeIndex] );

  function show( index = selected < 0 ? 0 : selected ) {
    setActive( index );
    setOpen( true );
    search.current = { text: '', time: 0 };
  }

  function choose( index ) {
    if ( !colors[index] ) return;
    onChange( colors[index].hex );
    setOpen( false );
    root.current?.querySelector( '[role="combobox"]' )?.focus();
  }

  function onKeyDown( event ) {
    const { key } = event;
    if ( key === 'Tab' || key === 'Escape' ) {
      if ( key === 'Escape' && expanded ) event.preventDefault();
      setOpen( false );
      return;
    }
    if ( key === 'Enter' || key === ' ' ) {
      event.preventDefault();
      if ( expanded ) choose( activeIndex );
      else show();
      return;
    }
    if ( ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes( key ) ) {
      event.preventDefault();
      if ( !expanded ) { show( key === 'End' ? colors.length - 1 : undefined ); return; }
      if ( key === 'Home' ) setActive( 0 );
      else if ( key === 'End' ) setActive( colors.length - 1 );
      else setActive( Math.max( 0, Math.min( colors.length - 1, activeIndex + ( key === 'ArrowDown' ? 1 : -1 ) ) ) );
      return;
    }
    if ( key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey ) return;
    const now = Date.now();
    const text = ( now - search.current.time < 700 ? search.current.text : '' ) + key.toUpperCase();
    search.current = { text, time: now };
    const match = colors.findIndex( ( color ) => color.hex.toUpperCase().replace( /^#/, '' ).startsWith( text.replace( /^#/, '' ) ) );
    if ( match >= 0 ) { setActive( match ); setOpen( true ); }
  }

  return <div className="saved-color-select" ref={ root }
    onBlur={ ( event ) => { if ( !event.currentTarget.contains( event.relatedTarget ) ) setOpen( false ); } }>
    <button type="button" className="saved-color-trigger" role="combobox"
      aria-label={ label } aria-expanded={ expanded } aria-haspopup="listbox"
      aria-controls={ id } aria-activedescendant={ expanded ? id + '-' + activeIndex : undefined }
      disabled={ colors.length === 0 } onKeyDown={ onKeyDown }
      onClick={ () => { if ( expanded ) setOpen( false ); else show(); } }>
      { hex && <span className="saved-color-chip" style={ { backgroundColor: hex } } aria-hidden="true" /> }
      <span className="saved-color-value">{ hex || label }</span>
      <span className="saved-color-arrow" aria-hidden="true" />
    </button>
    { expanded && <div className="saved-color-options" id={ id } role="listbox" aria-label={ label }>
      { colors.map( ( color, index ) => <div key={ color.id } id={ id + '-' + index }
        role="option" aria-selected={ index === selected } data-active={ index === activeIndex }
        className="saved-color-option" onPointerMove={ () => setActive( index ) }
        onPointerDown={ ( event ) => event.preventDefault() } onClick={ () => choose( index ) }>
        <span className="saved-color-chip" style={ { backgroundColor: color.hex } } aria-hidden="true" />
        <span>{ color.hex.toUpperCase() }</span>
        { index === selected && <span className="saved-color-selected" aria-hidden="true">&#10003;</span> }
      </div> ) }
    </div> }
  </div>;
}
