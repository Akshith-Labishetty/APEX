// Persistent lap-time leaderboard (localStorage).
const KEY = 'f1-monte-carlo-leaderboard-v1';
const MAX_ENTRIES = 25;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((e) => e && typeof e.ms === 'number' && e.ms > 0)
      .sort((a, b) => a.ms - b.ms);
  } catch {
    return [];
  }
}

function save(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
  } catch {
    /* storage unavailable — leaderboard just won't persist */
  }
}

/** Add a lap. Returns 1-based rank, or -1 if it didn't make the board. */
export function add(name, ms) {
  const list = load();
  const entry = { name: (name || 'PLAYER').slice(0, 12), ms, date: Date.now() };
  list.push(entry);
  list.sort((a, b) => a.ms - b.ms);
  save(list);
  const rank = list.indexOf(entry);
  return rank < MAX_ENTRIES && rank < 10 ? rank + 1 : -1;
}

export function best() {
  const list = load();
  return list.length ? list[0].ms : null;
}

export function clear() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function top(n = 10) {
  return load().slice(0, n);
}
