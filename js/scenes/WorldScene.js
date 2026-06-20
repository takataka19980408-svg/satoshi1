import { Scene } from '../engine/Scene.js';
import { CANVAS_W, LAYOUT, COLORS } from '../constants.js';
import { MapSystem }    from '../systems/MapSystem.js';
import { DialogSystem } from '../systems/DialogSystem.js';
import { EventSystem }  from '../systems/EventSystem.js';
import { Player }       from '../entities/Player.js';
import { NPC }          from '../entities/NPC.js';

export class WorldScene extends Scene {
  constructor(game) {
    super(game);
    this.map    = new MapSystem(game);
    this.dialog = new DialogSystem(game);
    this.events = new EventSystem(game, this);
    this.player = new Player(6, 7);
    this.npcs   = [];
    this._flashColor    = null;
    this._flashAlpha    = 0;
    this._flashDuration = 0;
    this._flashTimer    = 0;
    this._inputLock     = false;
    this._initialized   = false;
    this._encounterCooldown = 0;
    this._tapHandler    = null;
    this._tapEndHandler = null;
    this._tapDir        = null;

    this.player.onStep(() => this._onPlayerStep());
  }

  async enter(params = {}) {
    this._inputLock = true;

    // タッチハンドラ登録（再登録前にクリア）
    if (this._tapHandler) {
      this.game.canvas.removeEventListener('touchstart',  this._tapHandler);
      this.game.canvas.removeEventListener('mousedown',   this._tapHandler);
      this.game.canvas.removeEventListener('touchend',    this._tapEndHandler);
      this.game.canvas.removeEventListener('touchcancel', this._tapEndHandler);
      this.game.canvas.removeEventListener('mouseup',     this._tapEndHandler);
    }
    this._tapDir = null;
    this._tapHandler = (e) => {
      if (e.type === 'touchstart') e.preventDefault();
      const src  = e.changedTouches ? e.changedTouches[0] : e;
      const rect = this.game.canvas.getBoundingClientRect();
      const lx   = (src.clientX - rect.left) / this.game.scale;
      const ly   = (src.clientY - rect.top)  / this.game.scale;
      this._handleWorldTap(lx, ly);
    };
    this._tapEndHandler = () => { this._tapDir = null; };
    this.game.canvas.addEventListener('touchstart',  this._tapHandler, { passive: false });
    this.game.canvas.addEventListener('mousedown',   this._tapHandler);
    this.game.canvas.addEventListener('touchend',    this._tapEndHandler);
    this.game.canvas.addEventListener('touchcancel', this._tapEndHandler);
    this.game.canvas.addEventListener('mouseup',     this._tapEndHandler);

    const mapId = params.map || this.game.state.currentMap || 'satoshi_house';
    await this._loadMap(mapId);

    this.player.setPosition(
      params.x   ?? this.game.state.playerX  ?? 6,
      params.y   ?? this.game.state.playerY  ?? 7,
      params.dir ?? this.game.state.playerDir ?? 'down',
    );
    this.map.updateCamera(this.player.px, this.player.py);

    // BGM
    const bgm = this.map.mapData?.bgm || 'village';
    this.game.audio.playBgm(bgm);

    // 最初のイベント
    if (params.firstEvent) {
      setTimeout(() => {
        this.events.trigger(params.firstEvent);
        this._inputLock = false;
      }, 400);
    } else {
      this._inputLock = false;
    }
  }

  async _loadMap(mapId) {
    this.game.state.currentMap = mapId;
    await this.map.load(mapId);

    // NPC初期化
    const npcDefs  = this.map.mapData?.npcs || [];
    const npcData  = this.game.loader.get('data/npcs/chapter1.json') || {};
    const eventData = this.game.loader.get('data/events/chapter1.json') || {};
    this.events.load(eventData);
    this.npcs = npcDefs.map(def => new NPC(def, npcData[def.id]));
  }

  exit() {
    this.game.state.playerX   = this.player.tileX;
    this.game.state.playerY   = this.player.tileY;
    this.game.state.playerDir = this.player.dir;
    if (this._tapHandler) {
      this.game.canvas.removeEventListener('touchstart',  this._tapHandler);
      this.game.canvas.removeEventListener('mousedown',   this._tapHandler);
      this.game.canvas.removeEventListener('touchend',    this._tapEndHandler);
      this.game.canvas.removeEventListener('touchcancel', this._tapEndHandler);
      this.game.canvas.removeEventListener('mouseup',     this._tapEndHandler);
      this._tapHandler    = null;
      this._tapEndHandler = null;
    }
  }

  update(dt) {
    this.dialog.update(dt);
    this.events.update(dt);

    if (this._encounterCooldown > 0) this._encounterCooldown -= dt;

    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      this._flashAlpha = this._flashTimer / this._flashDuration;
    }

    if (this._inputLock || this.events.isRunning || this.dialog.active) {
      this.player.update(dt);
      this.map.updateCamera(this.player.px, this.player.py);
      this._handleDialogInput();
      return;
    }

