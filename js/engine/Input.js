import { DPAD, BTNS, LAYOUT } from '../constants.js';

export class Input {
  constructor(canvas, scale) {
    this._canvas = canvas;
    this._scale = scale;
    this._keys = {};
    this._prev = {};
    this._touch = {};
    this._touchPrev = {};

    this._held = { up: false, down: false, left: false, right: false, a: false, b: false, menu: false };
    this._just = { up: false, down: false, left: false, right: false, a: false, b: false, menu: false };

    this._activeTouches = new Map();

    document.addEventListener('keydown', e => this._onKey(e, true));
    document.addEventListener('keyup',   e => this._onKey(e, false));
    canvas.addEventListener('touchstart', e => this._onTouch(e), { passive: false });
    canvas.addEventListener('touchend',   e => this._onTouchEnd(e), { passive: false });
    canvas.addEventListener('touchcancel',e => this._onTouchEnd(e), { passive: false });
    canvas.addEventListener('touchmove',  e => e.preventDefault(), { passive: false });
    canvas.addEventListener('mousedown',  e => this._onMouse(e, true));
    canvas.addEventListener('mouseup',    e => this._onMouse(e, false));
  }

  update(scale) {
    this._scale = scale;
    this._just = { up: false, down: false, left: false, right: false, a: false, b: false, menu: false };

    const prev = { ...this._held };
    this._syncHeld();

    for (const k of Object.keys(this._just)) {
      if (this._held[k] && !prev[k]) this._just[k] = true;
    }
  }

  _syncHeld() {
    const k = this._keys;
    const t = this._touchBtns || {};
    this._held.up    = !!(k['ArrowUp']    || k['w'] || k['W'] || t.up);
    this._held.down  = !!(k['ArrowDown']  || k['s'] || k['S'] || t.down);
    this._held.left  = !!(k['ArrowLeft']  || k['a'] || k['A'] || t.left);
    this._held.right = !!(k['ArrowRight'] || k['d'] || k['D'] || t.right);
    this._held.a     = !!(k['Enter'] || k[' '] || k['z'] || k['Z'] || t.a);
    this._held.b     = !!(k['Escape'] || k['x'] || k['X'] || t.b);
    this._held.menu  = !!(k['Escape'] || k['m'] || k['M'] || t.menu);
  }

  _onKey(e, down) {
    this._keys[e.key] = down;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
      e.preventDefault();
    }
  }

  _canvasPos(clientX, clientY) {
    const rect = this._canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / this._scale,
      y: (clientY - rect.top)  / this._scale,
    };
  }

  _hitDpad(x, y) {
    const { cx, cy, size } = DPAD;
    const up    = DPAD.up;
    const down  = DPAD.down;
    const left  = DPAD.left;
    const right = DPAD.right;
    const half  = size / 2;

    if (Math.abs(x - up.x)    < half && Math.abs(y - up.y)    < half) return 'up';
    if (Math.abs(x - down.x)  < half && Math.abs(y - down.y)  < half) return 'down';
    if (Math.abs(x - left.x)  < half && Math.abs(y - left.y)  < half) return 'left';
    if (Math.abs(x - right.x) < half && Math.abs(y - right.y) < half) return 'right';

    // Inner cross zone
    if (Math.abs(x - cx) < 30 && Math.abs(y - cy) < 30) {
      const dx = x - cx, dy = y - cy;
      if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
      return dy > 0 ? 'down' : 'up';
    }
    return null;
  }

  _hitBtn(x, y) {
    for (const [name, btn] of Object.entries(BTNS)) {
      const dx = x - btn.x, dy = y - btn.y;
      if (Math.sqrt(dx*dx + dy*dy) < btn.r + 8) return name;
    }
    return null;
  }

  _onTouch(e) {
    e.preventDefault();
    if (!this._touchBtns) this._touchBtns = {};
    for (const touch of e.changedTouches) {
      const pos = this._canvasPos(touch.clientX, touch.clientY);
      if (pos.y >= LAYOUT.ctrl.y) {
        const dir = this._hitDpad(pos.x, pos.y);
        const btn = !dir ? this._hitBtn(pos.x, pos.y) : null;
        const key = dir || btn;
        if (key) {
          this._touchBtns[key] = true;
          this._activeTouches.set(touch.identifier, key);
        }
      }
    }
  }

  _onTouchEnd(e) {
    e.preventDefault();
    if (!this._touchBtns) this._touchBtns = {};
    for (const touch of e.changedTouches) {
      const key = this._activeTouches.get(touch.identifier);
      if (key) {
        delete this._touchBtns[key];
        this._activeTouches.delete(touch.identifier);
      }
    }
  }

  _onMouse(e, down) {
    if (!this._touchBtns) this._touchBtns = {};
    const pos = this._canvasPos(e.clientX, e.clientY);
    if (down && pos.y >= LAYOUT.ctrl.y) {
      const dir = this._hitDpad(pos.x, pos.y);
      const btn = !dir ? this._hitBtn(pos.x, pos.y) : null;
      this._mouseKey = dir || btn;
      if (this._mouseKey) this._touchBtns[this._mouseKey] = true;
    } else if (!down && this._mouseKey) {
      delete this._touchBtns[this._mouseKey];
      this._mouseKey = null;
    }
  }

  isDown(key) { return !!this._held[key]; }
  isJust(key) { return !!this._just[key]; }
}
