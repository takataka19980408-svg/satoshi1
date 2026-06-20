import { Scene } from '../engine/Scene.js';
import { CANVAS_W, CANVAS_H, LAYOUT, COLORS } from '../constants.js';
import { BattleSystem } from '../systems/BattleSystem.js';

const ST = {
  ENEMY_INTRO: 'enemy_intro',
  SELECT_CMD:  'select_cmd',
  SELECT_SKILL:'select_skill',
  PLAYER_ATK:  'player_atk',
  ENEMY_ATK:   'enemy_atk',
  ANIM:        'anim',
  RESULT:      'result',
  WIN:         'win',
  LOSE:        'lose',
  RUN:         'run',
};

export class BattleScene extends Scene {
  constructor(game) {
    super(game);
    this.sys = new BattleSystem(game);
    this._state     = ST.ENEMY_INTRO;
    this._enemy     = null;
    this._party     = [];
    this._msg       = '';
    this._msgQueue  = [];
    this._msgTimer  = 0;
    this._cursor    = 0;
    this._isBoss    = false;
    this._onWin     = null;
    this._animTimer = 0;
    this._shake     = 0;
    this._inputLock = false;
    this._expGained = 0;
    this._goldGained= 0;
    this._levelUps  = [];
    this._blinkTimer= 0;
    this._enemyHp   = 0;
    this._enemyShake= 0;
    this._skillMenu = false;
    this._tapHandler = null;
  }

  enter({ enemyId, isBoss = false, onWin = null } = {}) {
    const enemyData = this.game.loader.get('data/enemies/enemies.json');
    const raw = enemyData?.[enemyId];
    if (!raw) {
      this.game.changeScene('world');
      return;
    }

    this._enemy = {
      ...raw,
      hp:    raw.hp,
      mp:    raw.mp || 0,
      maxHp: raw.hp,
      maxMp: raw.mp || 0,
    };
    this._party = [
      ...this.game.state.party.map(m => ({ ...m })),
      ...this.game.state.monsters.map(m => ({ ...m })),
    ];
    this._isBoss    = isBoss;
    this._onWin     = onWin;
    this._state     = ST.ENEMY_INTRO;
    this._cursor    = 0;
    this._msgQueue  = [];
    this._inputLock = true;
    this._skillMenu = false;
    this._expGained = 0;
    this._goldGained= 0;
    this._levelUps  = [];
    this._enemyHp   = raw.hp;
    this._enemyShake= 0;
    this._shake     = 0;

    const bgm = isBoss ? 'boss' : 'battle';
    this.game.audio.playBgm(bgm);

    this._tapHandler = (e) => {
      if (e.type === 'touchstart') e.preventDefault();
      const src  = e.changedTouches ? e.changedTouches[0] : e;
      const rect = this.game.canvas.getBoundingClientRect();
      const lx   = (src.clientX - rect.left) / this.game.scale;
      const ly   = (src.clientY - rect.top)  / this.game.scale;
      this._handleBattleTap(lx, ly);
    };
    this.game.canvas.addEventListener('touchstart', this._tapHandler, { passive: false });
    this.game.canvas.addEventListener('mousedown',  this._tapHandler);

    this._pushMsg(`${this._enemy.name}があらわれた！`, () => {
      this._state     = ST.SELECT_CMD;
      this._inputLock = false;
    });
  }

  exit() {
    if (this._tapHandler) {
      this.game.canvas.removeEventListener('touchstart', this._tapHandler);
      this.game.canvas.removeEventListener('mousedown',  this._tapHandler);
      this._tapHandler = null;
    }
  }

  _handleBattleTap(lx, ly) {
    // メッセージをタップでスキップ
    if (this._msgTimer > 0) {
      this._msgTimer = 0;
      const done = this._msgQueue.shift();
      if (done?.onDone) done.onDone();
      if (this._msgQueue.length > 0) this._showNextMsg();
      else this._inputLock = false;
      return;
    }
    if (this._inputLock) return;

    // 勝利・敗北画面でタップしてつづける
    if (this._state === ST.WIN)  { this._finishBattle(true);  return; }
    if (this._state === ST.LOSE) { this._finishBattle(false); return; }

    // コマンドメニュー タップ選択
    if (this._state === ST.SELECT_CMD) {
      const cw = 330, ch = 100;
      const cx = CANVAS_W / 2 - cw / 2;
      const my = 400;
      if (lx >= cx && lx <= cx + cw && ly >= my && ly <= my + ch) {
        const col = lx >= cx + cw / 2 ? 1 : 0;
        const row = ly >= my + ch / 2  ? 1 : 0;
        this._cursor = row * 2 + col;
        this.game.audio.playSfx('confirm');
        switch (this._cursor) {
          case 0: this._doPlayerAttack(); break;
          case 1: this._openSkillMenu();  break;
          case 2: this._doItem();         break;
          case 3: this._doRun();          break;
        }
        this._cursor = 0;
      }
      return;
    }

    // スキルメニュー タップでキャンセル
    if (this._state === ST.SELECT_SKILL) {
      this._skillMenu = false;
      this._state = ST.SELECT_CMD;
      this._cursor = 0;
      this.game.audio.playSfx('cancel');
    }
  }

