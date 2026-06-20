export class Input {
  constructor(canvas, scale) {
    this._canvas = canvas;
    this._scale  = scale;
    this._keys   = {};
    this._held   = { up: false, down: false, left: false, right: false, a: false, b: false, menu: false };
    this._just   = { up: false, down: false, left: false, right: false, a: false, b: false, menu: false };

    document.addEventListener('keydown', e => this._onKey(e, true));
    document.addEventListener('keyup',   e => this._onKey(e, false));
    // タッチ操作は各シーンが直接ハンドルする
    canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  }

  update(scale) {
    this._scale = scale;
    this._just  = { up: false, down: false, left: false, right: false, a: false, b: false, menu: false };
    const prev = { ...this._held };
    this._syncHeld();
    for (const k of Object.keys(this._just)) {
      if (this._held[k] && !prev[k]) this._just[k] = true;
    }
  }

  _syncHeld() {
    const k = this._keys;
    this._held.up    = !!(k['ArrowUp']    || k['w'] || k['W']);
    this._held.down  = !!(k['ArrowDown']  || k['s'] || k['S']);
    this._held.left  = !!(k['ArrowLeft']  || k['a'] || k['A']);
    this._held.right = !!(k['ArrowRight'] || k['d'] || k['D']);
    this._held.a     = !!(k['Enter'] || k[' '] || k['z'] || k['Z']);
    this._held.b     = !!(k['Escape'] || k['x'] || k['X']);
    this._held.menu  = !!(k['Escape'] || k['m'] || k['M']);
  }

  _onKey(e, down) {
    this._keys[e.key] = down;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
  }

  isDown(key) { return !!this._held[key]; }
  isJust(key) { return !!this._just[key]; }
}
