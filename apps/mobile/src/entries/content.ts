// The Entry content codec. Title and note travel and rest as ONE opaque,
// versioned blob the server never parses (ADR-0004): v1 is plain JSON, and
// E2EE later is a new version whose payload is ciphertext — a client-side
// re-encode, not a server migration.
export type EntryContent = { title: string; note: string };

export function encodeContent(content: EntryContent): string {
  return JSON.stringify({ v: 1, title: content.title, note: content.note });
}

/** Returns null when the blob is not a readable v1 payload. */
export function decodeContent(blob: string): EntryContent | null {
  try {
    const parsed = JSON.parse(blob) as { v?: unknown; title?: unknown; note?: unknown };
    if (parsed.v !== 1 || typeof parsed.title !== 'string') {
      return null;
    }
    return { title: parsed.title, note: typeof parsed.note === 'string' ? parsed.note : '' };
  } catch {
    return null;
  }
}

// The title never holds a newline (#115): a line break pasted in, or
// carried by an older title (the PM's journal was imported from Numbers,
// whose cells can hold one), becomes a space. A restored Draft decodes
// through the same initial title, so it is cleaned too.
export function oneLine(text: string) {
  return text.replace(/\r\n|[\r\n\u2028\u2029]/g, ' ');
}