  _pushMsg(text, onDone = null) {
    this._msgQueue.push({ text, onDone });
    if (this._msgQueue.length === 1) this._showNextMsg();
  }

  _showNextMsg() {
    if (!this._msgQueue.length) return;
    const item = this._msgQueue[0];
    this._msg      = item.text;
    this._msgTimer = 1.5;
    this._inputLock = true;
  }

  update(dt) {
    this._blinkTimer += dt;
    if (this._enemyShake > 0) this._enemyShake -= dt * 10;
    if (this._shake > 0)      this._shake      -= dt * 10;

    // メッセージキュー処理
    if (this._msgTimer > 0) {
      this._msgTimer -= dt;
      if (this.game.input.isJust('a') || this.game.input.isJust('b')) {
        this._msgTimer = 0;
      }
      if (this._msgTimer <= 0) {
        const done = this._msgQueue.shift();
        if (done?.onDone) done.onDone();
        if (this._msgQueue.length > 0) this._showNextMsg();
        else this._inputLock = false;
      }
      return;
    }

    if (this._inputLock) return;

    switch (this._state) {
      case ST.SELECT_CMD:  this._updateSelectCmd(dt);  break;
      case ST.SELECT_SKILL:this._updateSelectSkill(dt);break;
      case ST.WIN:         this._updateWin(dt);        break;
      case ST.LOSE:        this._updateLose(dt);       break;
    }
  }

  _updateSelectCmd(dt) {
    const inp = this.game.input;
    const CMDS = this._skillMenu ? [] : ['たたかう', 'スキル', 'アイテム', 'にげる'];
    const maxCursor = CMDS.length - 1;

    if (inp.isJust('up'))    { this._cursor = Math.max(0, this._cursor - 1); this.game.audio.playSfx('cursor'); }
    if (inp.isJust('down'))  { this._cursor = Math.min(maxCursor, this._cursor + 1); this.game.audio.playSfx('cursor'); }

    if (inp.isJust('a')) {
      this.game.audio.playSfx('confirm');
      switch (this._cursor) {
        case 0: this._doPlayerAttack(); break;
        case 1: this._openSkillMenu();  break;
        case 2: this._doItem();         break;
        case 3: this._doRun();          break;
      }
      this._cursor = 0;
    }
    if (inp.isJust('b')) {
      this.game.audio.playSfx('cancel');
    }
  }

  _updateSelectSkill(dt) {
    const inp = this.game.input;
    const skills = this._party[0]?.skills || [];
    if (inp.isJust('up'))   { this._cursor = Math.max(0, this._cursor - 1); this.game.audio.playSfx('cursor'); }
    if (inp.isJust('down')) { this._cursor = Math.min(skills.length, this._cursor + 1); this.game.audio.playSfx('cursor'); }
    if (inp.isJust('b'))    { this._skillMenu = false; this._state = ST.SELECT_CMD; this._cursor = 0; }
    if (inp.isJust('a')) {
      if (this._cursor === skills.length) {
        this._skillMenu = false; this._state = ST.SELECT_CMD; this._cursor = 0;
      } else {
        this._doSkill(skills[this._cursor]);
      }
    }
  }

  _updateWin(dt) {
    if (this.game.input.isJust('a') || this.game.input.isJust('b')) {
      this._finishBattle(true);
    }
  }

  _updateLose(dt) {
    if (this.game.input.isJust('a') || this.game.input.isJust('b')) {
      this._finishBattle(false);
    }
  }

  _doPlayerAttack() {
    const attacker = this._party[0];
    const dmg = this.sys.calcDamageSimple(attacker.atk, this._enemy.def);
    this._enemy.hp = Math.max(0, this._enemy.hp - dmg);
    this._enemyShake = 0.3;
    this.game.audio.playSfx('hit');
    this._pushMsg(`サトシの攻撃！\n${this._enemy.name}に${dmg}のダメージ！`, () => {
      if (this._enemy.hp <= 0) this._winBattle();
      else this._doEnemyAction();
    });
  }

