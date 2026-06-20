import { Scene } from '../engine/Scene.js';
import { CANVAS_W, CANVAS_H, COLORS } from '../constants.js';

export class TitleScene extends Scene {
  constructor(game) {
    super(game);
    this._cursor = 0; // 0=ニューゲーム, 1=つづきから
    this._blinkTimer = 0;
    this._starTimer  = 0;
    this._stars = this._genStars();
    this._phase = 'title'; // 'title' | 'confirm_new'
    this._inputLock = false;
  }

  _genStars() {
    return Array.from({ length: 80 }, () => ({
      x: Math.random() * CANVAS_W,
      y: Math.random() * CANVAS_H * 0.6,
      size: Math.random() * 1.5 + 0.5,
      spd: Math.random() * 0.3 + 0.05,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  enter() {
    this.game.audio.playBgm('title');
    this._cursor = 0;
    this._inputLock = false;
    this._hasSave = this.game.save.hasSave();
  }

  update(dt) {
    this._blinkTimer += dt;
    this._starTimer  += dt;

    if (this._inputLock) return;

    const input = this.game.input;
    if (input.isJust('up'))   { this._cursor = Math.max(0, this._cursor - 1); this.game.audio.playSfx('cursor'); }
    if (input.isJust('down')) { this._cursor = Math.min(this._hasSave ? 1 : 0, this._cursor + 1); this.game.audio.playSfx('cursor'); }

    if (input.isJust('a') || input.isJust('b')) {
      if (this._cursor === 0) {
        this._startNewGame();
      } else if (this._cursor === 1 && this._hasSave) {
        this._loadGame();
      }
    }
  }

  _startNewGame() {
    this.game.audio.playSfx('confirm');
    this._inputLock = true;
    // 画面フェードアウト後に遷移
    setTimeout(() => {
      this.game.state = {
        chapter: 1, flags: {}, party: [], monsters: [], inventory: [],
        currentMap: 'satoshi_house', playerX: 6, playerY: 7, playerDir: 'down',
      };
      const partyData = this.game.loader.get('data/characters/party.json');
      this.game.state.party = [JSON.parse(JSON.stringify(partyData.satoshi))];
      this.game.changeScene('world', {
        map: 'satoshi_house', x: 6, y: 7, dir: 'down',
        firstEvent: 'house_start',
      });
    }, 300);
  }

  _loadGame() {
    this.game.audio.playSfx('confirm');
    this._inputLock = true;
    if (this.game.loadGame()) {
      const s = this.game.state;
      setTimeout(() => {
        this.game.changeScene('world', {
          map: s.currentMap, x: s.playerX, y: s.playerY, dir: s.playerDir,
        });
      }, 300);
    }
  }

  render(ctx) {
    // 空背景
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#04041a');
    grad.addColorStop(1, '#0a0820');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // 星
    for (const s of this._stars) {
      const alpha = 0.4 + 0.6 * Math.abs(Math.sin(this._starTimer * s.spd + s.phase));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#b0d0ff';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    // 奇妙な石（タイトル装飾）
    this._drawTitleStone(ctx);

    // タイトルロゴ
    ctx.textAlign = 'center';
    ctx.fillStyle = '#304878';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('サトシと', CANVAS_W / 2, 210);
    ctx.fillText('奇妙な石', CANVAS_W / 2, 246);
    ctx.fillStyle = '#7ab8ff';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('サトシと', CANVAS_W / 2, 208);
    ctx.fillText('奇妙な石', CANVAS_W / 2, 244);

    // サブタイトル
    ctx.fillStyle = '#405888';
    ctx.font = '11px monospace';
    ctx.fillText('Chapter I  星の落ちた森', CANVAS_W / 2, 270);

    // メニュー
    this._drawMenu(ctx);

    // バージョン
    ctx.fillStyle = '#304060';
    ctx.font = '10px monospace';
    ctx.fillText('ver 0.1.0', CANVAS_W / 2, CANVAS_H - 20);
  }

  _drawTitleStone(ctx) {
    const cx = CANVAS_W / 2;
    const cy = 130;
    const t  = this._starTimer;

    // 光のオーラ
    for (let r = 50; r > 0; r -= 10) {
      const alpha = (0.05 + 0.05 * Math.sin(t * 1.5)) * (50 - r) / 50;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#7ab8ff';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 石本体
    ctx.fillStyle = '#203060';
    ctx.fillRect(cx - 16, cy - 12, 32, 26);
    ctx.fillStyle = '#3050a0';
    ctx.fillRect(cx - 14, cy - 10, 28, 22);
    ctx.fillStyle = '#5080d0';
    ctx.fillRect(cx - 10, cy - 8, 20, 16);
    // 光の反射
    ctx.fillStyle = 'rgba(180, 220, 255, 0.6)';
    ctx.fillRect(cx - 8, cy - 6, 8, 6);
    // 点滅する核
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3);
    ctx.fillStyle = '#aaddff';
    ctx.fillRect(cx - 4, cy - 4, 8, 8);
    ctx.globalAlpha = 1;
  }

  _drawMenu(ctx) {
    const items = ['ニューゲーム', this._hasSave ? 'つづきから' : 'つづきから'];
    const mx = CANVAS_W / 2;
    const my = 320;

    ctx.textAlign = 'center';
    items.forEach((item, i) => {
      const y = my + i * 36;
      const active = i === this._cursor;
      const dim    = i === 1 && !this._hasSave;

      if (active && !dim) {
        ctx.fillStyle = 'rgba(40, 60, 120, 0.7)';
        ctx.fillRect(mx - 80, y - 18, 160, 28);
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(mx - 80, y - 18, 160, 28);
        ctx.fillStyle = COLORS.accent;
        ctx.font = 'bold 15px monospace';
        const blink = 0.7 + 0.3 * Math.sin(this._blinkTimer * 5);
        ctx.globalAlpha = blink;
        ctx.fillText('▶', mx - 66, y);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = dim ? '#303050' : (active ? COLORS.accent : COLORS.text);
      ctx.font = `${active ? 'bold ' : ''}15px monospace`;
      ctx.fillText(item, mx + 8, y);
    });
  }
}
