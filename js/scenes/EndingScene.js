import { Scene } from '../engine/Scene.js';
import { CANVAS_W, CANVAS_H, COLORS } from '../constants.js';

export class EndingScene extends Scene {
  constructor(game) {
    super(game);
    this._timer    = 0;
    this._phase    = 0;
    this._alpha    = 0;
    this._lines    = [];
    this._lineIdx  = 0;
    this._charIdx  = 0;
    this._charTimer= 0;
    this._inputLock= false;
    this._stars    = [];
    this._chapter  = 1;
    this._tapHandler = null;
  }

  enter({ chapter = 1 } = {}) {
    this._chapter  = chapter;
    this._timer    = 0;
    this._phase    = 0;
    this._alpha    = 0;
    this._lineIdx  = 0;
    this._charIdx  = 0;
    this._charTimer= 0;
    this._inputLock= true;
    this._stars    = Array.from({ length: 60 }, () => ({
      x: Math.random() * CANVAS_W,
      y: Math.random() * CANVAS_H,
      size: Math.random() * 1.5 + 0.5,
      phase: Math.random() * Math.PI * 2,
    }));
    if (chapter === 3) {
      this._lines = [
        '塔の頂。',
        '星が、近かった。',
        '',
        '——死にたいんだ。',
        '',
        '声は、澄んでいた。',
        'ためらいもなく。',
        'ただ、静かに。',
        'まっすぐに。',
      ];
    } else {
      this._lines = [
        'ミドリ村に静かな夜が来た。',
        'サトシは石を見つめた。',
        '青白い光は、まだそこにある。',
        '',
        '「返して」',
        '',
        '声は繰り返す。',
        '誰かの声で。',
        '知らない声で。',
      ];
    }
    this.game.audio.playBgm('ending');
    this._inputLock = true;

    this._tapHandler = (e) => {
      if (e.type === 'touchstart') e.preventDefault();
      this._handleTap();
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

  _handleTap() {
    if (this._inputLock) return;
    if (this._phase === 1) {
      const curLine = this._lines[this._lineIdx] || '';
      if (this._charIdx < curLine.length) {
        this._charIdx = curLine.length;
      } else {
        this.game.audio.playSfx('confirm');
        this._lineIdx++;
        this._charIdx  = 0;
        this._charTimer = 0;
        if (this._lineIdx >= this._lines.length) {
          this._phase     = 2;
          this._timer     = 0;
          this._inputLock = true;
        }
      }
    } else if (this._phase === 3) {
      this.game.changeScene('title');
    }
  }

  update(dt) {
    this._timer += dt;

    if (this._phase === 0) {
      // フェードイン
      this._alpha = Math.min(1, this._timer * 0.5);
      if (this._alpha >= 1) { this._phase = 1; this._inputLock = false; }
      return;
    }

    if (this._phase === 1) {
      // テキスト表示
      this._charTimer += dt;
      const curLine = this._lines[this._lineIdx] || '';
      while (this._charTimer > 0.04 && this._charIdx < curLine.length) {
        this._charTimer -= 0.04;
        this._charIdx++;
      }
      if (this._charIdx >= curLine.length && !this._inputLock) {
        if (this.game.input.isJust('a')) this._handleTap();
      }
      return;
    }

    if (this._phase === 2) {
      // フェードアウト
      if (this._timer > 2) {
        this._alpha = Math.max(0, 1 - (this._timer - 2) * 0.5);
      }
      if (this._timer > 4) {
        this._phase = 3;
        this._timer = 0;
        this._inputLock = false;
      }
      return;
    }

    if (this._phase === 3) {
      if (this.game.input.isJust('a')) this._handleTap();
    }
  }

  render(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (this._phase <= 2) {
      ctx.globalAlpha = this._alpha;
      this._drawStarBg(ctx);
      this._drawNarrativeText(ctx);
      ctx.globalAlpha = 1;
    } else {
      this._drawChapterEnd(ctx);
    }
  }

  _drawStarBg(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#02021a');
    grad.addColorStop(1, '#060414');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    for (const s of this._stars) {
      const a = 0.3 + 0.7 * Math.abs(Math.sin(this._timer * 0.3 + s.phase));
      ctx.globalAlpha *= a;
      ctx.fillStyle = '#a0b8ff';
      ctx.fillRect(s.x, s.y, s.size, s.size);
      ctx.globalAlpha = this._alpha;
    }
  }

  _drawNarrativeText(ctx) {
    const visibleLines = this._lines.slice(0, this._lineIdx + 1);
    const cy = CANVAS_H / 2 - visibleLines.length * 18;

    ctx.font = '14px monospace';
    ctx.textAlign = 'center';

    visibleLines.forEach((line, i) => {
      const isLast = i === this._lineIdx;
      const text   = isLast ? line.slice(0, this._charIdx) : line;
      const age    = this._lineIdx - i;
      const alpha  = Math.max(0.3, 1 - age * 0.15);
      const color  = line === '「返して」' ? COLORS.accent : COLORS.text;

      ctx.fillStyle = color;
      ctx.globalAlpha = this._alpha * alpha;
      ctx.fillText(text, CANVAS_W / 2, cy + i * 36);
    });

    ctx.globalAlpha = this._alpha;

    // 進むインジケーター
    if (this._charIdx >= (this._lines[this._lineIdx]?.length || 0) && !this._inputLock && this._phase === 1) {
      const blinkA = 0.5 + 0.5 * Math.sin(this._timer * 4);
      ctx.globalAlpha = this._alpha * blinkA;
      ctx.fillStyle = COLORS.accent;
      ctx.fillText('▼', CANVAS_W / 2, CANVAS_H - 60);
      ctx.globalAlpha = this._alpha;
    }
  }

  _drawChapterEnd(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#02021a');
    grad.addColorStop(1, '#060414');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    for (const s of this._stars) {
      const a = 0.3 + 0.7 * Math.abs(Math.sin(this._timer * 0.3 + s.phase));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#a0b8ff';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    const chapterMeta = [
      { num: '第一章', title: '星の落ちた森',  next: '第二章へつづく' },
      { num: '第二章', title: '黒曜の坑道',    next: '第三章へつづく' },
      { num: '第三章', title: '白霧の塔',      next: 'つづく' },
    ];
    const meta = chapterMeta[(this._chapter - 1)] || chapterMeta[0];

    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '12px monospace';
    ctx.fillText(meta.num, CANVAS_W / 2, CANVAS_H / 2 - 60);

    ctx.fillStyle = COLORS.accent;
    ctx.font = 'bold 22px monospace';
    ctx.fillText(meta.title, CANVAS_W / 2, CANVAS_H / 2 - 30);

    ctx.fillStyle = COLORS.textDim;
    ctx.font = '13px monospace';
    ctx.fillText('おわり', CANVAS_W / 2, CANVAS_H / 2 + 10);

    ctx.fillStyle = '#303050';
    ctx.font = '11px monospace';
    ctx.fillText(meta.next, CANVAS_W / 2, CANVAS_H / 2 + 40);

    const blink = 0.4 + 0.6 * Math.sin(this._timer * 3);
    ctx.globalAlpha = blink;
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('タップでタイトルにもどる', CANVAS_W / 2, CANVAS_H - 80);
    ctx.globalAlpha = 1;
  }
}
