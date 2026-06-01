/**
 * Web Audio API synthesizer for self-contained, responsive sound effects
 * that do not require loading external media files.
 */
export class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private isEnabled: boolean = true;
  private isTickSoundEnabled: boolean = false;

  constructor() {
    // AudioContext will be initialized on first user interaction to comply with browser policies
  }

  private initContext(): void {
    if (!this.ctx) {
      // Support standard and vendor prefixed AudioContext
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  public setTickEnabled(enabled: boolean): void {
    this.isTickSoundEnabled = enabled;
  }

  /**
   * Plays a subtle mechanical ticking sound (metronome click)
   */
  public playTick(): void {
    if (!this.isEnabled || !this.isTickSoundEnabled) return;
    
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      // A very short click sound (pop/tick)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, this.ctx.currentTime); // High pitch click
      osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.03);

      gainNode.gain.setValueAtTime(0.04, this.ctx.currentTime); // very quiet
      gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.03);

      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + 0.04);
    } catch (e) {
      console.warn('Web Audio API tick fail:', e);
    }
  }

  /**
   * Plays a rich, futuristic chime/bell sound when a timer period ends
   */
  public playAlarm(): void {
    if (!this.isEnabled) return;

    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      
      // We will play a series of 3 chime notes in a major triad (C5, E5, G5, C6)
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const noteTime = now + idx * 0.18;
        
        // Main tone (sine wave)
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        
        // Harmonics for a warmer, bell-like quality
        const oscHarmonic = this.ctx.createOscillator();
        const gainHarmonic = this.ctx.createGain();

        osc.connect(gainNode);
        oscHarmonic.connect(gainHarmonic);
        
        gainNode.connect(this.ctx.destination);
        gainHarmonic.connect(this.ctx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteTime);

        // Harmonic is twice the frequency (first octave octave)
        oscHarmonic.type = 'sine';
        oscHarmonic.frequency.setValueAtTime(freq * 2, noteTime);

        // Envelopes: rapid attack, smooth decay
        gainNode.gain.setValueAtTime(0, noteTime);
        gainNode.gain.linearRampToValueAtTime(0.15, noteTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.9);

        gainHarmonic.gain.setValueAtTime(0, noteTime);
        gainHarmonic.gain.linearRampToValueAtTime(0.07, noteTime + 0.01);
        gainHarmonic.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.45);

        osc.start(noteTime);
        oscHarmonic.start(noteTime);
        
        osc.stop(noteTime + 1.0);
        oscHarmonic.stop(noteTime + 1.0);
      });
    } catch (e) {
      console.warn('Web Audio API alarm fail:', e);
    }
  }

  /**
   * Plays a soft confirmation sound (e.g. click or setting adjustment)
   */
  public playClick(): void {
    if (!this.isEnabled) return;

    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.08);

      gainNode.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.08);

      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + 0.09);
    } catch (e) {
      console.warn('Web Audio API click fail:', e);
    }
  }
}
export const synth = new AudioSynthesizer();