  _openSkillMenu() {
    const skills = this._party[0]?.skills || [];
    if (!skills.length) {
      this._pushMsg('つかえるスキルがない。');
      return;
    }
    this._skillMenu = true;
    this._state     = ST.SELECT_SKILL;
    this._cursor    = 0;
  }

  _doSkill(skillId) {
    const skillData = this.game.loader.get('data/items/items.json')?.skills?.[skillId];
    if (!skillData) {
      this._pushMsg('そのスキルはつかえない。');
      return;
    }
    const member = this._party[0];
    if (member.mp < skillData.mp) {
      this._pushMsg('MPが足りない！');
      return;
    }
    member.mp -= skillData.mp;
    const dmg = this.sys.calcDamageSimple(member.atk * skillData.power, this._enemy.def);
    this._enemy.hp = Math.max(0, this._enemy.hp - dmg);
    this._enemyShake = 0.4;
    this.game.audio.playSfx('magic');
    this._skillMenu = false;
    this._state = ST.SELECT_CMD;
    this._pushMsg(`${skillData.name}！\n${this._enemy.name}に${dmg}のダメージ！`, () => {
      if (this._enemy.hp <= 0) this._winBattle();
      else this._doEnemyAction();
    });
  }

  _doItem() {
    const herbs = this.game.state.inventory.find(i => i.id === 'herb');
    if (!herbs || herbs.count <= 0) {
      this._pushMsg('アイテムがない。');
      return;
    }
    herbs.count--;
    if (herbs.count <= 0) {
      this.game.state.inventory = this.game.state.inventory.filter(i => i.id !== 'herb' || i.count > 0);
    }
    const healed = 20 + Math.floor(Math.random() * 10);
    const member = this._party[0];
    member.hp = Math.min(member.maxHp, member.hp + healed);
    // game stateにも反映
    this.game.state.party[0].hp = member.hp;
    this.game.audio.playSfx('item');
    this._pushMsg(`やくそうを使った！\nHPが${healed}回復した！`, () => {
      this._doEnemyAction();
    });
  }

  _doRun() {
    const chance = 0.6 + (this._isBoss ? -0.6 : 0);
    if (Math.random() < chance) {
      this.game.audio.playSfx('confirm');
      this._pushMsg('うまくにげられた！', () => {
        this._finishBattle(false, true);
      });
    } else {
      this._pushMsg('にげられなかった！', () => {
        this._doEnemyAction();
      });
    }
  }

  _doEnemyAction() {
    if (this._enemy.hp <= 0) return;
    const action = this.sys.enemyAction(this._enemy, this._party);
    const target = this._party[0];
    const dmg    = this.sys.calcDamageSimple(this._enemy.atk, target.def);
    target.hp    = Math.max(0, target.hp - dmg);
    this._shake  = 0.3;
    this.game.audio.playSfx('damage');
    // game stateに反映
    const stateParty = [...this.game.state.party, ...this.game.state.monsters];
    stateParty[0].hp = target.hp;

    this._pushMsg(`${this._enemy.name}のこうげき！\n${target.name}に${dmg}のダメージ！`, () => {
      if (target.hp <= 0) this._loseBattle();
      else {
        this._state = ST.SELECT_CMD;
        this._inputLock = false;
      }
    });
  }

  _winBattle() {
    const rewards = this.sys.getBattleRewards(this._enemy);
    this._expGained  = rewards.exp;
    this._goldGained = rewards.gold;
    this.game.audio.playSfx('victory');

    // 経験値分配
    this._party.forEach((m, i) => {
      const stateMember = i < this.game.state.party.length
        ? this.game.state.party[i]
        : this.game.state.monsters[i - this.game.state.party.length];
      if (!stateMember) return;
      stateMember.exp = (stateMember.exp || 0) + rewards.exp;
      const newLv = this.sys.checkLevelUp(stateMember);
      if (newLv) {
        this.sys.applyLevelUp(stateMember, newLv);
        this._levelUps.push({ name: stateMember.name, level: newLv });
      }
      // バトル中メンバーにも反映
      m.hp = stateMember.hp;
    });

    this._pushMsg(`${this._enemy.name}をたおした！\n${rewards.exp}けいけんち\n${rewards.gold}G かくとく！`, () => {
      if (this._levelUps.length > 0) {
        const lu = this._levelUps.shift();
        this._pushMsg(`${lu.name}はレベル${lu.level}にあがった！`, () => {
          this._state = ST.WIN;
          this._inputLock = false;
        });
      } else {
        this._state = ST.WIN;
        this._inputLock = false;
      }
    });
  }

