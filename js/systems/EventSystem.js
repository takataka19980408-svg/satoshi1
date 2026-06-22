// イベントシステム。chapter1.jsonのシーケンスを実行する。
export class EventSystem {
  constructor(game, worldScene) {
    this.game  = game;
    this.world = worldScene;
    this._events = {};
    this._running   = false;
    this._steps     = [];
    this._stepIndex = 0;
    this._waiting   = false;
    this._waitTimer = 0;
    this._currentEventId  = null;
    this._pendingWinEvent = null;
  }

  load(eventData) {
    this._events = eventData || {};
  }

  reset() {
    this._running       = false;
    this._waiting       = false;
    this._waitTimer     = 0;
    this._currentEventId  = null;
    this._pendingWinEvent = null;
  }

  // フラグ確認
  flagSet(flag) {
    return !!this.game.state.flags[flag];
  }

  setFlag(flag, value = true) {
    this.game.state.flags[flag] = value;
  }

  // IDでイベントを起動
  trigger(eventId) {
    const ev = this._events[eventId];
    if (!ev) return false;

    // 条件チェック（複数フラグに対応）
    if (ev.condition) {
      const { flagSet, flagNotSet } = ev.condition;
      if (flagSet) {
        const flags = Array.isArray(flagSet) ? flagSet : [flagSet];
        if (!flags.every(f => this.flagSet(f))) return false;
      }
      if (flagNotSet) {
        const flags = Array.isArray(flagNotSet) ? flagNotSet : [flagNotSet];
        if (!flags.every(f => !this.flagSet(f))) return false;
      }
    }

    this._steps     = ev.steps || [];
    this._stepIndex = 0;
    this._running   = true;
    this._waiting   = false;
    this._currentEventId = eventId;
    this._nextStep();
    return true;
  }

  get isRunning() { return this._running; }

  update(dt) {
    if (!this._running || !this._waiting) return;
    if (this._waitTimer > 0) {
      this._waitTimer -= dt;
      if (this._waitTimer <= 0) {
        this._waiting = false;
        this._nextStep();
      }
    }
  }

  // Aボタンが押されたとき（ダイアログ進行）
  onConfirm() {
    if (!this._running) return false;
    const dialog = this.world.dialog;
    if (dialog.active) {
      if (dialog.choices && dialog.done) {
        // 選択肢決定
        const idx = dialog.getChoiceResult();
        const chosen = dialog.choices[idx];
        dialog.close();
        if (chosen?.goto) {
          this._jumpTo(chosen.goto);
        } else {
          this._nextStep();
        }
        return true;
      }
      dialog.confirm();
      if (dialog.finished) {
        this._nextStep();
      }
      return true;
    }
    return false;
  }

  _nextStep() {
    if (this._stepIndex >= this._steps.length) {
      this._finish();
      return;
    }
    this._execStep(this._steps[this._stepIndex++]);
  }

  _jumpTo(labelId) {
    const idx = this._steps.findIndex(s => s.type === 'label' && s.id === labelId);
    if (idx >= 0) {
      this._stepIndex = idx + 1;
      this._nextStep();
    } else {
      this._finish();
    }
  }

  _execStep(step) {
    const g = this.game;
    const w = this.world;

    switch (step.type) {
      case 'label':
        this._nextStep();
        break;

      case 'dialog':
        if (step.choices) {
          w.dialog.showChoice(step.text, step.choices, step.speaker || '');
        } else {
          w.dialog.show(step.text, step.speaker || '');
        }
        this._waiting = true;
        break;

      case 'choice':
        w.dialog.showChoice(step.text, step.choices, step.speaker || '');
        this._waiting = true;
        break;

      case 'setFlag':
        this.setFlag(step.flag, step.value !== false);
        this._nextStep();
        break;

      case 'addItem': {
        const items = g.state.inventory;
        const existing = items.find(i => i.id === step.itemId);
        if (existing) existing.count++;
        else items.push({ id: step.itemId, count: 1 });
        g.audio.playSfx('item');
        this._nextStep();
        break;
      }

      case 'addMonster': {
        const mData = g.loader.get('data/enemies/enemies.json');
        const m = mData?.[step.monsterId];
        if (m) {
          g.state.monsters.push({
            id: step.monsterId,
            name: m.name,
            hp: m.hp,
            maxHp: m.hp,
            mp: m.mp || 0,
            maxMp: m.mp || 0,
            atk: m.atk || 5,
            def: m.def || 3,
            exp: 0,
            level: 1,
          });
        }
        this._nextStep();
        break;
      }

      case 'sfx':
        g.audio.playSfx(step.id);
        this._nextStep();
        break;

      case 'bgm':
        g.audio.playBgm(step.id);
        this._nextStep();
        break;

      case 'faceDir':
        w.playerFace(step.dir);
        this._nextStep();
        break;

      case 'npcFace':
        w.npcFace(step.npcId, step.dir);
        this._nextStep();
        break;

      case 'flash':
        w.flash(step.color || '#ffffff', step.duration || 300);
        this._waiting = true;
        this._waitTimer = (step.duration || 300) / 1000;
        break;

      case 'blackout':
        w.blackoutIn(step.duration || 800);
        this._waiting = true;
        this._waitTimer = (step.duration || 800) / 1000;
        break;

      case 'clearBlackout':
        w.blackoutOut(step.duration || 600);
        this._waiting = true;
        this._waitTimer = (step.duration || 600) / 1000;
        break;

      case 'shake':
        w.shake(step.duration || 400, step.intensity || 5);
        this._nextStep();
        break;

      case 'glow':
        w.startGlow(step.color || '#aaddff', step.duration || 3000);
        this._nextStep();
        break;

      case 'wait':
        this._waiting = true;
        this._waitTimer = step.duration / 1000;
        break;

      case 'teleport':
        w.teleport(step.toMap, step.toX, step.toY);
        this._nextStep();
        break;

      case 'battle':
        this._pendingWinEvent = step.onWin || null;
        g.changeScene('battle', { enemyId: step.enemyId, onWin: step.onWin, isBoss: step.isBoss });
        this._waiting = true;
        break;

      case 'endChapter':
        g.changeScene('ending', { chapter: step.chapter || g.state.chapter || 1 });
        this._finish();
        break;

      case 'innRest':
        for (const m of g.state.monsters) { m.hp = m.maxHp; m.mp = m.maxMp || 0; }
        g.audio.playSfx('item');
        this._nextStep();
        break;

      case 'save':
        g.saveGame();
        this._nextStep();
        break;

      case 'end':
      default:
        this._finish();
        break;
    }
  }

  _finish() {
    this._running = false;
    this._waiting = false;
    this._currentEventId = null;
    const dialog = this.world.dialog;
    if (dialog.active) dialog.close();
  }

  // バトル終了後に呼ばれる
  resumeAfterBattle(won) {
    const pendingWin = this._pendingWinEvent;
    this._pendingWinEvent = null;
    if (!won) {
      this._finish();
      return;
    }
    this._running = true;
    this._waiting = false;
    this._nextStep();
    // バトルステップが最後だった場合、onWinイベントを起動する
    if (!this._running && pendingWin) {
      this.trigger(pendingWin);
    }
  }
}
