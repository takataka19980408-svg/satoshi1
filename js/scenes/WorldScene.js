import { Scene } from '../engine/Scene.js';
import { CANVAS_W, CANVAS_H, LAYOUT, COLORS, TILE_SIZE } from '../constants.js';
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
    this._blackoutAlpha = 0;
    this._blackoutFading    = false;
    this._blackoutFadeDir   = 0;
    this._blackoutFadeSpeed = 0;
    this._shakeX = 0;
    this._shakeY = 0;
    this._shakeDuration  = 0;
    this._shakeIntensity = 0;
    this._glowColor    = null;
    this._glowAlpha    = 0;
    this._glowTimer    = 0;
    this._glowDuration = 0;
    this._inputLock     = false;
    this._initialized   = false;
    this._encounterCooldown = 0;
    this._narrationLines = [];
    this._follower = null;
    this._prevPlayerTile = null;
    this._touchStartHandler = null;
    this._touchMoveHandler  = null;
    this._touchEndHandler   = null;
    this._joystick = {
      started: false, active: false, inGameArea: false,
      baseX: 0, baseY: 0, knobX: 0, knobY: 0,
      tapX: 0, tapY: 0, dir: null,
    };

    this.player.onStep(() => this._onPlayerStep());
  }

  async enter(params = {}) {
    this._inputLock = true;
    this.events.reset();

    this._removeTouchHandlers();
    this._joystick.active  = false;
    this._joystick.started = false;
    this._joystick.dir     = null;

    this._touchStartHandler = (e) => {
      if (e.type === 'touchstart') e.preventDefault();
      const src  = e.changedTouches ? e.changedTouches[0] : e;
      const rect = this.game.canvas.getBoundingClientRect();
      const lx   = (src.clientX - rect.left) / this.game.scale;
      const ly   = (src.clientY - rect.top)  / this.game.scale;
      this._handleTouchStart(lx, ly);
    };
    this._touchMoveHandler = (e) => {
      if (e.type === 'touchmove') e.preventDefault();
      const src  = e.changedTouches ? e.changedTouches[0] : e;
      const rect = this.game.canvas.getBoundingClientRect();
      const lx   = (src.clientX - rect.left) / this.game.scale;
      const ly   = (src.clientY - rect.top)  / this.game.scale;
      this._handleTouchMove(lx, ly);
    };
    this._touchEndHandler = () => { this._handleTouchEnd(); };

    this.game.canvas.addEventListener('touchstart',  this._touchStartHandler, { passive: false });
    this.game.canvas.addEventListener('mousedown',   this._touchStartHandler);
    this.game.canvas.addEventListener('touchmove',   this._touchMoveHandler,  { passive: false });
    this.game.canvas.addEventListener('mousemove',   this._touchMoveHandler);
    this.game.canvas.addEventListener('touchend',    this._touchEndHandler);
    this.game.canvas.addEventListener('touchcancel', this._touchEndHandler);
    this.game.canvas.addEventListener('mouseup',     this._touchEndHandler);

    const mapId = params.map || this.game.state.currentMap || 'satoshi_house';
    await this._loadMap(mapId);

    this.player.setPosition(
      params.x   ?? this.game.state.playerX  ?? 6,
      params.y   ?? this.game.state.playerY  ?? 7,
      params.dir ?? this.game.state.playerDir ?? 'down',
    );
    this.map.updateCamera(this.player.px, this.player.py);

    if (this.game.state.flags?.['ril_joined']) {
      this._follower = {
        px: this.player.px, py: this.player.py,
        targetPx: this.player.px, targetPy: this.player.py,
        dir: this.player.dir,
      };
    } else {
      this._follower = null;
    }

    const bgm = this.map.mapData?.bgm || 'village';
    this.game.audio.playBgm(bgm);

    if (params.firstEvent) {
      setTimeout(() => {
        this.events.trigger(params.firstEvent);
        this._inputLock = false;
      }, 400);
    } else {
      this._inputLock = false;
    }
  }

  _removeTouchHandlers() {
    if (this._touchStartHandler) {
      this.game.canvas.removeEventListener('touchstart', this._touchStartHandler);
      this.game.canvas.removeEventListener('mousedown',  this._touchStartHandler);
    }
    if (this._touchMoveHandler) {
      this.game.canvas.removeEventListener('touchmove', this._touchMoveHandler);
      this.game.canvas.removeEventListener('mousemove', this._touchMoveHandler);
    }
    if (this._touchEndHandler) {
      this.game.canvas.removeEventListener('touchend',    this._touchEndHandler);
      this.game.canvas.removeEventListener('touchcancel', this._touchEndHandler);
      this.game.canvas.removeEventListener('mouseup',     this._touchEndHandler);
    }
    this._touchStartHandler = null;
    this._touchMoveHandler  = null;
    this._touchEndHandler   = null;
  }

  async _loadMap(mapId) {
    this.game.state.currentMap = mapId;
    await this.map.load(mapId);

    const npcDefs = this.map.mapData?.npcs || [];
    const npcData = Object.assign(
      {},
      this.game.loader.get('data/npcs/chapter1.json') || {},
      this.game.loader.get('data/npcs/chapter2.json') || {},
      this.game.loader.get('data/npcs/chapter3.json') || {},
    );
    const eventData = Object.assign(
      {},
      this.game.loader.get('data/events/chapter1.json') || {},
      this.game.loader.get('data/events/chapter2.json') || {},
      this.game.loader.get('data/events/chapter3.json') || {},
      this.game.loader.get('data/events/chapter4.json') || {},
      this.game.loader.get('data/events/chapter4b.json') || {},
      this.game.loader.get('data/events/chapter5.json') || {},
    );
    this.events.load(eventData);
    const npcDataAll = Object.assign(
      {},
      npcData,
      this.game.loader.get('data/npcs/chapter4.json') || {},
    );
    this.npcs = npcDefs.map(def => new NPC(def, npcDataAll[def.id]));
  }

  exit() {
    this.game.state.playerX   = this.player.tileX;
    this.game.state.playerY   = this.player.tileY;
    this.game.state.playerDir = this.player.dir;
    this._removeTouchHandlers();
    this._joystick.active  = false;
    this._joystick.started = false;
    this._joystick.dir     = null;
  }

  update(dt) {
    this.dialog.update(dt);
    this.events.update(dt);

    if (this._encounterCooldown > 0) this._encounterCooldown -= dt;

    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      this._flashAlpha = this._flashTimer / this._flashDuration;
    }

    if (this._blackoutFading) {
      this._blackoutAlpha += this._blackoutFadeDir * this._blackoutFadeSpeed * dt;
      this._blackoutAlpha = Math.max(0, Math.min(1, this._blackoutAlpha));
      if ((this._blackoutFadeDir > 0 && this._blackoutAlpha >= 1) ||
          (this._blackoutFadeDir < 0 && this._blackoutAlpha <= 0)) {
        this._blackoutFading = false;
      }
    }

    if (this._shakeDuration > 0) {
      this._shakeDuration -= dt;
      this._shakeX = (Math.random() - 0.5) * this._shakeIntensity * 2;
      this._shakeY = (Math.random() - 0.5) * this._shakeIntensity * 2;
    } else {
      this._shakeX = 0;
      this._shakeY = 0;
    }

    if (this._glowTimer > 0) {
      this._glowTimer -= dt;
      const half    = this._glowDuration / 2;
      const elapsed = this._glowDuration - this._glowTimer;
      this._glowAlpha = elapsed < half
        ? (elapsed / half) * 0.32
        : ((1 - (elapsed - half) / half)) * 0.32;
    } else {
      this._glowAlpha = 0;
    }

    if (this._inputLock || this.events.isRunning || this.dialog.active) {
      this.player.update(dt);
      this.map.updateCamera(this.player.px, this.player.py);
      this._updateFollower(dt);
      this._handleDialogInput();
      return;
    }

    this._handleMovement(dt);
    this.player.update(dt);
    this.map.updateCamera(this.player.px, this.player.py);
    this._updateFollower(dt);

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

    if (dx === 0 && dy === 0 && this._joystick.active && this._joystick.dir) {
      dx = this._joystick.dir.dx;
      dy = this._joystick.dir.dy;
    }

    if (dx === 0 && dy === 0) return;
    if (dy !== 0) dx = 0;
    this._prevPlayerTile = { x: this.player.tileX, y: this.player.tileY, dir: this.player.dir };
    this.player.tryMove(dx, dy, this.map);
  }

  _handleTouchStart(lx, ly) {
    this._joystick.started    = true;
    this._joystick.active     = false;
    this._joystick.dir        = null;
    this._joystick.baseX      = lx;
    this._joystick.baseY      = ly;
    this._joystick.knobX      = lx;
    this._joystick.knobY      = ly;
    this._joystick.tapX       = lx;
    this._joystick.tapY       = ly;
    this._joystick.inGameArea = (ly >= LAYOUT.game.y && ly < LAYOUT.game.y + LAYOUT.game.h);
  }

  _handleTouchMove(lx, ly) {
    if (!this._joystick.started) return;
    if (this.dialog.active || this._inputLock || this.events.isRunning) return;
    if (!this._joystick.inGameArea) return;

    const dx   = lx - this._joystick.baseX;
    const dy   = ly - this._joystick.baseY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 24) {
      this._joystick.active = true;
      const ratio = Math.min(dist, 40) / dist;
      this._joystick.knobX = this._joystick.baseX + dx * ratio;
      this._joystick.knobY = this._joystick.baseY + dy * ratio;

      if (Math.abs(dx) > Math.abs(dy)) {
        this._joystick.dir = dx > 0 ? { dx: 1, dy: 0 } : { dx: -1, dy: 0 };
      } else {
        this._joystick.dir = dy > 0 ? { dx: 0, dy: 1 } : { dx: 0, dy: -1 };
      }
    }
  }

  _handleTouchEnd() {
    if (!this._joystick.started) return;
    const wasActive = this._joystick.active;
    const tapX = this._joystick.tapX;
    const tapY = this._joystick.tapY;
    this._joystick.active  = false;
    this._joystick.started = false;
    this._joystick.dir     = null;

    if (!wasActive) this._handleTap(tapX, tapY);
  }

  _handleTap(lx, ly) {
    // Advance dialog on tap anywhere
    if (this.dialog.active) {
      // If choices are shown, let player tap directly on a choice
      if (this.dialog.choices && this.dialog.done) {
        const choiceY = LAYOUT.msg.y + 20;
        const choiceH = 22;
        const bx = 120, bw = 120;
        if (lx >= bx && lx <= bx + bw && ly >= choiceY) {
          const idx = Math.floor((ly - choiceY - 10) / choiceH);
          if (idx >= 0 && idx < this.dialog.choices.length) {
            this.dialog.choiceIdx = idx;
          }
        }
      }
      if (!this.events.onConfirm()) this.dialog.confirm();
      return;
    }

    if (this._inputLock || this.events.isRunning) return;

    // Ctrl area — menu button
    if (ly >= LAYOUT.ctrl.y) {
      if (lx >= CANVAS_W - 96) {
        this.game.audio.playSfx('cursor');
        this.game.changeScene('menu', { returnTo: 'world' });
      }
      return;
    }

    if (ly >= LAYOUT.msg.y) return;

    // Game area
    if (ly >= LAYOUT.game.y && ly < LAYOUT.game.y + LAYOUT.game.h) {
      const { tileX, tileY } = this._screenToTile(lx, ly);

      // posEvent at tapped tile (stone tap, etc.) — triggers when adjacent
      const posEv = this.map.getEventAt(tileX, tileY);
      if (posEv && !this.events.flagSet(posEv.flag)) {
        const dist = Math.abs(tileX - this.player.tileX) + Math.abs(tileY - this.player.tileY);
        if (dist <= 2) {
          this.events.trigger(posEv.eventId);
          return;
        }
      }

      // NPC at tapped tile
      const npc = this.map.getNpcAt(tileX, tileY);
      if (npc) {
        const dist = Math.abs(tileX - this.player.tileX) + Math.abs(tileY - this.player.tileY);
        if (dist <= 2) {
          const npcEntity = this.npcs.find(n => n.id === npc.id);
          if (npcEntity) { this._talkToNpc(npcEntity); return; }
        }
      }

      // Tap to step in direction of tap
      const playerScreenX = this.player.px - this.map.camX;
      const playerScreenY = LAYOUT.game.y + this.player.py - this.map.camY;
      const dX = lx - playerScreenX;
      const dY = ly - playerScreenY;
      if (Math.abs(dX) < 12 && Math.abs(dY) < 12) return;

      let dx = 0, dy = 0;
      if (Math.abs(dX) > Math.abs(dY)) dx = dX > 0 ? 1 : -1;
      else dy = dY > 0 ? 1 : -1;

      if (!this.player.moving) {
        const tx = this.player.tileX + dx;
        const ty = this.player.tileY + dy;
        const adjNpc = this.map.getNpcAt(tx, ty);
        if (adjNpc) {
          this.player.dir = dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up';
          const npcEntity = this.npcs.find(n => n.id === adjNpc.id);
          if (npcEntity) { this._talkToNpc(npcEntity); return; }
        }
        this._prevPlayerTile = { x: this.player.tileX, y: this.player.tileY, dir: this.player.dir };
        this.player.tryMove(dx, dy, this.map);
      }
    }
  }

  _screenToTile(lx, ly) {
    const tileX = Math.floor((lx + this.map.camX) / TILE_SIZE);
    const tileY = Math.floor((ly - LAYOUT.game.y + this.map.camY) / TILE_SIZE);
    return { tileX, tileY };
  }

  _handleDialogInput() {
    if (!this.dialog.active) return;
    const inp = this.game.input;
    if (inp.isJust('up'))   this.dialog.selectChoice(-1);
    if (inp.isJust('down')) this.dialog.selectChoice(1);
    if (inp.isJust('a') || inp.isJust('b')) {
      if (!this.events.onConfirm()) this.dialog.confirm();
    }
  }

  _handleActionInput() {
    const inp = this.game.input;
    if (inp.isJust('a')) {
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

  _updateFollower(dt) {
    if (this.events.flagSet('ril_joined') && !this._follower) {
      this._follower = {
        px: this.player.px, py: this.player.py,
        targetPx: this.player.px, targetPy: this.player.py,
        dir: this.player.dir,
      };
    }
    if (!this._follower) return;
    const FOLLOW_SPEED = 5 * TILE_SIZE;
    const fdx = this._follower.targetPx - this._follower.px;
    const fdy = this._follower.targetPy - this._follower.py;
    const dist = Math.sqrt(fdx * fdx + fdy * fdy);
    if (dist > 0.5) {
      const step = FOLLOW_SPEED * dt;
      if (step >= dist) {
        this._follower.px = this._follower.targetPx;
        this._follower.py = this._follower.targetPy;
      } else {
        this._follower.px += (fdx / dist) * step;
        this._follower.py += (fdy / dist) * step;
      }
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

    if (this._follower && this._prevPlayerTile) {
      this._follower.targetPx = this._prevPlayerTile.x * TILE_SIZE;
      this._follower.targetPy = this._prevPlayerTile.y * TILE_SIZE;
      this._follower.dir = this._prevPlayerTile.dir;
    }

    const exit = this.map.getExit(tx, ty);
    if (exit) {
      this._inputLock = true;
      this.game.audio.playSfx('confirm');
      setTimeout(() => {
        this.teleport(exit.toMap, exit.toX, exit.toY, exit.dir);
      }, 100);
      return;
    }

    const posEv = this.map.getEventAt(tx, ty);
    if (posEv && !this.events.flagSet(posEv.flag)) {
      this.events.trigger(posEv.eventId);
      return;
    }

    if (this._encounterCooldown <= 0 && this.player.checkEncounter(this.map)) {
      this._startRandomBattle();
    }
  }

  _startRandomBattle() {
    const mapData = this.map.mapData;
    if (!mapData?.encounters?.length) return;
    const pool  = mapData.encounters;
    const entry = pool[Math.floor(Math.random() * pool.length)];
    this._encounterCooldown = 3;
    this.game.audio.playSfx('hit');
    this._inputLock = true;
    setTimeout(() => {
      this.game.changeScene('battle', { enemyId: entry.id, isBoss: false, onWin: null });
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
      if (this._follower) {
        this._follower.px = this.player.px;
        this._follower.py = this.player.py;
        this._follower.targetPx = this.player.px;
        this._follower.targetPy = this.player.py;
        this._follower.dir = toDir;
      }
      this._inputLock = false;
    });
  }

  flash(color, duration = 300) {
    this._flashColor    = color;
    this._flashDuration = duration / 1000;
    this._flashTimer    = this._flashDuration;
    this._flashAlpha    = 1;
  }

  blackoutIn(duration = 800) {
    this._blackoutFadeDir   = 1;
    this._blackoutFadeSpeed = 1 / (duration / 1000);
    this._blackoutFading    = true;
    this._blackoutAlpha     = 0;
  }

  blackoutOut(duration = 600) {
    this._blackoutFadeDir   = -1;
    this._blackoutFadeSpeed = 1 / (duration / 1000);
    this._blackoutFading    = true;
    this._blackoutAlpha     = 1;
  }

  shake(duration = 400, intensity = 5) {
    this._shakeDuration  = duration / 1000;
    this._shakeIntensity = intensity;
  }

  showNarration(lines) {
    this._narrationLines = Array.isArray(lines) ? lines : [];
  }

  startGlow(color = '#aaddff', duration = 3000) {
    this._glowColor    = color;
    this._glowDuration = duration / 1000;
    this._glowTimer    = duration / 1000;
  }

  playerFace(dir) {
    this.player.dir = dir;
  }

  npcFace(npcId, dir) {
    const npc = this.npcs.find(n => n.id === npcId);
    if (npc) npc.dir = dir;
  }

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
    // Map with screen shake
    ctx.save();
    if (this._shakeX !== 0 || this._shakeY !== 0) {
      ctx.translate(Math.round(this._shakeX), Math.round(this._shakeY));
    }
    const rilJoined = this.events.flagSet('ril_joined');
    const npcSprites = this.npcs
      .filter(n => !(rilJoined && n.id === 'ril'))
      .map(n => ({ x: n.x, y: n.y, sprite: n.sprite, id: n.id, dir: n.dir }));
    const followerSprite = (rilJoined && this._follower) ? this._follower : null;
    this.map.render(ctx, npcSprites, this.player.spriteInfo, followerSprite);
    ctx.restore();

    // Atmospheric glow over game area
    if (this._glowAlpha > 0 && this._glowColor) {
      ctx.globalAlpha = this._glowAlpha;
      ctx.fillStyle = this._glowColor;
      ctx.fillRect(0, LAYOUT.game.y, CANVAS_W, LAYOUT.game.h);
      ctx.globalAlpha = 1;
    }

    this._drawStatus(ctx);
    this._drawMenuBtn(ctx);

    if (this._joystick.active) this._drawJoystick(ctx);

    // Flash overlay
    if (this._flashTimer > 0 && this._flashColor) {
      ctx.globalAlpha = this._flashAlpha * 0.7;
      ctx.fillStyle = this._flashColor;
      ctx.fillRect(0, 0, CANVAS_W, LAYOUT.game.h + LAYOUT.game.y);
      ctx.globalAlpha = 1;
    }

    // Blackout over full screen — dialog renders on top
    if (this._blackoutAlpha > 0) {
      ctx.globalAlpha = this._blackoutAlpha;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.globalAlpha = 1;
    }

    // Narration text on blackout screen
    if (this._narrationLines.length > 0 && this._blackoutAlpha > 0.05) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '13px monospace';
      const lineH = 26;
      const startY = CANVAS_H / 2 - (this._narrationLines.length * lineH) / 2 + 10;
      this._narrationLines.forEach((line, i) => {
        ctx.globalAlpha = this._blackoutAlpha * 0.92;
        ctx.fillStyle = '#b8ccee';
        ctx.fillText(line, CANVAS_W / 2, startY + i * lineH);
      });
      ctx.restore();
    }

    // Dialog always on top
    this.dialog.render(ctx);
  }

  _drawJoystick(ctx) {
    const { baseX, baseY, knobX, knobY } = this._joystick;

    ctx.globalAlpha = 0.28;
    ctx.fillStyle   = '#c8e0ff';
    ctx.beginPath();
    ctx.arc(baseX, baseY, 42, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = '#aaddff';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(baseX, baseY, 42, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.78;
    ctx.fillStyle   = '#aaddff';
    ctx.beginPath();
    ctx.arc(knobX, knobY, 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
  }

  _drawStatus(ctx) {
    const { x, y, w, h } = LAYOUT.status;
    ctx.fillStyle = 'rgba(8, 10, 28, 0.92)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth   = 1;
    ctx.strokeRect(x, y, w, h);

    const party = [...this.game.state.party, ...this.game.state.monsters];
    let ox = 10;
    for (const member of party.slice(0, 2)) {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(member.name, ox, y + 14);
      const barW    = 70;
      const hpRatio = Math.max(0, member.hp / member.maxHp);
      ctx.fillStyle = '#1a2040';
      ctx.fillRect(ox, y + 20, barW, 8);
      ctx.fillStyle = hpRatio > 0.3 ? COLORS.hp : COLORS.hpLow;
      ctx.fillRect(ox, y + 20, Math.floor(barW * hpRatio), 8);
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth   = 1;
      ctx.strokeRect(ox, y + 20, barW, 8);
      ctx.fillStyle = COLORS.text;
      ctx.font = '10px monospace';
      ctx.fillText(`${member.hp}/${member.maxHp}`, ox, y + 40);
      ox += 90;
    }

    const mapName = this.map.mapData?.name || '';
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(mapName, CANVAS_W - 8, y + 14);
  }

  _drawMenuBtn(ctx) {
    const { y, w, h } = LAYOUT.ctrl;

    ctx.fillStyle = 'rgba(4, 6, 18, 0.88)';
    ctx.fillRect(0, y, w, h);
    ctx.strokeStyle = '#151a2e';
    ctx.lineWidth   = 1;
    ctx.strokeRect(0, y, w, 1);

    const bx = w - 96, by = y + 16, bw = 86, bh = 48;
    ctx.fillStyle = '#12183a';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#2a3a60';
    ctx.lineWidth   = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('☰ メニュー', bx + bw / 2, by + 20);
    ctx.fillStyle = '#1e2a44';
    ctx.font = '9px monospace';
    ctx.fillText('[M / Esc]', bx + bw / 2, by + 38);

    ctx.fillStyle = '#1e2840';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('スライド: 移動  タップ: 話す/石', 10, y + h / 2 + 4);
  }
}
