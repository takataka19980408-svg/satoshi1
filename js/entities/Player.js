import { TILE_SIZE } from '../constants.js';

const MOVE_SPEED = 5; // タイル/秒

export class Player {
  constructor(tileX, tileY, dir = 'down') {
    this.tileX   = tileX;
    this.tileY   = tileY;
    this.px      = tileX * TILE_SIZE; // ピクセル座標
    this.py      = tileY * TILE_SIZE;
    this.targetPx = this.px;
    this.targetPy = this.py;
    this.dir     = dir;
    this.moving  = false;
    this._stepCallback = null;

    // 歩数カウント（エンカウント用）
    this.steps = 0;
    this._encounterSteps = 0;
    this._nextEncounterAt = this._rollEncounter();
  }

  setPosition(tileX, tileY, dir = 'down') {
    this.tileX    = tileX;
    this.tileY    = tileY;
    this.px       = tileX * TILE_SIZE;
    this.py       = tileY * TILE_SIZE;
    this.targetPx = this.px;
    this.targetPy = this.py;
    this.dir      = dir;
    this.moving   = false;
  }

  tryMove(dx, dy, mapSystem) {
    if (this.moving) return false;
    const newTX = this.tileX + dx;
    const newTY = this.tileY + dy;

    if (dx > 0) this.dir = 'right';
    else if (dx < 0) this.dir = 'left';
    else if (dy > 0) this.dir = 'down';
    else if (dy < 0) this.dir = 'up';

    if (!mapSystem.isWalkable(newTX, newTY)) return false;

    this.tileX    = newTX;
    this.tileY    = newTY;
    this.targetPx = newTX * TILE_SIZE;
    this.targetPy = newTY * TILE_SIZE;
    this.moving   = true;
    return true;
  }

  update(dt) {
    if (!this.moving) return;
    const speed = TILE_SIZE * MOVE_SPEED * dt;
    const dx = this.targetPx - this.px;
    const dy = this.targetPy - this.py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= speed) {
      this.px = this.targetPx;
      this.py = this.targetPy;
      this.moving = false;
      this.steps++;
      this._encounterSteps++;
      if (this._stepCallback) this._stepCallback();
    } else {
      this.px += (dx / dist) * speed;
      this.py += (dy / dist) * speed;
    }
  }

  onStep(cb) { this._stepCallback = cb; }

  // エンカウント判定（歩いた後に呼ぶ）
  checkEncounter(mapSystem) {
    if (!mapSystem.isEncounterTile(this.tileX, this.tileY)) {
      this._encounterSteps = 0;
      return false;
    }
    if (this._encounterSteps >= this._nextEncounterAt) {
      this._encounterSteps = 0;
      this._nextEncounterAt = this._rollEncounter();
      return true;
    }
    return false;
  }

  _rollEncounter() {
    return 4 + Math.floor(Math.random() * 5); // 4〜8歩ごと
  }

  get spriteInfo() {
    return { px: this.px, py: this.py, dir: this.dir };
  }
}
