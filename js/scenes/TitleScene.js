import { Scene } from '../engine/Scene.js';
import { CANVAS_W, CANVAS_H, COLORS } from '../constants.js';

export class TitleScene extends Scene {
  constructor(game) {
    super(game);
    this._cursor = 0;
    this._blinkTimer = 0;
    this._starTimer  = 0;
    this._stars = this._genStars();
    this._inputLock = false;
    this._tapHandler = null;
  }

  _genStars() {
    return Array.from({ length: 80 }, () => ({
      x: Math.random() * CANVAS_W,
      y: Math.random() * CANVAS_H * 0.65,
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

    // メニュー項目を直接タップできるようにする
    this._tapHandler = (e) => {
      if (e.type === 'touchstart') e.preventDefault();
      const src = e.changedTouches ? e.changedTouches[0] : e;
      const rect = this.game.canvas.getBoundingClientRect();
      const lx = (src.clientX - rect.left) / this.game.scale;
      const ly = (src.clientY - rect.top)  / this.game.scale;
      this._handleTap(lx, ly);
    };
    this.game.canvas.addEventListener('touchstart', this._tapHandler, { passive: false });
    this.game.canvas.addEventListener('mousedown',  this._tapHandler);
  }

  exit() {
    if (this._tapHandler) {
      this.game.canvas.removeEventListener('touchstart', this._tapHandler);
      this.game.canvas.removeEventListener('mousedown',  this._tapHandler);
      this._tapHandler = null;
    }
  }

  // メニュー項目 or Aボタン領域のタップを処理
  _handleTap(lx, ly) {
    if (this._inputLock) return;
    const mx = CANVAS_W / 2;
    const my = 278;
    for (let i = 0; i < 2; i++) {
      const ty = my + i * 36;
      if (ly >= ty - 20 && ly <= ty + 16 && lx >= mx - 90 && lx <= mx + 90) {
        const dim = i === 1 && !this._hasSave;
        if (!dim) {
          this._cursor = i;
          this.game.audio.playSfx('cursor');
          if (i === 0) this._startNewGame();
          else this._loadGame();
        }
        return;
      }
    }
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
    setTimeout(() => {
      this.game.state = {
        chapter: 1, flags: {}, party: [], monsters: [], inventory: [],
        currentMap: 'satoshi_house', playerX: 6, playerY: 7, playerDir: 'down',
      };
      const partyData = this.game.loader.get('data/characters/party.json');
      const satoshi = partyData?.satoshi ?? this.game._fallbackSatoshi?.() ?? {
        id: 'satoshi', name: 'サトシ', level: 1, exp: 0,
        hp: 40, maxHp: 40, mp: 10, maxMp: 10, atk: 10, def: 7, spd: 8, skills: [],
      };
      this.game.state.party = [JSON.parse(JSON.stringify(satoshi))];
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
    // 背景グラデーション
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#02021a');
    grad.addColorStop(0.6, '#0a0820');
    grad.addColorStop(1, '#060418');
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
    // 影
    ctx.fillStyle = '#0a1838';
    ctx.font = 'bold 30px monospace';
    ctx.fillText('サトシと', CANVAS_W / 2 + 2, 174);
    ctx.fillText('奇妙な石', CANVAS_W / 2 + 2, 212);
    // 本体
    ctx.fillStyle = '#7ab8ff';
    ctx.font = 'bold 30px monospace';
    ctx.fillText('サトシと', CANVAS_W / 2, 172);
    ctx.fillText('奇妙な石', CANVAS_W / 2, 210);

    // サブタイトル
    ctx.fillStyle = '#405888';
    ctx.font = '11px monospace';
    ctx.fillText('Chapter I  星の落ちた森', CANVAS_W / 2, 234);

    // メニュー
    this._drawMenu(ctx);

    // バージョン
    ctx.fillStyle = '#253050';
    ctx.font = '10px monospace';
    ctx.fillText('ver 0.1.0', CANVAS_W / 2, CANVAS_H - 8);
  }

  _drawTitleStone(ctx) {
    const cx = CANVAS_W / 2;
    const cy = 88;
    const t  = this._starTimer;

    // 外周オーラ（グロー効果）
    for (let r = 44; r > 0; r -= 8) {
      const alpha = (0.04 + 0.03 * Math.sin(t * 1.8)) * (44 - r) / 44;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#5090ee';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const pulse = 0.7 + 0.3 * Math.sin(t * 2.4);

    // 石の影（立体感）
    ctx.fillStyle = '#111830';
    ctx.fillRect(cx - 15, cy - 10, 32, 24);

    // 石本体（3層）
    ctx.globalAlpha = 0.9 + 0.1 * pulse;
    ctx.fillStyle = '#1e3060';
    ctx.fillRect(cx - 14, cy - 12, 28, 22);
    ctx.fillStyle = '#3060b0';
    ctx.fillRect(cx - 12, cy - 10, 24, 18);
    ctx.fillStyle = '#5090e0';
    ctx.fillRect(cx - 8,  cy - 7,  16, 12);
    // コア
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#90c8ff';
    ctx.fillRect(cx - 4,  cy - 3,  8, 6);
    ctx.fillStyle = '#d0e8ff';
    ctx.fillRect(cx - 2,  cy - 1,  4, 3);

    // 光の反射
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#e0f4ff';
    ctx.fillRect(cx - 10, cy - 8, 6, 4);
    ctx.globalAlpha = 1;

    // 浮遊する光の粒
    for (let i = 0; i < 5; i++) {
      const angle = t * 0.8 + (i * Math.PI * 2 / 5);
      const r = 22 + 6 * Math.sin(t * 1.2 + i);
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r * 0.5;
      const a = 0.4 + 0.4 * Math.sin(t * 2 + i * 1.2);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#90c8ff';
      ctx.fillRect(px, py, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  _drawMenu(ctx) {
    const items = ['ニューゲーム', 'つづきから'];
    const mx = CANVAS_W / 2;
    const my = 278;

    ctx.textAlign = 'center';
    items.forEach((item, i) => {
      const y = my + i * 36;
      const active = i === this._cursor;
      const dim    = i === 1 && !this._hasSave;

      // 選択ハイライト
      if (active && !dim) {
        ctx.fillStyle = 'rgba(30, 50, 100, 0.75)';
        ctx.fillRect(mx - 88, y - 19, 176, 30);
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(mx - 88, y - 19, 176, 30);
      }

      // カーソル
      if (active && !dim) {
        const blink = 0.6 + 0.4 * Math.sin(this._blinkTimer * 5);
        ctx.globalAlpha = blink;
        ctx.fillStyle = COLORS.accent;
        ctx.font = 'bold 14px monospace';
        ctx.fillText('▶', mx - 72, y + 1);
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = dim ? '#2a2a48' : (active ? COLORS.accent : '#90a8d8');
      ctx.font = `${active && !dim ? 'bold ' : ''}15px monospace`;
      ctx.fillText(item, mx + 8, y + 1);
    });

    // ヒントテキスト
    ctx.fillStyle = '#304060';
    ctx.font = '10px monospace';
    ctx.fillText('↑↓ で選ぶ  A / タップ で決定', mx, my + 76);
  }

}
