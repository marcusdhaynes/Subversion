// Uniform auto-update system — shared update-check module.
// See updates/UPDATES_SPEC.md for the full spec. Identical design in every app.

export const GITHUB_OWNER = 'marcusdhaynes';
export const GITHUB_REPO = 'Subversion';
/** Current app version, from package.json at rollout time. 'unknown' if the repo has none. */
export const CURRENT_VERSION = '0.0.0';
export const LATEST_RELEASE_URL =
  `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

export interface UpdateInfo {
  version: string; // semver without leading "v", e.g. "2.4.0"
  tag: string;
  notes: string;
  htmlUrl: string;
  assetUrl: string | null;
}

export function parseSemver(raw: string): [number, number, number] | null {
  const m = raw.trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** >0 if a>b, <0 if a<b, 0 if equal, null if either is unparseable. */
export function compareSemver(a: string, b: string): number | null {
  const pa = parseSemver(a); const pb = parseSemver(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const c = compareSemver(candidate, current);
  // With no known current version, any parseable release counts as available.
  return c === null ? parseSemver(candidate) !== null && current === 'unknown' : c > 0;
}

const dismissedKey = (version: string) => `updates:dismissed:${version}`;
export function isDismissed(version: string): boolean {
  try { return localStorage.getItem(dismissedKey(version)) === '1'; } catch { return false; }
}
export function dismissVersion(version: string): void {
  try { localStorage.setItem(dismissedKey(version), '1'); } catch { /* storage unavailable */ }
}

export async function fetchLatestRelease(): Promise<UpdateInfo | null> {
  const res = await fetch(LATEST_RELEASE_URL, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) return null;
  const data: any = await res.json();
  const tag = String(data?.tag_name ?? '');
  const parsed = parseSemver(tag);
  if (!parsed) return null;
  const assets: any[] = Array.isArray(data?.assets) ? data.assets : [];
  const asset = assets.find((a) => typeof a?.browser_download_url === 'string');
  return {
    version: parsed.join('.'),
    tag,
    notes: String(data?.body ?? ''),
    htmlUrl: String(data?.html_url ?? `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`),
    assetUrl: asset ? String(asset.browser_download_url) : null,
  };
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const latest = await fetchLatestRelease().catch(() => null);
  return latest && isNewerVersion(latest.version, CURRENT_VERSION) ? latest : null;
}

/**
 * Execute the update: open the release asset (download/install/swap; Android
 * APKs still need the user's install tap), falling back to the release page.
 * Web builds reload afterwards so the new build takes over.
 */
export function applyUpdate(info: UpdateInfo): void {
  const target = info.assetUrl ?? info.htmlUrl;
  try { window.open(target, '_blank', 'noopener'); } catch { /* noop */ }
  if (!info.assetUrl && typeof location !== 'undefined') location.reload();
}
