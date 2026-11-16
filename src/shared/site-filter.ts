// Pure helpers for per-site disabling (ADR-005). No chrome API here.

/** Hostname в нижнем регистре без ведущего `www.`; `null` для не-http(s) и невалидных URL. */
export function normalizeHost(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (!parsed.hostname) return null;
  return parsed.hostname.toLowerCase().replace(/^www\./, '');
}

/** True, если host из `url` равен записи списка или является её поддоменом. */
export function isSiteDisabled(url: string, disabledSites: readonly string[] | undefined): boolean {
  const host = normalizeHost(url);
  if (host === null || !disabledSites?.length) return false;
  return disabledSites.some((entry) => host === entry || host.endsWith('.' + entry));
}

/** Новый список: добавляет `host` (без дублей, отсортировано) или удаляет его. Не мутирует вход. */
export function setSiteDisabled(disabledSites: readonly string[] | undefined, host: string, disabled: boolean): string[] {
  const set = new Set(disabledSites ?? []);
  if (disabled) set.add(host);
  else set.delete(host);
  return [...set].sort();
}
