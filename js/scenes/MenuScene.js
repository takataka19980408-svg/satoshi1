import { Scene } from '../engine/Scene.js';
import { CANVAS_W, CANVAS_H, COLORS } from '../constants.js';

const TABS = ['ステータス', 'モンスター', 'アイテム', 'セーブ'];

export class MenuScene extends Scene {
  constructor(game) {
    super(game);
    this._tab     = 0;
    this._returnTo = 'world';
    this._saved   = false;
    this._saveMsg = '';
    this._saveMsgTimer = 0;
  }

  enter({ returnTo = 'world' } = {}) {
    this._returnTo = returnTo;
    this._tab  = 0;
    this._saved = false;
    this._saveMsgTimer = 0;
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
    ctx.fillStyle = '#0a0a1e';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // タイトル
    ctx.fillStyle = COLORS.accent;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('メニュー', CANVAS_W / 2, 30);

    // タブ
    TABS.forEach((t, i) => {
      const x = 10 + i * 85;
      const active = i === this._tab;
      ctx.fillStyle = active ? COLORS.accent : '#1a2040';
      ctx.fillRect(x, 44, 82, 22);
      ctx.strokeStyle = active ? COLORS.accent : COLORS.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, 44, 82, 22);
      ctx.fillStyle = active ? '#0a0a1e' : COLORS.textDim;
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t, x + 41, 59);
    });

    // コンテンツ
    ctx.fillStyle = 'rgba(8,10,28,0.9)';
    ctx.fillRect(8, 68, CANVAS_W - 16, 500);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(8, 68, CANVAS_W - 16, 500);

    switch (this._tab) {
      case 0: this._drawStatus(ctx); break;
      case 1: this._drawMonsters(ctx); break;
      case 2: this._drawItems(ctx); break;
      case 3: this._drawSave(ctx); break;
    }

    // 閉じるヒント
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Bボタン : とじる', CANVAS_W / 2, CANVAS_H - 20);
  }

  _drawStatus(ctx) {
    const party = [...this.game.state.party, ...this.game.state.monsters];
    let y = 90;
    for (const m of party) {
      ctx.fillStyle = COLORS.accent;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${m.name}  Lv.${m.level || 1}`, 24, y);
      y += 4;
      const bars = [
        { label: 'HP', val: m.hp, max: m.maxHp, color: COLORS.hp },
        { label: 'MP', val: m.mp || 0, max: m.maxMp || 1, color: COLORS.mp },
      ];
      for (const b of bars) {
        y += 18;
        ctx.fillStyle = COLORS.textDim;
        ctx.font = '11px monospace';
        ctx.fillText(`${b.label}`, 24, y);
        const bw = 180, bx = 50;
        ctx.fillStyle = '#1a2040';
        ctx.fillRect(bx, y - 11, bw, 9);
        ctx.fillStyle = b.color;
        ctx.fillRect(bx, y - 11, Math.floor(bw * Math.max(0, b.val / b.max)), 9);
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, y - 11, bw, 9);
        ctx.fillStyle = COLORS.text;
        ctx.fillText(`${b.val}/${b.max}`, bx + bw + 6, y);
      }
      y += 14;
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '11px monospace';
      ctx.fillText(`ATK:${m.atk||0}  DEF:${m.def||0}  EXP:${m.exp||0}`, 24, y);
      y += 28;
      ctx.fillStyle = COLORS.border;
      ctx.fillRect(24, y - 10, CANVAS_W - 48, 1);
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
    let y = 90;
    for (const m of monsters) {
      ctx.fillStyle = COLORS.accent;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${m.name}  Lv.${m.level}`, 24, y);
      y += 18;
      ctx.fillStyle = COLORS.text;
      ctx.font = '12px monospace';
      ctx.fillText(`HP ${m.hp}/${m.maxHp}`, 24, y);
      y += 28;
    }
  }

  _drawItems(ctx) {
    const items = this.game.state.inventory;
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
      ctx.fillText(`${def.name || item.id}  x${item.count}`, 24, y);
      if (def.desc) {
        ctx.fillStyle = COLORS.textDim;
        ctx.font = '11px monospace';
        ctx.fillText(def.desc, 28, y + 16);
      }
      y += 40;
    }
  }

  _drawSave(ctx) {
    ctx.fillStyle = COLORS.text;
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';

    const hasSave = this.game.save.hasSave();
    const saved   = this.game.save.load();

    ctx.fillText(hasSave ? 'セーブデータあり' : 'セーブデータなし', CANVAS_W / 2, 120);

    if (saved?.timestamp) {
      const d = new Date(saved.timestamp);
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '11px monospace';
      ctx.fillText(`最終セーブ: ${d.toLocaleString('ja-JP')}`, CANVAS_W / 2, 142);
    }

    if (saved?.currentMap) {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '11px monospace';
      ctx.fillText(`場所: ${saved.currentMap}`, CANVAS_W / 2, 160);
    }

    // セーブボタン
    ctx.fillStyle = '#1a3060';
    ctx.fillRect(CANVAS_W / 2 - 70, 220, 140, 36);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(CANVAS_W / 2 - 70, 220, 140, 36);
    ctx.fillStyle = COLORS.accent;
    ctx.font = 'bold 14px monospace';
    ctx.fillText('セーブする [A]', CANVAS_W / 2, 244);

    if (this._saveMsgTimer > 0) {
      ctx.fillStyle = COLORS.gold;
      ctx.font = 'bold 13px monospace';
      ctx.fillText(this._saveMsg, CANVAS_W / 2, 290);
    }
  }
}
