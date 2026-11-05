import type { Theme } from './theme.gen';

type TypographyToken = Theme['typography'][keyof Theme['typography']];

/**
 * A single-line TextInput's sizing, from the typography token it reads as
 * (#42).
 *
 * Two things go wrong when a field is built by spreading the token into a
 * fixed height. The token carries a `lineHeight`, which shifts an iOS
 * TextInput off its baseline and clips the CJK glyph; the fixed height
 * top-anchors the placeholder inside it. So this takes the token apart: every
 * property except `lineHeight`, over a floor rather than a ceiling — the 44pt
 * hit target, which is also where the text grows when the system scales it.
 *
 * Pass the token here rather than spreading it, and neither mistake is
 * available to make.
 *
 * First found on the entry form's subcategory field (Simon, 2026-08-19, two
 * rounds); PM round 2 item 14 found it again on the category search. The
 * compact inline fields — that subcategory pill, and the color drawer's hex
 * readout — deliberately do not use this. They are already built the right way
 * and are sized to the controls beside them, not to the hit target. Nor does
 * the entry form's title since #115: it wraps, so it is a multiline input,
 * which iOS lays out as a text view rather than the text field this guards.
 */
export function singleLineField(t: Theme, token: TypographyToken) {
  const { lineHeight, ...rest } = token;
  return { ...rest, minHeight: t.spacing.rowHeight } as const;
}
