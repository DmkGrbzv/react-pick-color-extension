// A late read must never replace a newer storage event or read.
export class PaletteSubscription {
  #read;
  #onValue;
  #onError;
  #unsubscribe;
  #active = true;
  #revision = 0;
  #requestId = 0;
  constructor( { read, subscribe, onValue, onError } ) {
    this.#read = read;
    this.#onValue = onValue;
    this.#onError = onError;
    this.#unsubscribe = subscribe(
      ( value ) => {
        this.#revision++;
        if ( this.#active ) this.#onValue( value );
      },
      ( error ) => {
        this.#revision++;
        if ( this.#active ) this.#onError( error );
      }
    );
  }
  async refresh() {
    const request = ++this.#requestId;
    const before = this.#revision;
    try {
      const value = await this.#read();
      if ( this.#active && request === this.#requestId && this.#revision === before )
        this.#onValue( value );
    } catch ( error ) {
      if ( this.#active && request === this.#requestId && this.#revision === before )
        this.#onError( error );
    }
  }
  dispose() {
    this.#active = false;
    this.#unsubscribe();
  }
}
