export interface Task {
  id: string;
  title: string;
  targetPomodoros: number;
  completedPomodoros: number;
  completed: boolean;
}

export class TaskManager {
  private tasks: Task[] = [];
  private activeTaskId: string | null = null;
  private onChangeCallbacks: Array<(tasks: Task[], activeTaskId: string | null) => void> = [];
  private onSyncStatusCallbacks: Array<(isSyncing: boolean, error?: string) => void> = [];
  private currentStats: any = null;

  constructor() {
    this.load();
  }

  /**
   * Subscribe to task list changes
   */
  public onChange(callback: (tasks: Task[], activeTaskId: string | null) => void): void {
    this.onChangeCallbacks.push(callback);
    // Trigger immediately with initial data
    callback(this.tasks, this.activeTaskId);
  }

  public updateStats(stats: any): void {
    this.currentStats = stats;
    this.autoSync();
  }

  private notify(): void {
    this.onChangeCallbacks.forEach(cb => cb([...this.tasks], this.activeTaskId));
    this.save();
    this.autoSync();
  }

  public onSyncStatus(callback: (isSyncing: boolean, error?: string) => void): void {
    this.onSyncStatusCallbacks.push(callback);
  }

  private notifySyncStatus(isSyncing: boolean, error?: string): void {
    this.onSyncStatusCallbacks.forEach(cb => cb(isSyncing, error));
  }

  private getSyncUrl(): string {
    return ((import.meta.env as any).VITE_GSHEETS_URL || '') as string;
  }

  private autoSyncTimeout: number | null = null;

  private autoSync(): void {
    if (this.autoSyncTimeout) clearTimeout(this.autoSyncTimeout);
    this.autoSyncTimeout = window.setTimeout(() => {
      this.forceSync();
    }, 2000) as unknown as number; // Debounce 2 seconds
  }

  public async forceSync(): Promise<boolean> {
    const url = this.getSyncUrl();
    if (!url) {
      this.notifySyncStatus(false, 'URL de Google Sheets no configurada');
      return false;
    }

    this.notifySyncStatus(true);

    return new Promise((resolve) => {
      const callbackName = '__pomodoroSyncCb_' + Date.now();
      const payload = JSON.stringify({
        action: 'sync',
        tasks: this.tasks,
        stats: this.currentStats
      });
      const encoded = btoa(unescape(encodeURIComponent(payload)));

      (window as any)[callbackName] = (result: any) => {
        delete (window as any)[callbackName];
        const script = document.getElementById(callbackName);
        if (script) script.remove();

        if (result && result.status === 'success') {
          this.notifySyncStatus(false);
          resolve(true);
        } else {
          this.notifySyncStatus(false, result?.message || 'Error en servidor');
          resolve(false);
        }
      };

      const script = document.createElement('script');
      script.id = callbackName;
      script.src = `${url}?callback=${callbackName}&data=${encodeURIComponent(encoded)}`;
      script.onerror = () => {
        delete (window as any)[callbackName];
        script.remove();
        this.notifySyncStatus(false, 'Error de red');
        resolve(false);
      };
      document.head.appendChild(script);

      setTimeout(() => {
        if ((window as any)[callbackName]) {
          delete (window as any)[callbackName];
          script.remove();
          this.notifySyncStatus(false, 'Timeout');
          resolve(false);
        }
      }, 10000);
    });
  }

  /**
   * Add a new task
   */
  public addTask(title: string, targetPomodoros: number = 1): void {
    const newTask: Task = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      title: title.trim(),
      targetPomodoros: Math.max(1, targetPomodoros),
      completedPomodoros: 0,
      completed: false
    };
    
    this.tasks.push(newTask);
    
    // Auto-select if it is the only task or if there is no active task
    if (!this.activeTaskId) {
      this.activeTaskId = newTask.id;
    }
    
    this.notify();
  }

  /**
   * Delete a task by ID
   */
  public deleteTask(id: string): void {
    this.tasks = this.tasks.filter(t => t.id !== id);
    if (this.activeTaskId === id) {
      // Find another active task or nullify
      const remainingActive = this.tasks.find(t => !t.completed);
      this.activeTaskId = remainingActive ? remainingActive.id : (this.tasks.length > 0 ? this.tasks[0].id : null);
    }
    this.notify();
  }

  /**
   * Toggle task completion status
   */
  public toggleComplete(id: string): void {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      task.completed = !task.completed;
      
      // If completed, check if we need to deselect active task
      if (task.completed && this.activeTaskId === id) {
        // Automatically select the next uncompleted task
        const nextTask = this.tasks.find(t => t.id !== id && !t.completed);
        this.activeTaskId = nextTask ? nextTask.id : null;
      } else if (!task.completed && !this.activeTaskId) {
        // If uncompleted and no task is active, select it
        this.activeTaskId = id;
      }
      
      this.notify();
    }
  }

  /**
   * Select a task as the active Pomodoro target
   */
  public selectTask(id: string | null): void {
    if (id === null || this.tasks.some(t => t.id === id)) {
      this.activeTaskId = id;
      this.notify();
    }
  }

  /**
   * Get the active task object
   */
  public getActiveTask(): Task | null {
    return this.tasks.find(t => t.id === this.activeTaskId) || null;
  }

  /**
   * Increments the completed Pomodoros count on the active task
   */
  public incrementActivePomodoro(): void {
    if (!this.activeTaskId) return;
    const task = this.tasks.find(t => t.id === this.activeTaskId);
    if (task && !task.completed) {
      task.completedPomodoros++;
      this.notify();
    }
  }

  /**
   * Save task list to LocalStorage
   */
  private save(): void {
    localStorage.setItem('pomodoro_tasks', JSON.stringify(this.tasks));
    localStorage.setItem('pomodoro_active_task_id', this.activeTaskId || '');
  }

  /**
   * Load task list from LocalStorage
   */
  private load(): void {
    try {
      const storedTasks = localStorage.getItem('pomodoro_tasks');
      const storedActiveId = localStorage.getItem('pomodoro_active_task_id');
      
      if (storedTasks) {
        this.tasks = JSON.parse(storedTasks);
      }
      if (storedActiveId) {
        this.activeTaskId = storedActiveId;
      } else if (this.tasks.length > 0) {
        // Fallback: select first uncompleted task
        const firstUncompleted = this.tasks.find(t => !t.completed);
        this.activeTaskId = firstUncompleted ? firstUncompleted.id : this.tasks[0].id;
      }
    } catch (e) {
      console.error('Error loading tasks:', e);
      this.tasks = [];
      this.activeTaskId = null;
    }
  }

  /**
   * Get all tasks
   */
  public getTasks(): Task[] {
    return this.tasks;
  }
}
export const taskManager = new TaskManager();