  _loseBattle() {
    this.game.audio.playSfx('cancel');
    this._pushMsg('目の前が暗くなった……', () => {
      this._state = ST.LOSE;
      this._inputLock = false;
    });
  }

  _finishBattle(won, ran = false) {
    const world = this.game._scenes?.world;
    const onWin = this._onWin;
    if (won || ran) {
      this.game.changeScene('world');
      if (world) world.returnFromBattle(won, onWin);
    } else {
      // 全滅 → HP全回復してサトシの家へ
      this.game.state.party.forEach(m => { m.hp = m.maxHp; m.mp = m.maxMp || 0; });
      this.game.state.monsters.forEach(m => { m.hp = m.maxHp; m.mp = m.maxMp || 0; });
      this.game.state.currentMap = 'satoshi_house';
      this.game.state.playerX   = 6;
      this.game.state.playerY   = 7;
      const world = this.game._scenes?.world;
      this.game.changeScene('world', { map: 'satoshi_house', x: 6, y: 7 });
      if (world) world._encounterCooldown = 4;
    }
  }

  render(ctx) {
    // 背景
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#07091e');
    grad.addColorStop(1, '#12082a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // 星背景
    this._drawBattleBg(ctx);

    // 敵
    this._drawEnemy(ctx);

    // 味方ステータス
    this._drawPartyStatus(ctx);

    // コマンドメニュー
    if (this._state === ST.SELECT_CMD) this._drawCommandMenu(ctx);
    if (this._state === ST.SELECT_SKILL) this._drawSkillMenu(ctx);

    // メッセージ
    this._drawBattleMsg(ctx);

    // WIN/LOSE
    if (this._state === ST.WIN)  this._drawWinScreen(ctx);
    if (this._state === ST.LOSE) this._drawLoseScreen(ctx);
  }

  _drawBattleBg(ctx) {
    // 地平線
    ctx.fillStyle = '#0e0e28';
    ctx.fillRect(0, 260, CANVAS_W, 60);
    ctx.fillStyle = '#181830';
    ctx.fillRect(0, 280, CANVAS_W, 40);
    // 星
    for (let i = 0; i < 30; i++) {
      const x = (i * 37 + 10) % CANVAS_W;
      const y = (i * 23 + 5)  % 200;
      const alpha = 0.3 + 0.7 * Math.abs(Math.sin(this._blinkTimer * 0.5 + i));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#aabbff';
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  _drawEnemy(ctx) {
    if (!this._enemy) return;
    const ex = CANVAS_W / 2 + (this._enemyShake > 0 ? (Math.random() - 0.5) * 8 : 0);
    const ey = 130;
    const hpRatio = this._enemy.hp / this._enemy.maxHp;

    // 敵スプライト（仮素材）
    this._drawEnemySprite(ctx, ex - 40, ey - 48, this._enemy.id, hpRatio);

    // 敵名とHP
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 13px monospace';
    ctx.fillText(this._enemy.name, ex, ey + 50);

    // HPバー
    const bw = 80;
    const bx = ex - bw / 2;
    const by = ey + 56;
    ctx.fillStyle = '#1a1030';
    ctx.fillRect(bx, by, bw, 8);
    ctx.fillStyle = hpRatio > 0.3 ? '#cc4422' : '#992211';
    ctx.fillRect(bx, by, Math.floor(bw * hpRatio), 8);
    ctx.strokeStyle = '#3a2050';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, 8);
  }

  _drawEnemySprite(ctx, x, y, id, hpRatio) {
    const flicker = hpRatio < 0.2 && Math.sin(this._blinkTimer * 10) > 0;
    ctx.globalAlpha = flicker ? 0.5 : 1;

    switch (id) {
      case 'forest_slime': {
        // モリプニ — 丸くてぷよぷよした緑スライム
        const b = 0.85 + 0.15 * Math.sin(this._blinkTimer * 3);
        const cx2 = x + 40, cy2 = y + 38;
        // 体（楕円形に見せる多段描画）
        ctx.fillStyle = `rgba(28,${Math.floor(130*b)},28,1)`;
        ctx.fillRect(cx2-28, cy2-22, 56, 30);
        ctx.fillRect(cx2-22, cy2-30, 44, 16);
        ctx.fillRect(cx2-14, cy2-36, 28, 10);
        // ハイライト（体の上部）
        ctx.fillStyle = `rgba(48,${Math.floor(190*b)},48,1)`;
        ctx.fillRect(cx2-20, cy2-28, 32, 8);
        ctx.fillRect(cx2-12, cy2-34, 18, 6);
        // つや（光沢）
        ctx.fillStyle = 'rgba(120,220,120,0.5)';
        ctx.fillRect(cx2-12, cy2-30, 10, 6);
        ctx.fillStyle = 'rgba(200,255,200,0.4)';
        ctx.fillRect(cx2-8, cy2-28, 5, 3);
        // 触角
        ctx.fillStyle = '#1a5520';
        ctx.fillRect(cx2-10, cy2-38, 3, 6);
        ctx.fillRect(cx2+7,  cy2-38, 3, 6);
        ctx.fillRect(cx2-12, cy2-40, 5, 3);
        ctx.fillRect(cx2+6,  cy2-40, 5, 3);
        // 目
        ctx.fillStyle = '#0a1808';
        ctx.fillRect(cx2-12, cy2-20, 8, 8);
        ctx.fillRect(cx2+4,  cy2-20, 8, 8);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx2-11, cy2-20, 3, 3);
        ctx.fillRect(cx2+5,  cy2-20, 3, 3);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(cx2-9,  cy2-18, 2, 2);
        ctx.fillRect(cx2+7,  cy2-18, 2, 2);
        // 口
        ctx.fillStyle = '#0a2808';
        ctx.fillRect(cx2-6, cy2-10, 12, 3);
        ctx.fillStyle = '#1a4812';
        ctx.fillRect(cx2-4, cy2-9, 8, 1);
        // 底面の影
        ctx.fillStyle = 'rgba(0,40,0,0.4)';
        ctx.fillRect(cx2-26, cy2+6, 52, 4);
        break;
      }
      case 'dark_moth': {
        // ヤミコガネ — 闇の蛾
        const bf = 0.7 + 0.3 * Math.sin(this._blinkTimer * 6);
        const cx3 = x + 40, cy3 = y + 36;
        // 羽（広げた状態、左右対称）
        // 上羽
        ctx.fillStyle = `rgba(${Math.floor(40*bf)},${Math.floor(30*bf)},${Math.floor(70*bf)},0.9)`;
        ctx.fillRect(cx3-36, cy3-30, 28, 22);
        ctx.fillRect(cx3+8,  cy3-30, 28, 22);
        ctx.fillRect(cx3-42, cy3-18, 10, 14);
        ctx.fillRect(cx3+32, cy3-18, 10, 14);
        // 下羽
        ctx.fillStyle = `rgba(${Math.floor(50*bf)},${Math.floor(38*bf)},${Math.floor(85*bf)},0.9)`;
        ctx.fillRect(cx3-28, cy3-10, 22, 18);
        ctx.fillRect(cx3+6,  cy3-10, 22, 18);
        // 羽の模様（光る紋様）
        ctx.fillStyle = `rgba(140,80,220,${0.4 * bf})`;
        ctx.fillRect(cx3-30, cy3-26, 10, 6);
        ctx.fillRect(cx3+20, cy3-26, 10, 6);
        ctx.fillStyle = `rgba(180,100,255,${0.3 * bf})`;
        ctx.fillRect(cx3-26, cy3-22, 5, 3);
        ctx.fillRect(cx3+21, cy3-22, 5, 3);
        // 羽の縁取り（暗い）
        ctx.fillStyle = '#180c28';
        ctx.fillRect(cx3-36, cy3-30, 2, 22);
        ctx.fillRect(cx3+34, cy3-30, 2, 22);
        // 胴体
        ctx.fillStyle = '#2a1840';
        ctx.fillRect(cx3-6, cy3-32, 12, 30);
        ctx.fillStyle = '#3e2860';
        ctx.fillRect(cx3-4, cy3-30, 8, 26);
        // 体の節（縞）
        ctx.fillStyle = '#1a1030';
        ctx.fillRect(cx3-4, cy3-22, 8, 2);
        ctx.fillRect(cx3-4, cy3-14, 8, 2);
        ctx.fillRect(cx3-4, cy3-6,  8, 2);
        // 頭
        ctx.fillStyle = '#1e1030';
        ctx.fillRect(cx3-5, cy3-36, 10, 8);
        // 複眼
        ctx.fillStyle = '#c03060';
        ctx.fillRect(cx3-5, cy3-35, 4, 4);
        ctx.fillRect(cx3+1, cy3-35, 4, 4);
        ctx.fillStyle = '#ff60a0';
        ctx.fillRect(cx3-4, cy3-35, 2, 2);
        ctx.fillRect(cx3+2, cy3-35, 2, 2);
        // 触角
        ctx.fillStyle = '#3a2050';
        ctx.fillRect(cx3-4, cy3-44, 2, 10);
        ctx.fillRect(cx3+2, cy3-44, 2, 10);
        ctx.fillRect(cx3-7, cy3-46, 5, 3);
        ctx.fillRect(cx3+2, cy3-46, 5, 3);
        break;
      }
      case 'stone_imp': {
        // イシカゲ — 石の精
        const bs = 0.9 + 0.1 * Math.sin(this._blinkTimer * 1.5);
        const cx4 = x + 40, cy4 = y + 44;
        // 影
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(cx4-20, cy4+2, 40, 5);
        // 体（岩のような不規則な形）
        ctx.fillStyle = '#4a4860';
        ctx.fillRect(cx4-18, cy4-36, 36, 38);
        ctx.fillRect(cx4-22, cy4-28, 44, 24);
        ctx.fillRect(cx4-14, cy4-42, 28, 10);
        // 石の陰影（暗い部分）
        ctx.fillStyle = '#28263a';
        ctx.fillRect(cx4+14, cy4-36, 6, 38);
        ctx.fillRect(cx4-22, cy4-10, 44, 8);
        // 石の明るい部分（ハイライト）
        ctx.fillStyle = '#6a68a0';
        ctx.fillRect(cx4-14, cy4-40, 16, 8);
        ctx.fillRect(cx4-18, cy4-32, 12, 10);
        // 石の模様（亀裂）
        ctx.fillStyle = '#1a1828';
        ctx.fillRect(cx4-4, cy4-36, 2, 16);
        ctx.fillRect(cx4+6, cy4-28, 2, 20);
        ctx.fillRect(cx4-12, cy4-20, 14, 2);
        // 光る目（石の精の証）
        const eyeGlow = 0.8 + 0.2 * Math.sin(this._blinkTimer * 2);
        ctx.fillStyle = `rgba(180,220,255,${eyeGlow})`;
        ctx.fillRect(cx4-10, cy4-26, 8, 8);
        ctx.fillRect(cx4+2,  cy4-26, 8, 8);
        ctx.fillStyle = `rgba(220,240,255,${eyeGlow})`;
        ctx.fillRect(cx4-8,  cy4-25, 4, 4);
        ctx.fillRect(cx4+4,  cy4-25, 4, 4);
        // 口（岩の割れ目）
        ctx.fillStyle = '#0e0c18';
        ctx.fillRect(cx4-8, cy4-12, 16, 4);
        ctx.fillStyle = '#28263a';
        ctx.fillRect(cx4-6, cy4-11, 12, 2);
        // 腕（岩の突起）
        ctx.fillStyle = '#4a4860';
        ctx.fillRect(cx4-30, cy4-24, 14, 10);
        ctx.fillRect(cx4+16, cy4-24, 14, 10);
        ctx.fillStyle = '#28263a';
        ctx.fillRect(cx4-18, cy4-22, 2, 8);
        ctx.fillRect(cx4+28, cy4-22, 2, 8);
        break;
      }
      case 'puni_king': {
        // 暴走プニキング — 大型ボス
        const bk = 0.85 + 0.15 * Math.sin(this._blinkTimer * 2);
        const cx5 = x + 40, cy5 = y + 38;
        // 体（巨大）
        ctx.fillStyle = `rgba(${Math.floor(110*bk)},18,${Math.floor(160*bk)},1)`;
        ctx.fillRect(cx5-36, cy5-26, 72, 42);
        ctx.fillRect(cx5-28, cy5-40, 56, 20);
        ctx.fillRect(cx5-18, cy5-48, 36, 14);
        // ハイライト
        ctx.fillStyle = `rgba(${Math.floor(160*bk)},28,${Math.floor(220*bk)},1)`;
        ctx.fillRect(cx5-22, cy5-38, 28, 10);
        ctx.fillRect(cx5-14, cy5-46, 18, 8);
        // つや
        ctx.fillStyle = `rgba(200,100,255,${0.35*bk})`;
        ctx.fillRect(cx5-10, cy5-42, 8, 6);
        // 王冠
        ctx.fillStyle = '#d4b010';
        ctx.fillRect(cx5-22, cy5-54, 44, 10);
        ctx.fillStyle = '#f0cc20';
        ctx.fillRect(cx5-20, cy5-54, 40, 5);
        // 王冠の突起（3本）
        ctx.fillStyle = '#d4b010';
        ctx.fillRect(cx5-22, cy5-64, 10, 12);
        ctx.fillRect(cx5-5,  cy5-68, 10, 14);
        ctx.fillRect(cx5+12, cy5-64, 10, 12);
        // 突起の宝石
        ctx.fillStyle = '#ff2060';
        ctx.fillRect(cx5-20, cy5-66, 6, 6);
        ctx.fillRect(cx5-3,  cy5-70, 6, 6);
        ctx.fillRect(cx5+14, cy5-66, 6, 6);
        ctx.fillStyle = '#ff80a0';
        ctx.fillRect(cx5-19, cy5-65, 3, 3);
        ctx.fillRect(cx5-2,  cy5-69, 3, 3);
        ctx.fillRect(cx5+15, cy5-65, 3, 3);
        // 目（狂った光）
        const eg = 0.8 + 0.2 * Math.sin(this._blinkTimer * 8);
        ctx.fillStyle = `rgba(255,20,80,${eg})`;
        ctx.fillRect(cx5-18, cy5-22, 14, 14);
        ctx.fillRect(cx5+4,  cy5-22, 14, 14);
        ctx.fillStyle = `rgba(255,120,160,${eg})`;
        ctx.fillRect(cx5-15, cy5-20, 6, 6);
        ctx.fillRect(cx5+7,  cy5-20, 6, 6);
        ctx.fillStyle = `rgba(255,220,240,${eg * 0.8})`;
        ctx.fillRect(cx5-13, cy5-19, 2, 2);
        ctx.fillRect(cx5+9,  cy5-19, 2, 2);
        // 口（ニタリ）
        ctx.fillStyle = '#200818';
        ctx.fillRect(cx5-16, cy5-4, 32, 6);
        ctx.fillStyle = '#f0a000';
        // 歯
        for (let t = 0; t < 4; t++) {
          ctx.fillRect(cx5-14+t*8, cy5-4, 4, 5);
        }
        break;
      }
      default: {
        // 汎用敵
        const cxD = x + 40, cyD = y + 40;
        ctx.fillStyle = '#7a3818';
        ctx.fillRect(cxD-20, cyD-30, 40, 36);
        ctx.fillStyle = '#9a5230';
        ctx.fillRect(cxD-16, cyD-26, 32, 28);
        ctx.fillStyle = '#0a0808';
        ctx.fillRect(cxD-10, cyD-18, 7, 7);
        ctx.fillRect(cxD+3,  cyD-18, 7, 7);
        ctx.fillStyle = '#ff3020';
        ctx.fillRect(cxD-8, cyD-16, 4, 4);
        ctx.fillRect(cxD+5, cyD-16, 4, 4);
      }
    }
    ctx.globalAlpha = 1;
  }

  _drawPartyStatus(ctx) {
    const sy = 310;
    ctx.fillStyle = 'rgba(8, 10, 28, 0.88)';
    ctx.fillRect(8, sy, CANVAS_W - 16, 70);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(8, sy, CANVAS_W - 16, 70);

    this._party.forEach((m, i) => {
      const ox = 20 + i * 160;
      ctx.fillStyle = COLORS.accent;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(m.name, ox, sy + 18);
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '11px monospace';
      ctx.fillText(`HP`, ox, sy + 36);
      const bw = 90;
      const ratio = Math.max(0, m.hp / m.maxHp);
      ctx.fillStyle = '#1a2040';
      ctx.fillRect(ox + 22, sy + 26, bw, 8);
      ctx.fillStyle = ratio > 0.3 ? COLORS.hp : COLORS.hpLow;
      ctx.fillRect(ox + 22, sy + 26, Math.floor(bw * ratio), 8);
      ctx.strokeStyle = COLORS.border;
      ctx.strokeRect(ox + 22, sy + 26, bw, 8);
      ctx.fillStyle = COLORS.text;
      ctx.fillText(`${m.hp}/${m.maxHp}`, ox + 22, sy + 50);
      if (m.maxMp > 0) {
        ctx.fillStyle = COLORS.textDim;
        ctx.fillText(`MP ${m.mp}/${m.maxMp}`, ox + 22, sy + 64);
      }
    });
  }

  _drawCommandMenu(ctx) {
    const cmds = ['たたかう', 'スキル', 'アイテム', 'にげる'];
    const mx = CANVAS_W / 2;
    const my = 400;
    const cw = 330, ch = 100;
    const cx = mx - cw / 2;

    ctx.fillStyle = 'rgba(8, 10, 28, 0.95)';
    ctx.fillRect(cx, my, cw, ch);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(cx, my, cw, ch);

    for (let i = 0; i < 4; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const tx  = cx + 20 + col * 160;
      const ty  = my + 28 + row * 36;
      const sel = i === this._cursor;
      if (sel) {
        ctx.fillStyle = COLORS.accent;
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('▶', tx - 14, ty);
      }
      ctx.fillStyle = sel ? COLORS.accent : COLORS.text;
      ctx.font = `${sel ? 'bold ' : ''}14px monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(cmds[i], tx, ty);
    }
  }

  _drawSkillMenu(ctx) {
    const skills = this._party[0]?.skills || [];
    const mx = 30, my = 400;
    const cw = 300, ch = (skills.length + 1) * 26 + 20;

    ctx.fillStyle = 'rgba(8, 10, 28, 0.97)';
    ctx.fillRect(mx, my, cw, ch);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(mx, my, cw, ch);

    ctx.fillStyle = COLORS.accent;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('スキル', mx + 12, my + 16);

    skills.forEach((s, i) => {
      const ty = my + 30 + i * 26;
      const sel = i === this._cursor;
      if (sel) { ctx.fillStyle = COLORS.accent; ctx.fillText('▶', mx + 10, ty); }
      ctx.fillStyle = sel ? COLORS.accent : COLORS.text;
      ctx.font = '13px monospace';
      ctx.fillText(s, mx + 24, ty);
    });

    // 戻る
    const retY = my + 30 + skills.length * 26;
    const retSel = this._cursor === skills.length;
    if (retSel) { ctx.fillStyle = COLORS.accent; ctx.fillText('▶', mx + 10, retY); }
    ctx.fillStyle = retSel ? COLORS.accent : COLORS.textDim;
    ctx.fillText('もどる', mx + 24, retY);
  }

  _drawBattleMsg(ctx) {
    if (this._msgTimer <= 0) return;
    const my = 390;
    ctx.fillStyle = 'rgba(6, 8, 22, 0.95)';
    ctx.fillRect(8, my, CANVAS_W - 16, 80);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(8, my, CANVAS_W - 16, 80);
    ctx.fillStyle = COLORS.text;
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    const lines = this._msg.split('\n');
    lines.forEach((l, i) => ctx.fillText(l, 22, my + 24 + i * 20));
    // 続きインジケーター
    const alpha = 0.5 + 0.5 * Math.sin(this._blinkTimer * 4);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS.accent;
    ctx.textAlign = 'right';
    ctx.fillText('▼', CANVAS_W - 16, my + 72);
    ctx.globalAlpha = 1;
  }

  _drawWinScreen(ctx) {
    ctx.fillStyle = 'rgba(4, 6, 20, 0.7)';
    ctx.fillRect(0, 390, CANVAS_W, 110);
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 392, CANVAS_W - 16, 106);
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('★ しょうり ★', CANVAS_W / 2, 418);
    ctx.fillStyle = COLORS.text;
    ctx.font = '13px monospace';
    ctx.fillText(`EXP +${this._expGained}`, CANVAS_W / 2, 444);
    if (this._goldGained > 0) ctx.fillText(`G +${this._goldGained}`, CANVAS_W / 2, 464);
    const blink = 0.5 + 0.5 * Math.sin(this._blinkTimer * 4);
    ctx.globalAlpha = blink;
    ctx.fillStyle = COLORS.accent;
    ctx.fillText('タップでつづける', CANVAS_W / 2, 490);
    ctx.globalAlpha = 1;
  }

  _drawLoseScreen(ctx) {
    ctx.fillStyle = 'rgba(20, 4, 4, 0.8)';
    ctx.fillRect(0, 390, CANVAS_W, 110);
    ctx.strokeStyle = '#aa2222';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 392, CANVAS_W - 16, 106);
    ctx.fillStyle = '#cc4444';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('目の前が暗くなった……', CANVAS_W / 2, 430);
    const blink = 0.5 + 0.5 * Math.sin(this._blinkTimer * 4);
    ctx.globalAlpha = blink;
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '13px monospace';
    ctx.fillText('タップでつづける', CANVAS_W / 2, 466);
    ctx.globalAlpha = 1;
  }
}
