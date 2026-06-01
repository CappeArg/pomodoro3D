import './styles/main.css';
import './styles/ui-3d.css';
import './styles/layout.css';

import { initializeApp } from 'firebase/app';

import { timer } from './timer';
import type { TimerMode } from './timer';
import { taskManager } from './tasks';
import type { Task } from './tasks';
import { synth } from './audio';
import { tilt } from './tilt';

const firebaseConfig = {
  apiKey: 'AIzaSyBptuPC9YzmZZAS62XgB1znkr_v8vDJLZs',
  authDomain: 'pablo-cappellacci.firebaseapp.com',
  projectId: 'pablo-cappellacci',
  storageBucket: 'pablo-cappellacci.firebasestorage.app',
  messagingSenderId: '643859659643',
  appId: '1:643859659643:web:602df4084211a022da5bde',
  measurementId: 'G-G4FWW02QKW'
};

const app = initializeApp(firebaseConfig);

// --- Dom Elements ---
const timerDisplay = document.getElementById('timer-display') as HTMLDivElement;
const progressCircle = document.getElementById('progress-circle') as unknown as SVGCircleElement;
const timerBadgeText = document.getElementById('timer-badge-text') as HTMLSpanElement;
const timerBadge = document.getElementById('timer-badge') as HTMLDivElement;

const btnPlayPause = document.getElementById('btn-play-pause') as HTMLButtonElement;
const btnPlayText = document.getElementById('btn-play-text') as HTMLSpanElement;
const playIcon = document.getElementById('play-icon') as unknown as SVGElement;
const pauseIcon = document.getElementById('pause-icon') as unknown as SVGElement;

const btnSkip = document.getElementById('btn-skip') as HTMLButtonElement;
const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;
const btnOpenSettings = document.getElementById('btn-open-settings') as HTMLButtonElement;

// Modes Buttons
const btnModeFocus = document.getElementById('btn-mode-focus') as HTMLButtonElement;
const btnModeShort = document.getElementById('btn-mode-short') as HTMLButtonElement;
const btnModeLong = document.getElementById('btn-mode-long') as HTMLButtonElement;
const modeBtns = [btnModeFocus, btnModeShort, btnModeLong];

// Task Elements
const addTaskForm = document.getElementById('add-task-form') as HTMLFormElement;
const taskInput = document.getElementById('task-input') as HTMLInputElement;
const taskEstPoms = document.getElementById('task-est-poms') as HTMLInputElement;
const tasksList = document.getElementById('tasks-list') as HTMLUListElement;
const tasksEmptyMsg = document.getElementById('tasks-empty-msg') as HTMLDivElement;
const btnSyncTasks = document.getElementById('btn-sync-tasks') as HTMLButtonElement;
const syncStatusText = document.getElementById('sync-status-text') as HTMLSpanElement;
const iconSync = document.getElementById('icon-sync') as unknown as SVGElement;

// Stats Elements
const statsPomodoros = document.getElementById('stats-pomodoros') as HTMLDivElement;
const statsTime = document.getElementById('stats-time') as HTMLDivElement;
const statsTasks = document.getElementById('stats-tasks') as HTMLDivElement;

// Settings Modal
const settingsModal = document.getElementById('settings-modal') as HTMLDivElement;
const btnCloseSettings = document.getElementById('btn-close-settings') as HTMLButtonElement;
const settingsForm = document.getElementById('settings-form') as HTMLFormElement;

const settingFocus = document.getElementById('setting-focus') as HTMLInputElement;
const settingShort = document.getElementById('setting-short') as HTMLInputElement;
const settingLong = document.getElementById('setting-long') as HTMLInputElement;
const settingInterval = document.getElementById('setting-interval') as HTMLInputElement;
const settingSoundEnabled = document.getElementById('setting-sound-enabled') as HTMLInputElement;
const settingTickEnabled = document.getElementById('setting-tick-enabled') as HTMLInputElement;
const settingGsheetsUrl = document.getElementById('setting-gsheets-url') as HTMLInputElement;

const btnResetAll = document.getElementById('reset-all-data') as HTMLButtonElement;

// SVG Progress stroke constants
const CIRCLE_CIRCUMFERENCE = 816.8; // 2 * PI * r (r=130)

// --- Helper Functions ---

/**
 * Formats time in seconds to MM:SS string
 */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Updates CSS theme colors variables dynamically in document root
 */
