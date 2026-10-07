export function loadStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`brewdesk_${key}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error(`Error loading storage key ${key}:`, err);
  }
  return fallback;
}

export function saveStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`brewdesk_${key}`, JSON.stringify(value));
  } catch (err) {
    console.error(`Error saving storage key ${key}:`, err);
  }
}
