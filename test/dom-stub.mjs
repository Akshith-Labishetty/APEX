// Minimal browser stubs so canvas-texture code runs in Node.
const gradient = { addColorStop() {} };
const ctx = new Proxy({}, {
  get(_t, key) {
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
    if (key === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
    if (typeof key !== 'string') return undefined;
    return () => undefined;
  },
  set() { return true; },
});

globalThis.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => ctx, style: {} }),
};
globalThis.window = globalThis.window || { addEventListener() {}, devicePixelRatio: 1 };
