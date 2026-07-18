import { app, BrowserWindow, Rectangle, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

interface StoredWindowState {
  bounds: Partial<Rectangle>;
  isMaximized: boolean;
}

const STATE_FILE = 'window-state.json';
const SAVE_DEBOUNCE_MS = 500;

function stateFilePath(): string {
  return path.join(app.getPath('userData'), STATE_FILE);
}

function isVisibleOnSomeDisplay(bounds: Rectangle): boolean {
  return screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    return (
      bounds.x < area.x + area.width &&
      bounds.x + bounds.width > area.x &&
      bounds.y < area.y + area.height &&
      bounds.y + bounds.height > area.y
    );
  });
}

function load(defaults: { width: number; height: number }): StoredWindowState {
  const fallback: StoredWindowState = { bounds: { ...defaults }, isMaximized: false };
  try {
    const raw = JSON.parse(fs.readFileSync(stateFilePath(), 'utf-8')) as StoredWindowState;
    const b = raw?.bounds;
    if (
      b &&
      Number.isFinite(b.x) &&
      Number.isFinite(b.y) &&
      typeof b.width === 'number' &&
      b.width > 0 &&
      typeof b.height === 'number' &&
      b.height > 0 &&
      isVisibleOnSomeDisplay(b as Rectangle)
    ) {
      return { bounds: b, isMaximized: raw.isMaximized === true };
    }
  } catch {
    // first launch or unreadable state file — use defaults
  }
  return fallback;
}

function save(state: StoredWindowState): void {
  const file = stateFilePath();
  const tmp = `${file}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tmp, file);
  } catch {
    // persisting window state is best-effort
  }
}

export interface WindowStateManager {
  bounds: Partial<Rectangle>;
  isMaximized: boolean;
  manage(win: BrowserWindow): void;
}

export function createWindowState(defaults: { width: number; height: number }): WindowStateManager {
  const state = load(defaults);
  let saveTimer: NodeJS.Timeout | undefined;

  const capture = (win: BrowserWindow): StoredWindowState => ({
    bounds: win.isMaximized() ? state.bounds : win.getNormalBounds(),
    isMaximized: win.isMaximized(),
  });

  return {
    bounds: state.bounds,
    isMaximized: state.isMaximized,
    manage(win: BrowserWindow): void {
      const scheduleSave = () => {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          if (win.isDestroyed()) return;
          Object.assign(state, capture(win));
          save(state);
        }, SAVE_DEBOUNCE_MS);
      };
      win.on('resize', scheduleSave);
      win.on('move', scheduleSave);
      win.on('close', () => {
        if (saveTimer) clearTimeout(saveTimer);
        Object.assign(state, capture(win));
        save(state);
      });
    },
  };
}