function updateThemeColors(mode: TimerMode): void {
  const root = document.documentElement;
  
  if (mode === 'focus') {
    root.style.setProperty('--theme-color', 'var(--focus-color)');
    root.style.setProperty('--theme-color-rgb', 'var(--focus-color-rgb)');
    root.style.setProperty('--theme-glow', 'var(--focus-glow)');
    timerBadgeText.textContent = 'Modo Enfoque';
    timerBadge.className = 'badge-3d active';
  } else if (mode === 'short-break') {
    root.style.setProperty('--theme-color', 'var(--short-break-color)');
    root.style.setProperty('--theme-color-rgb', 'var(--short-break-color-rgb)');
    root.style.setProperty('--theme-glow', 'var(--short-break-glow)');
    timerBadgeText.textContent = 'Descanso Corto';
    timerBadge.className = 'badge-3d active';
  } else {
    root.style.setProperty('--theme-color', 'var(--long-break-color)');
    root.style.setProperty('--theme-color-rgb', 'var(--long-break-color-rgb)');
    root.style.setProperty('--theme-glow', 'var(--long-break-glow)');
    timerBadgeText.textContent = 'Descanso Largo';
    timerBadge.className = 'badge-3d active';
  }
}

/**
 * Populates modal inputs with current settings
 */
function populateSettingsInputs(): void {
  const cfg = timer.getSettings();
  settingFocus.value = cfg.focus.toString();
  settingShort.value = cfg.short.toString();
  settingLong.value = cfg.long.toString();
  settingInterval.value = cfg.interval.toString();
  
  // Audio state
  const isSoundOn = localStorage.getItem('pomodoro_sound_enabled') !== 'false';
  const isTickOn = localStorage.getItem('pomodoro_tick_enabled') === 'true';
  settingSoundEnabled.checked = isSoundOn;
  settingTickEnabled.checked = isTickOn;
  synth.setEnabled(isSoundOn);
  synth.setTickEnabled(isTickOn);

  // GSheets URL
  const gsheetsUrl = localStorage.getItem('pomodoro_gsheets_url') || '';
  settingGsheetsUrl.value = gsheetsUrl;
}

// --- Bindings & Listeners ---

// Timer Tick Listener
timer.subscribeTick((timeLeft, totalDuration) => {
  timerDisplay.textContent = formatTime(timeLeft);
  
  // Calculate SVG stroke offset
  const progressRatio = timeLeft / totalDuration;
  const offset = progressRatio * CIRCLE_CIRCUMFERENCE;
  progressCircle.style.strokeDashoffset = offset.toString();

  // Tab Title status update
  const emoji = timer.getMode() === 'focus' ? '🍅' : '🍃';
  document.title = `${formatTime(timeLeft)} ${emoji} Focus3D`;
});

