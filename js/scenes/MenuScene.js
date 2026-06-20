import { Scene } from '../engine/Scene.js';
import { CANVAS_W, CANVAS_H, LAYOUT, COLORS } from '../constants.js';

const TABS = ['ステータス', 'モンスター', 'アイテム', 'セーブ'];
const CONTENT_TOP = 68;
const CONTENT_H   = 404; // 68+404=472, stays above ctrl zone (y=480)

export class MenuScene extends Scene {
  constructor(game) {
    super(game);
    this._tab          = 0;
    this._returnTo     = 'world';
    this._saved        = false;
    this._saveMsg      = '';
    this._saveMsgTimer = 0;
    this._tapHandler   = null;
  }

  enter({ returnTo = 'world' } = {}) {
    this._returnTo     = returnTo;
    this._tab          = 0;
    this._saved        = false;
    this._saveMsgTimer = 0;

    this._tapHandler = (e) => {
      if (e.type === 'touchstart') e.preventDefault();
      const src  = e.changedTouches ? e.changedTouches[0] : e;
      const rect = this.game.canvas.getBoundingClientRect();
      const lx   = (src.clientX - rect.left) / this.game.scale;
      const ly   = (src.clientY - rect.top)  / this.game.scale;
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

  _handleTap(lx, ly) {
    // タブ切り替え
    if (ly >= 44 && ly <= 66) {
      for (let i = 0; i < TABS.length; i++) {
        const tx = 10 + i * 85;
        if (lx >= tx && lx <= tx + 82) {
          if (this._tab !== i) {
            this._tab = i;
            this.game.audio.playSfx('cursor');
          }
          return;
        }
      }
    }

    // とじるボタン（ヘッダ右上）
    if (lx >= CANVAS_W - 70 && lx <= CANVAS_W - 4 && ly >= 6 && ly <= 36) {
      this.game.audio.playSfx('cancel');
      this.game.changeScene(this._returnTo);
      return;
    }

    // セーブボタン（セーブタブ時）
    if (this._tab === 3 && ly >= 220 && ly <= 256 && lx >= CANVAS_W / 2 - 70 && lx <= CANVAS_W / 2 + 70) {
      if (this.game.saveGame()) {
        this._saveMsg = 'セーブしました';
        this.game.audio.playSfx('confirm');
      } else {
        this._saveMsg = 'セーブに失敗';
      }
      this._saveMsgTimer = 2;
      return;
    }
  }

  update(dt) {
    this._saveMsgTimer -= dt;

    const inp = this.game.input;
    if (inp.isJust('left'))  { this._tab = (this._tab - 1 + TABS.length) % TABS.length; this.game.audio.playSfx('cursor'); }
    if (inp.isJust('right')) { this._tab = (this._tab + 1) % TABS.length;                this.game.audio.playSfx('cursor'); }

    if (this._tab === 3 && inp.isJust('a')) {
      if (this.game.saveGame()) {
        this._saveMsg = 'セーブしました';
        this.game.audio.playSfx('confirm');
      } else {
        this._saveMsg = 'セーブに失敗';
      }
      this._saveMsgTimer = 2;
    }

    if (inp.isJust('b') || inp.isJust('menu')) {
      this.game.audio.playSfx('cancel');
      this.game.changeScene(this._returnTo);
    }
  }

  render(ctx) {
    // 背景
    ctx.fillStyle = '#06061a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // ヘッダ帯
    const hg = ctx.createLinearGradient(0, 0, 0, 42);
    hg.addColorStop(0, '#0e1840');
    hg.addColorStop(1, '#0a1030');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, CANVAS_W, 42);
    ctx.fillStyle = COLORS.border;
    ctx.fillRect(0, 41, CANVAS_W, 1);

    // タイトル
    ctx.fillStyle = COLORS.accent;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('メニュー', CANVAS_W / 2 - 30, 28);

    // とじるボタン
    const bx = CANVAS_W - 66, by = 8;
    ctx.fillStyle = '#1a2040';
    ctx.fillRect(bx, by, 62, 28);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, 62, 28);
    ctx.fillStyle = '#c07070';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('× とじる', bx + 31, by + 18);

    // タブ
    TABS.forEach((t, i) => {
      const x      = 10 + i * 85;
      const active = i === this._tab;
      const tg = ctx.createLinearGradient(x, 44, x, 66);
      if (active) { tg.addColorStop(0, '#2a4888'); tg.addColorStop(1, '#1a3060'); }
      else        { tg.addColorStop(0, '#121828'); tg.addColorStop(1, '#0e1420'); }
      ctx.fillStyle = tg;
      ctx.fillRect(x, 44, 82, 22);
      ctx.strokeStyle = active ? COLORS.accent : COLORS.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, 44, 82, 22);
      if (active) {
        ctx.fillStyle = COLORS.accent;
        ctx.fillRect(x + 1, 64, 80, 2);
      }
      ctx.fillStyle = active ? COLORS.accent : COLORS.textDim;
      ctx.font = `${active ? 'bold ' : ''}11px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(t, x + 41, 59);
    });

    // コンテンツ枠
    ctx.fillStyle = 'rgba(8,10,30,0.95)';
    ctx.fillRect(8, CONTENT_TOP, CANVAS_W - 16, CONTENT_H);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(8, CONTENT_TOP, CANVAS_W - 16, CONTENT_H);

    // コンテンツ描画（ctrl前の領域のみ）
    ctx.save();
    ctx.beginPath();
    ctx.rect(8, CONTENT_TOP, CANVAS_W - 16, CONTENT_H);
    ctx.clip();
    switch (this._tab) {
      case 0: this._drawStatus(ctx);   break;
      case 1: this._drawMonsters(ctx); break;
      case 2: this._drawItems(ctx);    break;
      case 3: this._drawSave(ctx);     break;
    }
    ctx.restore();

    // コントローラエリア（ヒントのみ）
    ctx.fillStyle = 'rgba(4, 6, 18, 0.88)';
    ctx.fillRect(0, LAYOUT.ctrl.y, CANVAS_W, LAYOUT.ctrl.h);
    ctx.strokeStyle = '#151a2e';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, LAYOUT.ctrl.y, CANVAS_W, 1);
    ctx.fillStyle = '#253050';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('← → でタブ切替  ×ボタン or タップでとじる', CANVAS_W / 2, LAYOUT.ctrl.y + LAYOUT.ctrl.h / 2 + 4);
  }

  _drawStatus(ctx) {
    const party = [...this.game.state.party, ...this.game.state.monsters];
    let y = 92;
    for (const m of party) {
      // 名前+レベル
      ctx.fillStyle = COLORS.accent;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${m.name}  Lv.${m.level || 1}`, 22, y);
      y += 4;

      // HP/MPバー
      const bars = [
        { label: 'HP', val: m.hp,     max: m.maxHp || 1, color: COLORS.hp },
        { label: 'MP', val: m.mp || 0, max: m.maxMp || 1, color: COLORS.mp },
      ];
      for (const b of bars) {
        y += 18;
        ctx.fillStyle = COLORS.textDim;
        ctx.font = '11px monospace';
        ctx.fillText(b.label, 22, y);
        const bw = 170, bx = 48;
        ctx.fillStyle = '#0e1828';
        ctx.fillRect(bx, y - 10, bw, 8);
        const ratio = Math.max(0, Math.min(1, b.val / b.max));
        ctx.fillStyle = (b.label === 'HP' && ratio < 0.25) ? COLORS.hpLow : b.color;
        ctx.fillRect(bx, y - 10, Math.floor(bw * ratio), 8);
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, y - 10, bw, 8);
        ctx.fillStyle = COLORS.text;
        ctx.font = '10px monospace';
        ctx.fillText(`${b.val}/${b.max}`, bx + bw + 5, y);
      }
      y += 12;
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '11px monospace';
      ctx.fillText(`ATK:${m.atk||0}  DEF:${m.def||0}  EXP:${m.exp||0}`, 22, y);
      y += 24;
      ctx.fillStyle = COLORS.border;
      ctx.fillRect(22, y - 8, CANVAS_W - 44, 1);
    }
  }

  _drawMonsters(ctx) {
    const monsters = this.game.state.monsters;
    if (!monsters.length) {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('仲間のモンスターがいない', CANVAS_W / 2, 200);
      return;
    }
    let y = 92;
    for (const m of monsters) {
      ctx.fillStyle = COLORS.accent;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${m.name}  Lv.${m.level}`, 22, y);
      y += 18;
      ctx.fillStyle = COLORS.text;
      ctx.font = '12px monospace';
      ctx.fillText(`HP ${m.hp}/${m.maxHp}`, 22, y);
      y += 28;
    }
  }

  _drawItems(ctx) {
    const items    = this.game.state.inventory;
    const itemDefs = this.game.loader.get('data/items/items.json') || {};
    if (!items.length) {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('アイテムがない', CANVAS_W / 2, 200);
      return;
    }
    let y = 96;
    for (const item of items) {
      const def = itemDefs[item.id] || {};
      ctx.fillStyle = COLORS.text;
      ctx.font = '13px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${def.name || item.id}  x${item.count}`, 22, y);
      if (def.desc) {
        ctx.fillStyle = COLORS.textDim;
        ctx.font = '11px monospace';
        ctx.fillText(def.desc, 26, y + 14);
      }
      y += 38;
    }
  }

  _drawSave(ctx) {
    ctx.textAlign = 'center';
    const hasSave = this.game.save.hasSave();
    const saved   = this.game.save.load();

    ctx.fillStyle = hasSave ? COLORS.accent : COLORS.textDim;
    ctx.font = '13px monospace';
    ctx.fillText(hasSave ? 'セーブデータあり' : 'セーブデータなし', CANVAS_W / 2, 110);

    if (saved?.timestamp) {
      const d = new Date(saved.timestamp);
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '11px monospace';
      ctx.fillText(`最終セーブ: ${d.toLocaleString('ja-JP')}`, CANVAS_W / 2, 132);
    }
    if (saved?.currentMap) {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '11px monospace';
      ctx.fillText(`場所: ${saved.currentMap}`, CANVAS_W / 2, 152);
    }

    // セーブボタン
    const sg = ctx.createLinearGradient(CANVAS_W / 2 - 70, 220, CANVAS_W / 2 - 70, 256);
    sg.addColorStop(0, '#1e3a70');
    sg.addColorStop(1, '#122448');
    ctx.fillStyle = sg;
    ctx.fillRect(CANVAS_W / 2 - 70, 220, 140, 36);
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(CANVAS_W / 2 - 70, 220, 140, 36);
    ctx.fillStyle = COLORS.accent;
    ctx.font = 'bold 13px monospace';
    ctx.fillText('セーブする', CANVAS_W / 2, 241);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '10px monospace';
    ctx.fillText('[A / タップ]', CANVAS_W / 2, 253);

    if (this._saveMsgTimer > 0) {
      const alpha = Math.min(1, this._saveMsgTimer);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.gold;
      ctx.font = 'bold 13px monospace';
      ctx.fillText(this._saveMsg, CANVAS_W / 2, 286);
      ctx.globalAlpha = 1;
    }
  }

}
