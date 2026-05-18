import type { Portfolio, Trade } from '../types';
import { DEFAULT_TRADE_CONFIG } from './defaults';

// ── Abstraction boundary ───────────────────────────────────────────────────────
// Swap in a Supabase or SQLite adapter by implementing this interface.

export interface PaperTradingStore {
  loadPortfolio(): Portfolio;
  savePortfolio(p: Portfolio): void;
  loadTrades(): Trade[];
  appendTrade(t: Trade): void;
  updateTrade(id: string, updates: Partial<Trade>): void;
  clearAll(): void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const KEY_PORTFOLIO = 'stock-risk-coach.paper-trading.portfolio.v1';
const KEY_TRADES    = 'stock-risk-coach.paper-trading.trades.v1';

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full — non-fatal
  }
}

// ── localStorage adapter ──────────────────────────────────────────────────────

export function createLocalStorageStore(): PaperTradingStore {
  const store: PaperTradingStore = {
    loadPortfolio(): Portfolio {
      return safeGet<Portfolio>(KEY_PORTFOLIO, {
        cash: DEFAULT_TRADE_CONFIG.initialCash,
        config: DEFAULT_TRADE_CONFIG,
        lastUpdatedAt: Date.now(),
      });
    },

    savePortfolio(p: Portfolio): void {
      safeSet(KEY_PORTFOLIO, { ...p, lastUpdatedAt: Date.now() });
    },

    loadTrades(): Trade[] {
      return safeGet<Trade[]>(KEY_TRADES, []);
    },

    appendTrade(t: Trade): void {
      const trades = store.loadTrades();
      safeSet(KEY_TRADES, [...trades, t]);
    },

    updateTrade(id: string, updates: Partial<Trade>): void {
      const trades = store.loadTrades();
      const idx = trades.findIndex((t) => t.id === id);
      if (idx === -1) return;
      trades[idx] = { ...trades[idx], ...updates };
      safeSet(KEY_TRADES, trades);
    },

    clearAll(): void {
      if (typeof window === 'undefined') return;
      try {
        localStorage.removeItem(KEY_PORTFOLIO);
        localStorage.removeItem(KEY_TRADES);
      } catch { /* non-fatal */ }
    },
  };
  return store;
}
