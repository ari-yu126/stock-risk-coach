const SETTINGS_KEY = 'stock-risk-coach.notifications.v1';
const DEBOUNCE_KEY  = 'stock-risk-coach.notif-debounce.v1';
const DEBOUNCE_MS   = 30 * 60 * 1000; // 30 minutes

export interface NotificationSettings {
  enabled: boolean;
}

export function getNotificationSettings(): NotificationSettings {
  if (typeof window === 'undefined') return { enabled: false };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { enabled: false };
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return { enabled: false };
    return { enabled: Boolean((parsed as Record<string, unknown>).enabled) };
  } catch {
    return { enabled: false };
  }
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // localStorage unavailable — non-fatal
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function notificationPermissionState(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

function readDebounceMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DEBOUNCE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as Record<string, number>;
  } catch {
    return {};
  }
}

function writeDebounceMap(map: Record<string, number>): void {
  try {
    localStorage.setItem(DEBOUNCE_KEY, JSON.stringify(map));
  } catch {
    // non-fatal
  }
}

export function sendWatchlistNotification(ticker: string, name: string, judgment: string): void {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const now = Date.now();
  const map = readDebounceMap();
  if (map[ticker] && now - map[ticker] < DEBOUNCE_MS) return;

  map[ticker] = now;
  writeDebounceMap(map);

  new Notification(`단타코치 — ${name}`, {
    body: `${judgment} 신호가 감지됐어요. 오늘 눈여겨볼 만해요.`,
    icon: '/favicon.ico',
  });
}
