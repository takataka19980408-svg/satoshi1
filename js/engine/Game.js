import { CANVAS_W, CANVAS_H } from '../constants.js';
import { Input } from './Input.js';
import { AudioManager } from './AudioManager.js';
import { SaveManager } from './SaveManager.js';
import { AssetLoader } from './AssetLoader.js';

import { TitleScene } from '../scenes/TitleScene.js';
import { WorldScene } from '../scenes/WorldScene.js';
import { BattleScene } from '../scenes/BattleScene.js';
import { MenuScene } from '../scenes/MenuScene.js';
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

    // ゲーム状態（外部JSONと同期する）
    this.state = this._defaultState();

    this._scenes = {};
    this._scene  = null;
    this._lastTime = 0;
    this._running  = false;

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
    this.canvas.style.width  = `${Math.floor(CANVAS_W * this.scale)}px`;
    this.canvas.style.height = `${Math.floor(CANVAS_H * this.scale)}px`;
  }

  async start() {
    // ローディング表示
    this._drawLoading();

    await this.loader.loadAll();

    // パーティ初期化
    const partyData = this.loader.get('data/characters/party.json');
    this.state.party = [JSON.parse(JSON.stringify(partyData.satoshi))];

    this._scenes.title   = new TitleScene(this);
    this._scenes.world   = new WorldScene(this);
    this._scenes.battle  = new BattleScene(this);
    this._scenes.menu    = new MenuScene(this);
    this._scenes.ending  = new EndingScene(this);

    this.changeScene('title');
    this._running = true;
    requestAnimationFrame(t => this._loop(t));
  }

  _drawLoading() {
    const ctx = this.ctx;
    ctx.fillStyle = '#0a0a1e';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#7ab8ff';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Loading...', CANVAS_W / 2, CANVAS_H / 2);
  }

  changeScene(name, params = {}) {
    if (this._scene) this._scene.exit();
    this._scene = this._scenes[name];
    if (this._scene) this._scene.enter(params);
  }

  _loop(timestamp) {
    if (!this._running) return;
    const dt = Math.min((timestamp - this._lastTime) / 1000, 0.05);
    this._lastTime = timestamp;

    this.input.update(this.scale);

    this.ctx.fillStyle = '#0a0a1e';
    this.ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (this._scene) {
      this._scene.update(dt);
      this._scene.render(this.ctx);
    }

    requestAnimationFrame(t => this._loop(t));
  }

  // セーブ
  saveGame() {
    return this.save.save({ ...this.state });
  }

  // ロード
  loadGame() {
    const data = this.save.load();
    if (!data) return false;
    this.state = { ...this._defaultState(), ...data };
    return true;
  }
}
