import inflate from 'tiny-inflate';

/**
 * Minimal PNG decoder for the tiny (e.g. 8x8) thumbnails used to guess a garment colour on
 * device. 8-bit, non-interlaced, greyscale / RGB / palette / alpha variants. Returns RGBA.
 */
export function decodePng(bytes: Uint8Array): { width: number; height: number; rgba: Uint8Array } {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 33 || sig.some((v, i) => bytes[i] !== v)) throw new Error('Not a PNG.');
  const u32 = (o: number) =>
    ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;
  let o = 8,
    width = 0,
    height = 0,
    depth = 0,
    type = 0,
    interlace = 0;
  let palette: Uint8Array | null = null,
    trns: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  while (o + 8 <= bytes.length) {
    const len = u32(o),
      kind = String.fromCharCode(bytes[o + 4], bytes[o + 5], bytes[o + 6], bytes[o + 7]);
    const data = bytes.subarray(o + 8, o + 8 + len);
    if (kind === 'IHDR') {
      width = u32(o + 8);
      height = u32(o + 12);
      depth = data[8];
      type = data[9];
      interlace = data[12];
    } else if (kind === 'PLTE') palette = data;
    else if (kind === 'tRNS') trns = data;
    else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    o += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || !width || !height || width * height > 4096)
    throw new Error('Unsupported PNG.');
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[type];
  if (!channels || (type === 3 && !palette)) throw new Error('Unsupported PNG.');
  const zlib = new Uint8Array(idat.reduce((n, c) => n + c.length, 0));
  idat.reduce((at, c) => {
    zlib.set(c, at);
    return at + c.length;
  }, 0);
  const stride = width * channels;
  const raw = inflate(zlib.subarray(2), new Uint8Array((stride + 1) * height)); // skip the 2-byte zlib header
  const px = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= channels ? px[y * stride + x - channels] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? px[(y - 1) * stride + x - channels] : 0;
      let p = 0;
      if (filter === 1) p = a;
      else if (filter === 2) p = b;
      else if (filter === 3) p = (a + b) >> 1;
      else if (filter === 4) {
        const q = a + b - c,
          pa = Math.abs(q - a),
          pb = Math.abs(q - b),
          pc = Math.abs(q - c);
        p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = (v + p) & 255;
    }
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const s = i * channels,
      d = i * 4;
    if (type === 0) {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = px[s];
      rgba[d + 3] = 255;
    } else if (type === 4) {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = px[s];
      rgba[d + 3] = px[s + 1];
    } else if (type === 2) {
      rgba[d] = px[s];
      rgba[d + 1] = px[s + 1];
      rgba[d + 2] = px[s + 2];
      rgba[d + 3] = 255;
    } else if (type === 6) {
      rgba.set(px.subarray(s, s + 4), d);
    } else {
      const k = px[s] * 3;
      rgba[d] = palette![k];
      rgba[d + 1] = palette![k + 1];
      rgba[d + 2] = palette![k + 2];
      rgba[d + 3] = trns && px[s] < trns.length ? trns[px[s]] : 255;
    }
  }
  return { width, height, rgba };
}

/** Base64 -> bytes without relying on atob/Buffer (works in Hermes, web and Node). */
export function base64ToBytes(b64: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = b64.replace(/^data:[^,]*,/, '').replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0,
    acc = 0,
    n = 0;
  for (const ch of clean) {
    acc = ((acc << 6) | alphabet.indexOf(ch)) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[n++] = (acc >> bits) & 255;
    }
  }
  return out.subarray(0, n);
}
