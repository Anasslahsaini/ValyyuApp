declare module 'tiny-inflate' {
  /** Inflates raw DEFLATE data into `out` and returns it (MIT, github.com/foliojs/tiny-inflate). */
  export default function inflate(source: Uint8Array, out: Uint8Array): Uint8Array;
}
