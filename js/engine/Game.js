import { CANVAS_W, CANVAS_H } from '../constants.js';
import { Input } from './Input.js';
import { AudioManager } from './AudioManager.js';
import { SaveManager } from './SaveManager.js';
import { AssetLoader } from './AssetLoader.js';

import { TitleScene }  from '../scenes/TitleScene.js';
import { WorldScene }  from '../scenes/WorldScene.js';
import { BattleScene } from '../scenes/BattleScene.js';
import { MenuScene }   from '../scenes/MenuScene.js';
import { EndingScene } from '../scenes/EndingScene.js';

export class Game {
  constructor() {
    const canvas = document.getElementById('game-canvas');
    canvas.width  = CANVAS_W;
    canvas.height = CANVAS_H;

    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.scale = this._calcScale();
    this._applyScale();

    this.audio  = new AudioManager();
    this.save   = new SaveManager();
    this.loader = new AssetLoader();
    this.input  = new Input(canvas, this.scale);

    this.state = this._defaultState();

    this._scenes    = {};
    this._scene     = null;
    this._lastTime  = 0;
    this._running   = false;
    this._loadTimer = 0;

    window.addEventListener('resize', () => {
      this.scale = this._calcScale();
      this._applyScale();
    });
  }

  _defaultState() {
    return {
      chapter: 1,
      flags: {},
      party: [],
      monsters: [],
      inventory: [],
      currentMap: 'satoshi_house',
      playerX: 6,
      playerY: 7,
      playerDir: 'down',
    };
  }

  _calcScale() {
    const sw = window.innerWidth  / CANVAS_W;
    const sh = window.innerHeight / CANVAS_H;
    return Math.min(sw, sh);
  }

  _applyScale() {
    const w = Math.floor(CANVAS_W * this.scale);
    const h = Math.floor(CANVAS_H * this.scale);
    this.canvas.style.width  = `${w}px`;
    this.canvas.style.height = `${h}px`;
  }

  async start() {
    // ローディングアニメーション（非同期ロード中も描画）
    this._running   = true;
    this._lastTime  = performance.now();
    this._loadTimer = 0;
    this._loading   = true;
    requestAnimationFrame(t => this._loop(t));

    try {
      await this.loader.loadAll();
    } catch (e) {
      console.error('データ読み込みエラー:', e);
      // フォールバック：インライン初期データで続行
    }

    const partyData = this.loader.get('data/characters/party.json');
    const satoshi   = partyData?.satoshi ?? this._fallbackSatoshi();
    this.state.party = [JSON.parse(JSON.stringify(satoshi))];

    this._scenes.title   = new TitleScene(this);
    this._scenes.world   = new WorldScene(this);
    this._scenes.battle  = new BattleScene(this);
    this._scenes.menu    = new MenuScene(this);
    this._scenes.ending  = new EndingScene(this);

    this._loading = false;
    this.changeScene('title');
  }

  // JSONロードに失敗したときのインライン代替データ
  _fallbackSatoshi() {
    return {
      id: 'satoshi', name: 'サトシ', sprite: 'satoshi',
      level: 1, exp: 0,
      hp: 40, maxHp: 40, mp: 10, maxMp: 10,
      atk: 10, def: 7, spd: 8, skills: [],
    };
  }

  changeScene(name, params = {}) {
    if (this._scene) this._scene.exit();
    this._scene = this._scenes[name];
    if (this._scene) this._scene.enter(params);
  }

  _loop(timestamp) {
    if (!this._running) return;
    const dt = Math.min((timestamp - this._lastTime) / 1000, 0.05);
    this._lastTime  = timestamp;
    this._loadTimer += dt;

    this.ctx.fillStyle = '#0a0a1e';
    this.ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (this._loading) {
      this._renderLoading();
    } else {
      this.input.update(this.scale);
      if (this._scene) {
        this._scene.update(dt);
        this._scene.render(this.ctx);
      }
    }

    requestAnimationFrame(t => this._loop(t));
  }

  _renderLoading() {
    const ctx  = this.ctx;
    const t    = this._loadTimer;
    const cx   = CANVAS_W / 2;
    const cy   = CANVAS_H / 2;

    // 星
    for (let i = 0; i < 40; i++) {
      const x = (i * 41 + 7) % CANVAS_W;
      const y = (i * 29 + 3) % (CANVAS_H * 0.6);
      const a = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.6 + i * 0.4));
      ctx.globalAlpha = a;
      ctx.fillStyle   = '#9ab8ff';
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;

    // 光る石アニメーション
    const pulse = 0.7 + 0.3 * Math.sin(t * 3);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#4488cc';
    ctx.fillRect(cx - 10, cy - 36, 20, 16);
    ctx.fillStyle = '#66aaff';
    ctx.fillRect(cx - 8,  cy - 34, 16, 12);
    ctx.fillStyle = '#aaddff';
    ctx.fillRect(cx - 5,  cy - 32, 10, 8);
    ctx.globalAlpha = 1;

    // テキスト
    ctx.fillStyle   = '#5080a0';
    ctx.font        = '13px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText('Loading...', cx, cy + 10);

    const dots = '.'.repeat((Math.floor(t * 2) % 4));
    ctx.fillStyle = '#3a6080';
    ctx.fillText(dots, cx + 30, cy + 10);
  }

  saveGame() {
    return this.save.save({ ...this.state });
  }

  loadGame() {
    const data = this.save.load();
    if (!data) return false;
    this.state = { ...this._defaultState(), ...data };
    return true;
  }
}
