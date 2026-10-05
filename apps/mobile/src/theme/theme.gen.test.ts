import { theme } from './theme.gen';

// Expected values come straight from design/tokens/*.css, the single source
// of truth. If a token changes there, the generator rerun changes theme.gen.ts
// and this spec must be updated deliberately.
describe('generated theme', () => {
  it('resolves semantic colors through var() indirection', () => {
    expect(theme.colors.background).toBe('#FAF7F2'); // --background: var(--paper)
    expect(theme.colors.surface).toBe('#FFFFFF');
    expect(theme.colors.textPrimary).toBe('#514A45'); // var(--ink)
    expect(theme.colors.textDestructive).toBe('#A33A2E');
    expect(theme.colors.scrim).toBe('rgba(40, 34, 30, 0.28)');
    expect(theme.colors.focusRing).toBe('#514A45');
  });

  // The ink is the action color too: primary controls are the ink, and the
  // brand's soft button is the secondary half of the pair (DESIGN.md § Color).
  it('gives primary controls the ink and secondary the soft button', () => {
    expect(theme.colors.controlPrimaryBg).toBe('#514A45');
    expect(theme.colors.controlPrimaryFg).toBe('#FFFFFF');
    expect(theme.colors.controlSecondaryBg).toBe('#D8D1C5');
    expect(theme.colors.surfaceToday).toBe('#514A45');
  });

  it('does not expose raw neutrals as semantic tokens', () => {
    const keys = Object.keys(theme.colors);
    expect(keys).not.toContain('white');
    expect(keys).not.toContain('black');
    expect(keys.some((k) => k.startsWith('grey'))).toBe(false);
  });

  it('carries the 10 category presets with tint and ink companions', () => {
    expect(Object.keys(theme.categories)).toEqual([
      'clay',
      'orange',
      'ochre',
      'green',
      'eucalyptus',
      'blue',
      'indigo',
      'violet',
      'pink',
      'brown',
    ]);
    expect(theme.categories.clay).toEqual({
      base: '#D56E5C',
      tint: '#FAECEA',
      ink: '#954D40',
    });
    expect(theme.categories.brown.ink).toBe('#725843');
  });

  it('carries dot geometry and year-box values', () => {
    expect(theme.dot).toEqual({ size: 7, sizeCompact: 6, sizeList: 10, gap: 0, maxPerDay: 4 });
    expect(theme.yearBox).toEqual({ size: 11, radius: 3 });
  });

  it('carries spacing and radii as numbers', () => {
    expect(theme.spacing.space6).toBe(16);
    expect(theme.spacing.screenGutter).toBe(16);
    expect(theme.spacing.rowHeight).toBe(44);
    expect(theme.spacing.fabSize).toBe(56);
    expect(theme.radius.card).toBe(12);
    expect(theme.radius.pill).toBe(999);
    expect(theme.border.hairline).toBe(1);
  });

  it('decomposes type roles into RN text styles with CJK line heights and zero tracking', () => {
    expect(theme.typography.entryTitle).toEqual({
      fontSize: 17,
      lineHeight: 24,
      fontWeight: '400',
      letterSpacing: 0,
    });
    expect(theme.typography.navTitle).toEqual({
      fontSize: 28,
      lineHeight: 36,
      fontWeight: '600',
      letterSpacing: 0,
    });
    // Day and year numeral roles use literal line heights in the token file.
    expect(theme.typography.dayNumeral.lineHeight).toBe(18);
    expect(theme.typography.dayNumeralStrong.fontWeight).toBe('600');
    expect(theme.typography.yearNumeral).toEqual({
      fontSize: 8,
      lineHeight: 8,
      fontWeight: '400',
      letterSpacing: 0,
    });
    // Every role tracks at zero: Han characters take no optical tracking.
    for (const role of Object.values(theme.typography)) {
      expect(role.letterSpacing).toBe(0);
    }
  });
});
