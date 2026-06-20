import { CANVAS_W, LAYOUT, COLORS } from '../constants.js';

const MSG_X  = LAYOUT.msg.x + 8;
const MSG_Y  = LAYOUT.msg.y;
const MSG_W  = LAYOUT.msg.w - 16;
const MSG_H  = LAYOUT.msg.h;
const LINE_H = 20;
const CHAR_SPEED = 0.03; // 1文字あたりの秒数

export class DialogSystem {
  constructor(game) {
    this.game = game;
    this.active    = false;
    this.speaker   = '';
    this.lines     = [];
    this.lineIndex = 0;
    this.charIndex = 0;
    this.charTimer = 0;
    this.done      = false;   // 現在のページが表示し終わったか
    this.finished  = false;   // 全メッセージが終わったか
    this.choices   = null;
    this.choiceIdx = 0;
    this._onClose  = null;
    this._blinkTimer = 0;
  }

  show(text, speaker = '', onClose = null) {
    this.active    = true;
    this.speaker   = speaker;
    this.lines     = this._splitLines(text);
    this.lineIndex = 0;
    this.charIndex = 0;
    this.charTimer = 0;
    this.done      = false;
    this.finished  = false;
    this.choices   = null;
    this._onClose  = onClose;
  }

  showChoice(text, choices, speaker = '') {
    this.show(text, speaker);
    this.choices   = choices;
    this.choiceIdx = 0;
  }

  _splitLines(text) {
    // テキストを画面幅で折り返し、各ページ2行
    const words = Array.from(text);
    const maxChars = 18;
    const lines = [];
    let cur = '';
    for (const ch of words) {
      if (ch === '\n') {
        lines.push(cur);
        cur = '';
      } else {
        cur += ch;
        // 全角文字は1文字で最大幅になり得る
        if (cur.length >= maxChars) {
          lines.push(cur);
          cur = '';
        }
      }
    }
    if (cur) lines.push(cur);
    // 2行ずつのページに分割
    const pages = [];
    for (let i = 0; i < lines.length; i += 2) {
      pages.push(lines.slice(i, i + 2).join('\n'));
    }
    return pages.length ? pages : [''];
  }

  update(dt) {
    if (!this.active || this.finished) return;
    this._blinkTimer += dt;

    if (!this.done) {
      this.charTimer += dt;
      const fullText = this.lines[this.lineIndex];
      while (this.charTimer >= CHAR_SPEED && this.charIndex < fullText.length) {
        this.charTimer -= CHAR_SPEED;
        this.charIndex++;
      }
      if (this.charIndex >= fullText.length) this.done = true;
    }
  }

  // A ボタン / Enter を押したとき呼ぶ
  confirm() {
    if (!this.active) return;

    if (!this.done) {
      // 途中なら全文表示
      this.charIndex = this.lines[this.lineIndex].length;
      this.done = true;
      return;
    }

    if (this.choices && this.done) {
      // 選択肢があれば選択結果を返す
      const chosen = this.choices[this.choiceIdx];
      this.close();
      return chosen;
    }

    // 次のページへ
    if (this.lineIndex < this.lines.length - 1) {
      this.lineIndex++;
      this.charIndex = 0;
      this.charTimer = 0;
      this.done = false;
    } else {
      this.finished = true;
      this.close();
    }
  }

  close() {
    this.active = false;
    this.finished = true;
    if (this._onClose) {
      const cb = this._onClose;
      this._onClose = null;
      cb();
    }
  }

  selectChoice(dir) {
    if (!this.choices || !this.done) return;
    this.game.audio.playSfx('cursor');
    this.choiceIdx = (this.choiceIdx + dir + this.choices.length) % this.choices.length;
  }

  getChoiceResult() {
    if (!this.choices || !this.done) return null;
    return this.choiceIdx;
  }

  render(ctx) {
    if (!this.active) return;

    const x = LAYOUT.msg.x + 6;
    const y = MSG_Y;
    const w = LAYOUT.msg.w - 12;
    const h = MSG_H;

    // メッセージウィンドウ背景
    ctx.fillStyle = 'rgba(8, 10, 28, 0.94)';
    ctx.fillRect(x, y + 2, w, h - 4);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y + 2, w, h - 4);

    // スピーカー名
    if (this.speaker) {
      ctx.fillStyle = COLORS.panel;
      ctx.fillRect(x + 8, y - 4, this.speaker.length * 10 + 16, 18);
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 8, y - 4, this.speaker.length * 10 + 16, 18);
      ctx.fillStyle = COLORS.accent;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(this.speaker, x + 16, y + 9);
    }

    // テキスト
    const currentPage = this.lines[this.lineIndex] || '';
    const visibleText = currentPage.slice(0, this.charIndex);
    const textLines = visibleText.split('\n');

    ctx.fillStyle = COLORS.text;
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    for (let i = 0; i < textLines.length; i++) {
      ctx.fillText(textLines[i], x + 14, y + 22 + i * LINE_H);
    }

    // 続きインジケーター（点滅）
    if (this.done && !this.choices) {
      const alpha = 0.5 + 0.5 * Math.sin(this._blinkTimer * 4);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.accent;
      ctx.fillText('▼', x + w - 20, y + h - 10);
      ctx.globalAlpha = 1;
    }

    // 選択肢
    if (this.choices && this.done) {
      this._renderChoices(ctx, x, y, w, h);
    }
  }

  _renderChoices(ctx, x, y, w, h) {
    const choiceY = y + 20;
    const choiceH = 22;
    const totalH  = this.choices.length * choiceH + 12;
    const bx = x + w / 2 - 60;

    ctx.fillStyle = 'rgba(8, 10, 28, 0.97)';
    ctx.fillRect(bx, choiceY, 120, totalH);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, choiceY, 120, totalH);

    this.choices.forEach((choice, i) => {
      const ty = choiceY + 10 + i * choiceH;
      if (i === this.choiceIdx) {
        ctx.fillStyle = COLORS.accent;
        ctx.fillText('▶', bx + 10, ty + 12);
      }
      ctx.fillStyle = i === this.choiceIdx ? COLORS.accent : COLORS.text;
      ctx.font = '13px monospace';
      ctx.fillText(choice.label, bx + 26, ty + 12);
    });
  }
}
