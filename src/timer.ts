import { synth } from './audio';
import { taskManager } from './tasks';

export type TimerMode = 'focus' | 'short-break' | 'long-break';

export interface TimerStats {
  completedPomodoros: number;
  totalFocusMinutes: number;
}

export class PomodoroTimer {
  // Durations in seconds
  private durations: Record<TimerMode, number> = {
    'focus': 25 * 60,
    'short-break': 5 * 60,
    'long-break': 15 * 60
  };

  private currentMode: TimerMode = 'focus';
  private timeLeft: number = 25 * 60;
  private totalDuration: number = 25 * 60;
  private isRunning: boolean = false;
  private longBreakInterval: number = 4;
  
  // High-precision tracking
  private intervalId: number | null = null;
  private expectedTime: number = 0;
  
  // Statistics
  private stats: TimerStats = {
    completedPomodoros: 0,
    totalFocusMinutes: 0
  };

  // Callbacks
  private tickCallbacks: Array<(timeLeft: number, totalDuration: number) => void> = [];
  private stateCallbacks: Array<(isRunning: boolean, mode: TimerMode, stats: TimerStats) => void> = [];
  private completeCallbacks: Array<(mode: TimerMode) => void> = [];

  constructor() {
    this.loadSettings();
    this.reset(false); // don't auto-start
  }

  private loadSettings(): void {
    try {
      const storedFocus = localStorage.getItem('pomodoro_focus_duration');
      const storedShort = localStorage.getItem('pomodoro_short_duration');
      const storedLong = localStorage.getItem('pomodoro_long_duration');
      const storedInterval = localStorage.getItem('pomodoro_interval');
      
      const storedStats = localStorage.getItem('pomodoro_stats');

      if (storedFocus) this.durations['focus'] = parseInt(storedFocus, 10) * 60;
      if (storedShort) this.durations['short-break'] = parseInt(storedShort, 10) * 60;
      if (storedLong) this.durations['long-break'] = parseInt(storedLong, 10) * 60;
      if (storedInterval) this.longBreakInterval = parseInt(storedInterval, 10);

      if (storedStats) {
        this.stats = JSON.parse(storedStats);
      }
    } catch (e) {
      console.error('Error loading timer settings:', e);
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem('pomodoro_focus_duration', (this.durations['focus'] / 60).toString());
      localStorage.setItem('pomodoro_short_duration', (this.durations['short-break'] / 60).toString());
      localStorage.setItem('pomodoro_long_duration', (this.durations['long-break'] / 60).toString());
      localStorage.setItem('pomodoro_interval', this.longBreakInterval.toString());
      localStorage.setItem('pomodoro_stats', JSON.stringify(this.stats));
    } catch (e) {
      console.error('Error saving timer settings:', e);
    }
  }

  public updateSettings(focusMin: number, shortMin: number, longMin: number, interval: number): void {
    this.durations['focus'] = Math.max(1, focusMin) * 60;
    this.durations['short-break'] = Math.max(1, shortMin) * 60;
    this.durations['long-break'] = Math.max(1, longMin) * 60;
    this.longBreakInterval = Math.max(1, interval);
    this.saveSettings();
    
    // If not running, apply the new time to the current mode
    if (!this.isRunning) {
      this.reset(false);
    } else {
      this.notifyState();
    }
  }

  public subscribeTick(cb: (timeLeft: number, totalDuration: number) => void): void {
    this.tickCallbacks.push(cb);
    cb(this.timeLeft, this.totalDuration);
  }

  public subscribeStateChange(cb: (isRunning: boolean, mode: TimerMode, stats: TimerStats) => void): void {
    this.stateCallbacks.push(cb);
    cb(this.isRunning, this.currentMode, this.stats);
  }

  public subscribeComplete(cb: (mode: TimerMode) => void): void {
    this.completeCallbacks.push(cb);
  }

  private notifyState(): void {
    this.stateCallbacks.forEach(cb => cb(this.isRunning, this.currentMode, { ...this.stats }));
  }

  private notifyTick(): void {
    this.tickCallbacks.forEach(cb => cb(this.timeLeft, this.totalDuration));
  }

  /**
   * Start the timer
   */
  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.expectedTime = Date.now() + 1000;
    
    // Set accurate self-correcting timer loop
    this.intervalId = window.setInterval(() => this.step(), 1000);
    
    this.notifyState();
    synth.playClick();
  }

  /**
   * Pause the timer
   */
  public pause(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.notifyState();
    synth.playClick();
  }

  /**
   * Reset the timer to default state for current mode
   */
  public reset(autoStart: boolean = false): void {
    this.pause();
    this.timeLeft = this.durations[this.currentMode];
    this.totalDuration = this.timeLeft;
    
    this.notifyTick();
    this.notifyState();

    if (autoStart) {
      this.start();
    }
  }

  /**
   * Skips current phase
   */
  public skip(): void {
    synth.playClick();
    this.nextPhase(false); // pass false because we did not complete it
  }

  /**
   * Change current timer mode manually
   */
  public setMode(mode: TimerMode): void {
    if (this.currentMode === mode) return;
    this.currentMode = mode;
    this.reset(false);
  }

  /**
   * Precise timer step
   */
  private step(): void {
    if (!this.isRunning) return;

    const drift = Date.now() - this.expectedTime;
    
    // Subtract time
    this.timeLeft--;
    
    // Sound tick if enabled
    synth.playTick();

    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.notifyTick();
      this.completeSession();
    } else {
      this.notifyTick();
      // Adjust expected time for the next tick
      this.expectedTime += 1000;
      
      // If drift is huge (e.g. system suspended), correct time immediately
      if (drift > 5000) {
        this.expectedTime = Date.now() + 1000;
      }
    }
  }

  /**
   * Handles completions
   */
  private completeSession(): void {
    this.pause();
    synth.playAlarm();

    // Trigger complete listeners
    this.completeCallbacks.forEach(cb => cb(this.currentMode));

    if (this.currentMode === 'focus') {
      this.stats.completedPomodoros++;
      this.stats.totalFocusMinutes += Math.round(this.durations['focus'] / 60);
      
      // Link with taskManager
      taskManager.incrementActivePomodoro();
      this.saveSettings();
    }

    // Auto navigate to the next phase
    this.nextPhase(true);
  }

  /**
   * Transitions to the next Pomodoro phase
   */
  private nextPhase(wasCompleted: boolean): void {
    if (this.currentMode === 'focus') {
      // If we finished N focus sessions, it's time for a long break
      const totalFocus = this.stats.completedPomodoros;
      if (wasCompleted && totalFocus > 0 && totalFocus % this.longBreakInterval === 0) {
        this.currentMode = 'long-break';
      } else {
        this.currentMode = 'short-break';
      }
    } else {
      // After any break, go back to focus
      this.currentMode = 'focus';
    }

    this.reset(wasCompleted); // Auto-start next session if the previous was completed successfully
  }

  public getSettings(): { focus: number, short: number, long: number, interval: number } {
    return {
      focus: this.durations['focus'] / 60,
      short: this.durations['short-break'] / 60,
      long: this.durations['long-break'] / 60,
      interval: this.longBreakInterval
    };
  }

  public getMode(): TimerMode {
    return this.currentMode;
  }

  public getStats(): TimerStats {
    return this.stats;
  }
}

export const timer = new PomodoroTimer();
