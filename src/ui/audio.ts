// Tiny WebAudio synth SFX. Unlocked on first user input; M toggles mute.
// No audio assets; all procedural. Game logic never depends on this.
export class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;
  volume = 0.5;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    } catch { this.ctx = null; }
  }

  private blip(freq: number, dur: number, type: OscillatorType, gain: number): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(gain * this.volume, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(t);
      o.stop(t + dur);
    } catch { /* ignore */ }
  }

  shot(): void { this.blip(880, 0.05, 'square', 0.03); }
  bomb(): void { this.blip(120, 0.4, 'sawtooth', 0.15); }
  hit(): void { this.blip(200, 0.2, 'triangle', 0.12); }
  graze(): void { this.blip(1560, 0.03, 'sine', 0.04); }
  item(): void { this.blip(660, 0.07, 'sine', 0.05); }
  select(): void { this.blip(520, 0.06, 'square', 0.06); }
}
