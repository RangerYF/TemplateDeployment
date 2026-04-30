function fallbackRandomUUID(): string {
  const cryptoObj = globalThis.crypto;

  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);

    // RFC 4122 version 4
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
    return [
      hex.slice(0, 4).join(''),
      hex.slice(4, 6).join(''),
      hex.slice(6, 8).join(''),
      hex.slice(8, 10).join(''),
      hex.slice(10, 16).join(''),
    ].join('-');
  }

  let seed = Date.now();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = (seed + Math.random() * 16) % 16 | 0;
    seed = Math.floor(seed / 16);
    if (char === 'x') return rand.toString(16);
    return ((rand & 0x3) | 0x8).toString(16);
  });
}

export function ensureRandomUUID(): void {
  const cryptoObj = globalThis.crypto as Crypto & {
    randomUUID?: () => string;
  };

  if (typeof cryptoObj?.randomUUID === 'function') {
    return;
  }

  if (!cryptoObj) {
    return;
  }

  Object.defineProperty(cryptoObj, 'randomUUID', {
    configurable: true,
    writable: true,
    value: fallbackRandomUUID,
  });
}
