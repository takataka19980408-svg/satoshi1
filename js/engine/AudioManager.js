// BGM/SE管理。将来の差し替えを前提とした設計。
// 現在は Web Audio API でシンプルな音を生成（仮素材）。
export class AudioManager {
  constructor() {
    this._ctx = null;
    this._currentBgm = null;
    this._bgmNode = null;
    this._bgmGain = null;
    this._masterVolume = 0.5;
    this._bgmVolume = 0.4;
    this._sfxVolume = 0.6;
    this._muted = false;
    this._bgmId = null;
  }

  _getCtx() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  }

  // BGM切り替え（IDベース、将来はファイルパスに変換）
  playBgm(id) {
    if (this._bgmId === id) return;
    this._bgmId = id;
    this._stopBgmNode();
    if (this._muted) return;
    this._playProceduralBgm(id);
  }

  stopBgm() {
    this._bgmId = null;
    this._stopBgmNode();
  }

  _stopBgmNode() {
    if (this._bgmNode) {
      try { this._bgmNode.stop(); } catch(e) {}
      this._bgmNode = null;
    }
    if (this._bgmGain) {
      try { this._bgmGain.disconnect(); } catch(e) {}
      this._bgmGain = null;
    }
  }

  // 仮素材：Web Audio APIで簡単なアンビエントサウンドを生成
  _playProceduralBgm(id) {
    try {
      const ctx = this._getCtx();
      const gain = ctx.createGain();
      gain.gain.value = this._bgmVolume * this._masterVolume;
      gain.connect(ctx.destination);
      this._bgmGain = gain;

      const presets = {
        title:   { freq: [261, 329, 392], tempo: 2.0 },
        village: { freq: [293, 349, 440], tempo: 1.6 },
        forest:  { freq: [220, 277, 330], tempo: 2.4 },
        battle:  { freq: [330, 392, 494], tempo: 0.8 },
        boss:    { freq: [185, 220, 277], tempo: 0.6 },
        ending:  { freq: [261, 311, 392], tempo: 2.8 },
      };

      const preset = presets[id] || presets.village;
      this._loopBgm(ctx, gain, preset);
    } catch(e) { /* 音声APIが使えない環境では無音 */ }
  }

  _loopBgm(ctx, gain, preset) {
    if (!this._bgmGain || this._bgmGain !== gain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = preset.freq[Math.floor(Math.random() * preset.freq.length)];
    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(0.3, now + 0.3);
    oscGain.gain.linearRampToValueAtTime(0, now + preset.tempo - 0.1);
    osc.connect(oscGain);
    oscGain.connect(gain);
    osc.start(now);
    osc.stop(now + preset.tempo);
    this._bgmNode = osc;
    setTimeout(() => this._loopBgm(ctx, gain, preset), preset.tempo * 1000);
  }

  // SEを鳴らす
  playSfx(id) {
    if (this._muted) return;
    try {
      const ctx = this._getCtx();
      const sfxMap = {
        cursor:  { freq: 440, dur: 0.05, type: 'square' },
        confirm: { freq: 660, dur: 0.1,  type: 'sine'   },
        cancel:  { freq: 220, dur: 0.1,  type: 'square' },
        hit:     { freq: 180, dur: 0.15, type: 'sawtooth' },
        magic:   { freq: 880, dur: 0.2,  type: 'sine'   },
        item:    { freq: 550, dur: 0.15, type: 'sine'   },
        victory: { freq: [523, 659, 784], dur: 0.8, type: 'sine' },
        damage:  { freq: 150, dur: 0.2,  type: 'sawtooth' },
        stone:   { freq: [440, 523, 659, 784], dur: 0.6, type: 'sine' },
        step:    { freq: 180, dur: 0.04, type: 'square' },
      };
      const s = sfxMap[id];
      if (!s) return;

      const freqs = Array.isArray(s.freq) ? s.freq : [s.freq];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = s.type;
        osc.frequency.value = f;
        const t = ctx.currentTime + i * 0.1;
        g.gain.setValueAtTime(this._sfxVolume * this._masterVolume * 0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + s.dur);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + s.dur + 0.01);
      });
    } catch(e) {}
  }

  toggleMute() {
    this._muted = !this._muted;
    if (this._muted) this._stopBgmNode();
    else if (this._bgmId) this._playProceduralBgm(this._bgmId);
    return this._muted;
  }
}