// Timer State Change Listener
timer.subscribeStateChange((isRunning, mode, stats) => {
  // Update Play/Pause button visual
  if (isRunning) {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
    btnPlayText.textContent = 'Pausar';
  } else {
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
    btnPlayText.textContent = 'Iniciar';
  }

  // Update theme accent colors
  updateThemeColors(mode);

  // Update modes active tab class
  modeBtns.forEach(btn => {
    if (btn.getAttribute('data-mode') === mode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Render Stats
  statsPomodoros.textContent = stats.completedPomodoros.toString();
  statsTime.textContent = `${stats.totalFocusMinutes}m`;
  
  // Update completed tasks count
  const completedTasks = taskManager.getTasks().filter(t => t.completed).length;
  statsTasks.textContent = completedTasks.toString();
  
  // Send stats to TaskManager for Google Sheets sync
  taskManager.updateStats(stats);
});

// Timer Session Complete Alert
timer.subscribeComplete((mode) => {
  // Send simple browser notifications if allowed
  if (Notification.permission === 'granted') {
    const title = mode === 'focus' ? '¡Sesión de enfoque completada!' : '¡Descanso completado!';
    const body = mode === 'focus' ? 'Buen trabajo. Tómate un respiro.' : 'Hora de volver al trabajo.';
    new Notification(title, { body, icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🍅</text></svg>' });
  }
});

// Render Tasks function
function renderTasks(tasks: Task[], activeTaskId: string | null): void {
  tasksList.innerHTML = '';
  
  if (tasks.length === 0) {
    tasksEmptyMsg.style.display = 'block';
  } else {
    tasksEmptyMsg.style.display = 'none';
    
    tasks.forEach(task => {
      const li = document.createElement('li');
      li.className = `task-item tilt-card ${task.completed ? 'completed' : ''} ${task.id === activeTaskId ? 'active' : ''}`;
      li.setAttribute('data-id', task.id);
      
      li.innerHTML = `
        <div class="task-item-left">
          <div class="task-checkbox-3d" data-action="toggle-complete">
            <svg viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <span class="task-title">${task.title}</span>
        </div>
        <div class="task-item-right">
          <span class="task-pomodoros">${task.completedPomodoros}/${task.targetPomodoros} 🍅</span>
          <button class="btn-delete-task" data-action="delete" aria-label="Eliminar tarea">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
          </button>
        </div>
      `;
      
      // Select active task listener
      li.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const actionEl = target.closest('[data-action]');
        
        if (actionEl) {
          const action = actionEl.getAttribute('data-action');
          if (action === 'toggle-complete') {
            e.stopPropagation();
            taskManager.toggleComplete(task.id);
            synth.playClick();
          } else if (action === 'delete') {
            e.stopPropagation();
            taskManager.deleteTask(task.id);
            synth.playClick();
          }
        } else {
          // If clicked the card body, select as active
          taskManager.selectTask(task.id);
          synth.playClick();
        }
      });

      tasksList.appendChild(li);
    });
  }

  // Re-apply tilt effect to dynamic task cards
  tilt.init();
}

// Subscribe to task list updates
taskManager.onChange((tasks, activeTaskId) => {
  renderTasks(tasks, activeTaskId);
  
  // Sync finished task stats
  const completedCount = tasks.filter(t => t.completed).length;
  statsTasks.textContent = completedCount.toString();
});

// Sync Status Listener
taskManager.onSyncStatus((isSyncing, error) => {
  if (isSyncing) {
    syncStatusText.textContent = 'Sinc...';
    iconSync.style.opacity = '0.5';
  } else {
    syncStatusText.textContent = error ? 'Error' : 'Listo';
    iconSync.style.opacity = '1';
    setTimeout(() => {
      syncStatusText.textContent = 'Sinc.';
    }, 2500);
  }
});

btnSyncTasks.addEventListener('click', () => {
  taskManager.forceSync();
  synth.playClick();
});

// Add Task Submit handler
addTaskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = taskInput.value;
  const count = parseInt(taskEstPoms.value, 10) || 1;
  
  taskManager.addTask(title, count);
  taskInput.value = '';
  taskEstPoms.value = '1';
  synth.playClick();
});

// Play / Pause Click handler
btnPlayPause.addEventListener('click', () => {
  if (timer.getMode() === 'focus' && taskManager.getTasks().length > 0 && !taskManager.getActiveTask()) {
    // If we have tasks but none is selected, auto select the first uncompleted one
    const firstUncompleted = taskManager.getTasks().find(t => !t.completed);
    if (firstUncompleted) {
      taskManager.selectTask(firstUncompleted.id);
    }
  }
  
  const isRunning = btnPlayText.textContent === 'Pausar';
  if (isRunning) {
    timer.pause();
  } else {
    timer.start();
  }
});

// Skip Click handler
btnSkip.addEventListener('click', () => {
  timer.skip();
});

// Reset Click handler
btnReset.addEventListener('click', () => {
  timer.reset();
  synth.playClick();
});

// Mode buttons click handlers
modeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetMode = btn.getAttribute('data-mode') as TimerMode;
    timer.setMode(targetMode);
    synth.playClick();
  });
});

// Modal toggle handlers
btnOpenSettings.addEventListener('click', () => {
  populateSettingsInputs();
  settingsModal.classList.add('open');
  synth.playClick();
});

function closeModal(): void {
  settingsModal.classList.remove('open');
  synth.playClick();
}

btnCloseSettings.addEventListener('click', closeModal);

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    closeModal();
  }
});

// Settings Form submit handler
settingsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const focus = parseInt(settingFocus.value, 10);
  const short = parseInt(settingShort.value, 10);
  const long = parseInt(settingLong.value, 10);
  const interval = parseInt(settingInterval.value, 10);
  const soundEnabled = settingSoundEnabled.checked;
  const tickEnabled = settingTickEnabled.checked;

  // Save Settings in timer
  timer.updateSettings(focus, short, long, interval);
  
  // Update GSheets URL
  const gsheetsUrl = settingGsheetsUrl.value.trim();
  localStorage.setItem('pomodoro_gsheets_url', gsheetsUrl);

  // Update Audio Synthesizer states
  synth.setEnabled(soundEnabled);
  synth.setTickEnabled(tickEnabled);
  localStorage.setItem('pomodoro_sound_enabled', soundEnabled.toString());
  localStorage.setItem('pomodoro_tick_enabled', tickEnabled.toString());

  settingsModal.classList.remove('open');
  synth.playClick();
});

// Reset All Data action
btnResetAll.addEventListener('click', (e) => {
  e.preventDefault();
  if (confirm('¿Estás seguro de que deseas restablecer todos los datos del temporizador, estadísticas y lista de tareas?')) {
    localStorage.clear();
    location.reload();
  }
});

// Start Requesting Notification Permissions
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// Initializing settings and applying initial mouse tilt
populateSettingsInputs();
tilt.init();