    this._handleMovement(dt);
    this.player.update(dt);
    this.map.updateCamera(this.player.px, this.player.py);

    if (!this.player.moving) {
      this._handleActionInput();
    }
  }

  _handleMovement(dt) {
    if (this.player.moving) return;
    const inp = this.game.input;
    let dx = 0, dy = 0;
    if (inp.isDown('up'))    dy = -1;
    if (inp.isDown('down'))  dy =  1;
    if (inp.isDown('left'))  dx = -1;
    if (inp.isDown('right')) dx =  1;

    // タッチ方向（キーボード入力がなければ使用）
    if (dx === 0 && dy === 0 && this._tapDir) {
      dx = this._tapDir.dx;
      dy = this._tapDir.dy;
    }

    if (dx === 0 && dy === 0) return;

    // 斜め移動は禁止（縦優先）
    if (dy !== 0) dx = 0;

    this.player.tryMove(dx, dy, this.map);
  }

  _handleWorldTap(lx, ly) {
    // ダイアログ中はどこをタップしても次へ進める
    if (this.dialog.active) {
      this.events.onConfirm();
      return;
    }

    if (this._inputLock || this.events.isRunning) return;

    // コントローラエリア（☰ メニューボタン）
    if (ly >= LAYOUT.ctrl.y) {
      if (lx >= CANVAS_W - 96 && !this._inputLock) {
        this.game.audio.playSfx('cursor');
        this.game.changeScene('menu', { returnTo: 'world' });
      }
      return;
    }

    // メッセージエリアはスキップ
    if (ly >= LAYOUT.msg.y) return;

    // ゲームエリア（タップで方向移動）
    if (ly >= LAYOUT.game.y && ly < LAYOUT.game.y + LAYOUT.game.h) {
      const playerScreenX = this.player.px - this.map.camX;
      const playerScreenY = LAYOUT.game.y + this.player.py - this.map.camY;
      const dX = lx - playerScreenX;
      const dY = ly - playerScreenY;

      // プレイヤーの真上タップは無視
      if (Math.abs(dX) < 10 && Math.abs(dY) < 10) return;

      let dx = 0, dy = 0;
      if (Math.abs(dX) > Math.abs(dY)) {
        dx = dX > 0 ? 1 : -1;
      } else {
        dy = dY > 0 ? 1 : -1;
      }

      // 前方にNPCがいれば話しかける
      if (!this.player.moving) {
        const tx = this.player.tileX + dx;
        const ty = this.player.tileY + dy;
        const npc = this.map.getNpcAt(tx, ty);
        if (npc) {
          this.player.dir = dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up';
          const npcEntity = this.npcs.find(n => n.id === npc.id);
          if (npcEntity) { this._talkToNpc(npcEntity); return; }
        }
      }

      this._tapDir = { dx, dy };
    }
  }

  _handleDialogInput() {
    if (!this.dialog.active) return;
    const inp = this.game.input;
    if (inp.isJust('up'))   this.dialog.selectChoice(-1);
    if (inp.isJust('down')) this.dialog.selectChoice(1);
    if (inp.isJust('a'))    this.events.onConfirm();
    if (inp.isJust('b'))    this.events.onConfirm();
  }

  _handleActionInput() {
    const inp = this.game.input;
    if (inp.isJust('a')) {
      // 前方のNPCに話しかける
      const { dx, dy } = this._facingDelta();
      const tx = this.player.tileX + dx;
      const ty = this.player.tileY + dy;
      const npc = this.map.getNpcAt(tx, ty);
      if (npc) {
        const npcEntity = this.npcs.find(n => n.id === npc.id);
        if (npcEntity) this._talkToNpc(npcEntity);
        return;
      }
    }

    if (inp.isJust('menu')) {
      this.game.audio.playSfx('cursor');
      this.game.changeScene('menu', { returnTo: 'world' });
    }
  }

  _facingDelta() {
    switch (this.player.dir) {
      case 'up':    return { dx: 0, dy: -1 };
      case 'down':  return { dx: 0, dy:  1 };
      case 'left':  return { dx:-1, dy:  0 };
      case 'right': return { dx: 1, dy:  0 };
      default:      return { dx: 0, dy:  1 };
    }
  }

  _talkToNpc(npc) {
    this.game.audio.playSfx('confirm');
    const lines = npc.getDialog(this.game.state.flags);
    const allLines = Array.isArray(lines) ? lines : [lines];
    this._showSequentialDialog(allLines, npc.name, 0);
  }

  _showSequentialDialog(lines, speaker, idx) {
    if (idx >= lines.length) return;
    this.dialog.show(lines[idx], speaker, () => {
      if (idx + 1 < lines.length) this._showSequentialDialog(lines, speaker, idx + 1);
    });
  }

  _onPlayerStep() {
    const tx = this.player.tileX;
    const ty = this.player.tileY;

    // マップ出口チェック
    const exit = this.map.getExit(tx, ty);
    if (exit) {
      this._inputLock = true;
      this.game.audio.playSfx('confirm');
      setTimeout(() => {
        this.teleport(exit.toMap, exit.toX, exit.toY, exit.dir);
      }, 100);
      return;
    }

    // 座標イベントチェック
    const posEv = this.map.getEventAt(tx, ty);
    if (posEv && !this.events.flagSet(posEv.flag)) {
      this.events.trigger(posEv.eventId);
      return;
    }

    // ランダムエンカウント
    if (this._encounterCooldown <= 0 && this.player.checkEncounter(this.map)) {
      this._startRandomBattle();
    }
  }

  _startRandomBattle() {
    const mapData = this.map.mapData;
    if (!mapData?.encounters?.length) return;
    const pool = mapData.encounters;
    const entry = pool[Math.floor(Math.random() * pool.length)];
    this._encounterCooldown = 3;
    this.game.audio.playSfx('hit');
    this._inputLock = true;
    setTimeout(() => {
      this.game.changeScene('battle', {
        enemyId: entry.id,
        isBoss: false,
        onWin: null,
      });
    }, 200);
  }

  teleport(toMap, toX, toY, toDir = 'down') {
    this._inputLock = true;
    this.game.state.currentMap = toMap;
    this.game.state.playerX   = toX;
    this.game.state.playerY   = toY;
    this.game.state.playerDir = toDir;
    this._loadMap(toMap).then(() => {
      const bgm = this.map.mapData?.bgm || 'village';
      this.game.audio.playBgm(bgm);
      this.player.setPosition(toX, toY, toDir);
      this.map.updateCamera(this.player.px, this.player.py);
      this._inputLock = false;
    });
  }

  flash(color, duration = 300) {
    this._flashColor    = color;
    this._flashDuration = duration / 1000;
    this._flashTimer    = this._flashDuration;
    this._flashAlpha    = 1;
  }

  // バトルから帰還したとき
  returnFromBattle(won, onWin = null) {
    this._inputLock = false;
    this._encounterCooldown = 4;
    const bgm = this.map.mapData?.bgm || 'village';
    this.game.audio.playBgm(bgm);
    if (won) {
      if (this.events.isRunning) {
        this.events.resumeAfterBattle(true);
      } else if (onWin) {
        this.events.trigger(onWin);
      }
    }
  }

  render(ctx) {
    // マップ描画
    const npcSprites = this.npcs.map(n => ({
      x: n.x, y: n.y, sprite: n.sprite, id: n.id,
    }));
    this.map.render(ctx, npcSprites, this.player.spriteInfo);

    // ステータスバー
    this._drawStatus(ctx);

    // メッセージウィンドウ
    this.dialog.render(ctx);

    // メニューボタン
    this._drawMenuBtn(ctx);

    // フラッシュエフェクト
    if (this._flashTimer > 0 && this._flashColor) {
      ctx.globalAlpha = this._flashAlpha * 0.7;
      ctx.fillStyle = this._flashColor;
      ctx.fillRect(0, 0, CANVAS_W, LAYOUT.game.h + LAYOUT.game.y);
      ctx.globalAlpha = 1;
    }
  }

  _drawStatus(ctx) {
    const { x, y, w, h } = LAYOUT.status;
    ctx.fillStyle = 'rgba(8, 10, 28, 0.92)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    const party = [...this.game.state.party, ...this.game.state.monsters];
    let ox = 10;
    for (const member of party.slice(0, 2)) {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(member.name, ox, y + 14);
      // HPバー
      const barW = 70;
      const hpRatio = Math.max(0, member.hp / member.maxHp);
      ctx.fillStyle = '#1a2040';
      ctx.fillRect(ox, y + 20, barW, 8);
      ctx.fillStyle = hpRatio > 0.3 ? COLORS.hp : COLORS.hpLow;
      ctx.fillRect(ox, y + 20, Math.floor(barW * hpRatio), 8);
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(ox, y + 20, barW, 8);
      ctx.fillStyle = COLORS.text;
      ctx.font = '10px monospace';
      ctx.fillText(`${member.hp}/${member.maxHp}`, ox, y + 40);
      ox += 90;
    }

    // マップ名
    const mapName = this.map.mapData?.name || '';
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(mapName, CANVAS_W - 8, y + 14);
  }

  _drawMenuBtn(ctx) {
    const { y, w, h } = LAYOUT.ctrl;

    // 背景
    ctx.fillStyle = 'rgba(4, 6, 18, 0.88)';
    ctx.fillRect(0, y, w, h);
    ctx.strokeStyle = '#151a2e';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, y, w, 1);

    // ☰ メニューボタン（右側）
    const bx = w - 96, by = y + 16, bw = 86, bh = 48;
    ctx.fillStyle = '#12183a';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#2a3a60';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('☰ メニュー', bx + bw / 2, by + 20);
    ctx.fillStyle = '#1e2a44';
    ctx.font = '9px monospace';
    ctx.fillText('[M / Esc]', bx + bw / 2, by + 38);

    // ヒント
    ctx.fillStyle = '#1e2840';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('タップ: 移動 / NPC話す', 10, y + h / 2 + 4);
  }
}
