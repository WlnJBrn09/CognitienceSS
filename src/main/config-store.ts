/**
 * Cognitience SS — Configuration Store
 * Persistent settings management with VS Code-style dotted keys.
 * Uses a simple JSON file instead of electron-store (ESM-only in v10).
 */

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { DEFAULT_CONFIG } from '../shared/constants';

export class ConfigStore {
  private data: Record<string, unknown>;
  private configPath: string;
  private watchers: Map<string, ((newValue: unknown, oldValue: unknown) => void)[]> = new Map();

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'cognitience-ss-config.json');
    this.data = this.load();
  }

  private load(): Record<string, unknown> {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch (err) {
      console.error('[ConfigStore] Failed to load config, using defaults:', err);
    }
    return { ...DEFAULT_CONFIG };
  }

  private save(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[ConfigStore] Failed to save config:', err);
    }
  }

  get<T = unknown>(key: string): T {
    return this.data[key] as T;
  }

  set(key: string, value: unknown): void {
    const oldValue = this.data[key];
    this.data[key] = value;
    this.save();
    const callbacks = this.watchers.get(key);
    if (callbacks) {
      for (const cb of callbacks) {
        cb(value, oldValue);
      }
    }
  }

  getAll(): Record<string, unknown> {
    return { ...this.data };
  }

  has(key: string): boolean {
    return key in this.data;
  }

  delete(key: string): void {
    delete this.data[key];
    this.save();
  }

  reset(key: string): void {
    if (key in DEFAULT_CONFIG) {
      this.data[key] = DEFAULT_CONFIG[key];
      this.save();
    }
  }

  resetAll(): void {
    this.data = { ...DEFAULT_CONFIG };
    this.save();
  }

  watch(key: string, callback: (newValue: unknown, oldValue: unknown) => void): void {
    if (!this.watchers.has(key)) {
      this.watchers.set(key, []);
    }
    this.watchers.get(key)!.push(callback);
  }
}
