import { Alert } from 'react-native';

// TEMPORARY (#93): per-step timings for attaching and saving photos, shown in
// an alert to one account only, so the PM never sees it. The follow-up OTA
// deletes this file and every call to it once the numbers are in.
//
// Each line is a step's start→end in ms since the attach or save began, so
// overlapping lines show how the photos ran side by side. The picker itself
// cannot be timed from here: the clock starts when it hands the photos back,
// and any gap against a stopwatch is the picker's.
//
// The gate compares an FNV-1a hash of the token's email claim, so the
// measuring account's address (an Apple relay) never sits in this public repo
// or the shipped bundle. Two accounts exist; a 32-bit hash tells them apart.
const MEASURING_EMAIL_HASH = '58b64d98';

let origin = 0;
const lines: string[] = [];

export function startTimings() {
  origin = Date.now();
  lines.length = 0;
}

export async function timed<T>(label: string, step: () => Promise<T>): Promise<T> {
  const start = Date.now() - origin;
  try {
    return await step();
  } finally {
    lines.push(`${label}  ${start}→${Date.now() - origin}`);
  }
}

/** The signed-in user's email, read from the access token's claims. */
function emailOf(accessToken: string): string | undefined {
  try {
    const payload = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))).email;
  } catch {
    return undefined;
  }
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (const char of text) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function showTimings(title: string, accessToken: string) {
  const email = emailOf(accessToken);
  if (email === undefined || fnv1a(email.toLowerCase()) !== MEASURING_EMAIL_HASH) return;
  Alert.alert(title, [`total ${Date.now() - origin}ms`, ...lines].join('\n'));
}
