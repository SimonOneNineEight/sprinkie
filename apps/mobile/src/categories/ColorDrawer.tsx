import { useEffect, useState } from 'react';
import { Alert, Modal, PanResponder, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { forgetColorRecent, listColorRecents } from '../api/client';
import { CategoryIcon } from '../calendar/CategoryIcon';
import { useStrings } from '../i18n/AppLanguageProvider';
import { Pressable } from '../theme/press';
import { createStyles } from '../theme';
import type { Hsl } from './colorDerivation';
import { hexToHsl, hslToHex } from './colorDerivation';

type Props = {
  accessToken: string;
  /** The color the drawer opens on. */
  initialColor: string;
  /** The user's current category colors, for the live preview. */
  existingColors: string[];
  /** Glyph for the side-by-side chip; the edited category's icon. */
  icon?: string;
  onCancel: () => void;
  /**
   * Fired with the committed hex. Saving the color as a recent is the
   * caller's job once the category actually persists — a confirmed drawer
   * on a canceled sheet is not a "used" color.
   */
  onConfirm: (hex: string) => void;
};

// The saturation/lightness field and hue strip render as cell grids (pure RN,
// no gradient dependency); at these cell sizes they read as continuous.
const FIELD_COLS = 16;
const FIELD_ROWS = 10;
const HUE_SEGMENTS = 24;

// The canvas's area mapping: x is saturation, y is lightness scaled by
// saturation (l tops out at 1 - s/2), lightness clamped to 4..96%.
function areaColor(h: number, x: number, y: number): Hsl {
  const s = x;
  const l = Math.max(0.04, Math.min(0.96, (1 - y) * (1 - s / 2)));
  return { h, s, l };
}

/**
 * The custom color drawer (#11, canvas artboard): a free
 * saturation/lightness area with a hue strip beneath — brighter and darker
 * than the presets is allowed; the live preview card is the guardrail, not a
 * clamp. Saved custom colors (已存的顏色) ride above the area; the presets
 * stay outside on the picker grid.
 */
export function ColorDrawer({
  accessToken,
  initialColor,
  existingColors,
  icon = 'tag',
  onCancel,
  onConfirm,
}: Props) {
  const strings = useStrings();
  // HSL floats are the working truth; hexToHsl/hslToHex round-trip exactly
  // (colorDerivation.test.ts), so tapping a saved color lands on its hex.
  const [hsl, setHsl] = useState<Hsl>(() => hexToHsl(initialColor));
  const [recents, setRecents] = useState<string[]>([]);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [hueWidth, setHueWidth] = useState(0);
  const color = hslToHex(hsl);

  useEffect(() => {
    let active = true;
    listColorRecents(accessToken)
      .then((list) => {
        if (active) setRecents(list.colors);
      })
      .catch(() => undefined); // The row just stays empty offline.
    return () => {
      active = false;
    };
  }, [accessToken]);

  // Forgetting a Saved Color (#47, ratified 2026-09-12): a long-press, then
  // the same Alert that guards deleting a Photo, an Entry or a Category, so
  // no color is lost by brushing the row. The row is state here, so it
  // closes the gap without the drawer being reopened.
  const confirmForget = (saved: string) => {
    Alert.alert(strings.colorDrawer.forgetConfirmTitle, strings.colorDrawer.forgetConfirmBody, [
      { text: strings.entryForm.cancel, style: 'cancel' },
      {
        text: strings.colorDrawer.forget,
        style: 'destructive',
        onPress: () => {
          forgetColorRecent(accessToken, saved)
            .then(() => setRecents((prev) => prev.filter((hex) => hex !== saved)))
            .catch(() => Alert.alert(strings.colorDrawer.forgetFailed));
        },
      },
    ]);
  };

  const pickFromArea = (x: number, y: number) => {
    if (area.width <= 0 || area.height <= 0) return;
    const fx = Math.min(1, Math.max(0, x / area.width));
    const fy = Math.min(1, Math.max(0, y / area.height));
    setHsl(areaColor(hsl.h, fx, fy));
  };
  const pickHue = (x: number) => {
    if (hueWidth <= 0) return;
    const fraction = Math.min(1, Math.max(0, x / hueWidth));
    setHsl({ ...hsl, h: Math.round(fraction * 360) % 360 });
  };
  // Recreated per render on purpose: the handlers only read the event's
  // location, never gesture state, so a mid-drag re-render is harmless.
  const areaResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) =>
      pickFromArea(event.nativeEvent.locationX, event.nativeEvent.locationY),
    onPanResponderMove: (event) =>
      pickFromArea(event.nativeEvent.locationX, event.nativeEvent.locationY),
  });
  const hueResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => pickHue(event.nativeEvent.locationX),
    onPanResponderMove: (event) => pickHue(event.nativeEvent.locationX),
  });

  const stepSaturation = (delta: number) => {
    const s = Math.min(1, Math.max(0, hsl.s + delta));
    setHsl({ h: hsl.h, s, l: Math.max(0.04, Math.min(hsl.l, (1 - s / 2) * 0.96)) });
  };
  const stepLightness = (delta: number) => {
    const l = Math.max(0.04, Math.min(0.96, Math.min(hsl.l + delta, 1 - hsl.s / 2)));
    setHsl({ ...hsl, l });
  };

  // Knob positions per the canvas formulas.
  const knobLeft = `${hsl.s * 100}%` as const;
  const knobTop = `${Math.min(100, Math.max(0, 100 - (hsl.l / (1 - hsl.s / 2)) * 100))}%` as const;
  const hueLeft = `${(hsl.h / 360) * 100}%` as const;

  return (
    <Modal transparent animationType="slide" onRequestClose={onCancel}>
      {/* The hex field is the last row of the sheet, so the whole drawer rises
          and the picker above it stays in view (#42; #45 user story 22).
          Unlike the category editor this sheet has no maxHeight and no
          scrolling body, so on a short screen rising can run its header off
          the top. Left alone deliberately: wrapping a PanResponder area in a
          ScrollView risks the drag being stolen from the color field (CD.2),
          and nothing here can test either. KB.12 decides it on a device. */}
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={strings.entryForm.cancel}
          feedback="none"
          style={styles.scrim}
          onPress={onCancel}
        />
        <View style={styles.sheet}>
          <View style={styles.header}>
            {/* Absolutely spanned first child: the title centers on the
                sheet, not on the gap between the unequal side buttons. */}
            <Text style={styles.headerTitle}>{strings.colorDrawer.custom}</Text>
            <Pressable accessibilityRole="button" style={styles.headerButton} onPress={onCancel}>
              <Text style={styles.headerCancel}>{strings.entryForm.cancel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.headerConfirm}
              onPress={() => onConfirm(color)}
            >
              <Text style={styles.headerConfirmLabel}>{strings.categories.done}</Text>
            </Pressable>
          </View>

          <View style={styles.body}>
            {recents.length > 0 ? (
              <View>
                <Text style={styles.sectionHeader}>{strings.colorDrawer.saved}</Text>
                <View style={styles.savedRow}>
                  {recents.map((saved) => (
                    <Pressable
                      key={saved}
                      accessibilityRole="button"
                      accessibilityLabel={saved}
                      style={[styles.savedRing, saved === color && styles.savedRingSelected]}
                      onPress={() => setHsl(hexToHsl(saved))}
                      onLongPress={() => confirmForget(saved)}
                    >
                      <View style={[styles.savedSwatch, { backgroundColor: saved }]} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={strings.colorDrawer.areaLabel}
              accessibilityValue={{ min: 0, max: 100, now: Math.round(hsl.s * 100) }}
              accessibilityActions={[
                { name: 'increment' },
                { name: 'decrement' },
                { name: 'lighter', label: strings.colorDrawer.lighter },
                { name: 'darker', label: strings.colorDrawer.darker },
              ]}
              onAccessibilityAction={(event) => {
                const action = event.nativeEvent.actionName;
                if (action === 'increment') stepSaturation(0.05);
                else if (action === 'decrement') stepSaturation(-0.05);
                else if (action === 'lighter') stepLightness(0.05);
                else if (action === 'darker') stepLightness(-0.05);
              }}
              style={styles.area}
              onLayout={(event) => setArea(event.nativeEvent.layout)}
              {...areaResponder.panHandlers}
            >
              <View style={styles.fieldRows} pointerEvents="none">
                {Array.from({ length: FIELD_ROWS }, (_, row) => (
                  <View key={row} style={styles.fieldRow}>
                    {Array.from({ length: FIELD_COLS }, (_, col) => (
                      <View
                        key={col}
                        style={[
                          styles.fieldCell,
                          {
                            backgroundColor: hslToHex(
                              areaColor(hsl.h, (col + 0.5) / FIELD_COLS, (row + 0.5) / FIELD_ROWS),
                            ),
                          },
                        ]}
                      />
                    ))}
                  </View>
                ))}
              </View>
              <View
                pointerEvents="none"
                style={[styles.knob, { left: knobLeft, top: knobTop, backgroundColor: color }]}
              />
            </View>

            <View
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={strings.colorDrawer.hue}
              accessibilityValue={{ min: 0, max: 360, now: Math.round(hsl.h) }}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === 'increment') {
                  setHsl({ ...hsl, h: (hsl.h + 15) % 360 });
                } else if (event.nativeEvent.actionName === 'decrement') {
                  setHsl({ ...hsl, h: (hsl.h + 345) % 360 });
                }
              }}
              style={styles.hueStrip}
              onLayout={(event) => setHueWidth(event.nativeEvent.layout.width)}
              {...hueResponder.panHandlers}
            >
              <View style={styles.hueSegments} pointerEvents="none">
                {Array.from({ length: HUE_SEGMENTS }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.hueSegment,
                      { backgroundColor: hslToHex({ h: (i * 360) / HUE_SEGMENTS, s: 1, l: 0.5 }) },
                    ]}
                  />
                ))}
              </View>
              <View
                pointerEvents="none"
                style={[
                  styles.hueKnob,
                  { left: hueLeft, backgroundColor: hslToHex({ h: hsl.h, s: 0.9, l: 0.5 }) },
                ]}
              />
            </View>

            <PreviewCard
              color={color}
              existingColors={existingColors}
              icon={icon}
              onPickHex={(hex) => setHsl(hexToHsl(hex))}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// The canvas preview card: one real week of numerals with the chosen color
// dropped in as live dots, then the side-by-side row against the user's
// existing category colors, with the hex readout — tappable (#29): a typed
// or pasted #RRGGBB, with or without the #, jumps the picker to that color.
function PreviewCard({
  color,
  existingColors,
  icon,
  onPickHex,
}: {
  color: string;
  existingColors: string[];
  icon: string;
  onPickHex: (hex: string) => void;
}) {
  const strings = useStrings();
  const [hexOpen, setHexOpen] = useState(false);
  const [hexText, setHexText] = useState('');
  const existing = existingColors.length > 0 ? existingColors : [color];
  const at = (i: number) => existing[i % existing.length];
  // Days 11–17 per the canvas; the chosen color leads on two of them.
  const week = [11, 12, 13, 14, 15, 16, 17].map((day, i) => ({
    day,
    dots:
      i === 3 || i === 5
        ? ['chosen' as const, at(i), at(i + 1)]
        : [at(i), at(i + 2), at(i + 4)].slice(0, (i % 3) + 1),
  }));

  return (
    <View style={styles.previewCard}>
      <Text style={styles.sectionHeader}>{strings.colorDrawer.previewTitle}</Text>
      <View style={styles.previewWeek}>
        {week.map(({ day, dots }) => (
          <View key={day} style={styles.previewDay}>
            <Text style={styles.previewNumeral}>{day}</Text>
            <View style={styles.previewDots}>
              {dots.map((dot, dotIndex) =>
                dot === 'chosen' ? (
                  <View
                    key={dotIndex}
                    testID="preview-dot-chosen"
                    style={[styles.previewDot, { backgroundColor: color }]}
                  />
                ) : (
                  <View
                    key={dotIndex}
                    testID="preview-dot-existing"
                    style={[styles.previewDot, { backgroundColor: dot }]}
                  />
                ),
              )}
            </View>
          </View>
        ))}
      </View>
      <View style={styles.previewDivider} />
      <Text style={styles.sectionHeader}>{strings.colorDrawer.sideBySide}</Text>
      <View style={styles.sideBySideRow}>
        <CategoryIcon icon={icon} color={color} size={28} />
        <View style={styles.sideBySideDots}>
          {existingColors.slice(0, 5).map((existingColor, i) => (
            <View key={i} style={[styles.previewDot, { backgroundColor: existingColor }]} />
          ))}
          <View style={styles.chosenRing}>
            <View style={[styles.previewDot, { backgroundColor: color }]} />
          </View>
        </View>
        {hexOpen ? (
          <TextInput
            testID="hex-input"
            accessibilityLabel={strings.colorDrawer.hexLabel}
            style={styles.hexInput}
            autoFocus
            selectTextOnFocus
            autoCapitalize="characters"
            autoCorrect={false}
            // Seven: six digits plus the optional leading #. A hex is never
            // longer, and without the cap the field accepts characters that
            // can only ever fail the match below, so typing past six looks
            // like the field has stopped working.
            maxLength={7}
            value={hexText}
            onChangeText={(text) => {
              setHexText(text);
              // Anything but a complete hex is ignored quietly.
              const match = text.trim().match(/^#?([0-9a-fA-F]{6})$/);
              if (match) onPickHex(`#${match[1].toUpperCase()}`);
            }}
            onBlur={() => setHexOpen(false)}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={strings.colorDrawer.hexLabel}
            onPress={() => {
              setHexText(color);
              setHexOpen(true);
            }}
          >
            <Text style={styles.hexReadout}>{color}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = createStyles((t) => ({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: t.colors.scrim,
  },
  sheet: {
    backgroundColor: t.colors.background,
    borderTopLeftRadius: t.radius.sheet,
    borderTopRightRadius: t.radius.sheet,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.spacing.space4,
    padding: t.spacing.space4,
    backgroundColor: t.colors.materialBar,
    borderBottomWidth: t.border.hairline,
    borderBottomColor: t.colors.lineSeparator,
  },
  headerButton: {
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: t.spacing.space4,
  },
  headerCancel: {
    ...t.typography.entryTitle,
    color: t.colors.controlGhostFg,
  },
  headerTitle: {
    ...t.typography.sectionHeader,
    color: t.colors.textPrimary,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  headerConfirm: {
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: t.spacing.space5,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.controlPrimaryBg,
  },
  headerConfirmLabel: {
    ...t.typography.entryTitle,
    color: t.colors.controlPrimaryFg,
  },
  body: {
    paddingTop: t.spacing.space6,
    paddingHorizontal: t.spacing.screenGutter,
    paddingBottom: 28,
    gap: t.spacing.space6,
  },
  sectionHeader: {
    ...t.typography.meta,
    color: t.colors.textTertiary,
    marginBottom: t.spacing.space4,
    marginLeft: t.spacing.space1,
  },
  savedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: t.spacing.space5,
  },
  savedRing: {
    width: 30,
    height: 30,
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: t.colors.background,
    padding: 2,
  },
  savedRingSelected: {
    borderColor: t.colors.textPrimary,
  },
  savedSwatch: {
    flex: 1,
    borderRadius: t.radius.pill,
  },
  area: {
    height: 148,
    borderRadius: t.radius.card,
    overflow: 'hidden',
  },
  fieldRows: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fieldRow: {
    flex: 1,
    flexDirection: 'row',
  },
  fieldCell: {
    flex: 1,
  },
  knob: {
    position: 'absolute',
    width: 22,
    height: 22,
    marginLeft: -11,
    marginTop: -11,
    borderRadius: t.radius.pill,
    borderWidth: 2,
    borderColor: t.colors.textOnDark,
    shadowColor: t.colors.textPrimary,
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  hueStrip: {
    height: 12,
    borderRadius: t.radius.pill,
    justifyContent: 'center',
  },
  hueSegments: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    borderRadius: t.radius.pill,
    overflow: 'hidden',
  },
  hueSegment: {
    flex: 1,
  },
  hueKnob: {
    position: 'absolute',
    width: 20,
    height: 20,
    marginLeft: -10,
    borderRadius: t.radius.pill,
    borderWidth: 2,
    borderColor: t.colors.textOnDark,
    shadowColor: t.colors.textPrimary,
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  previewCard: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.card,
    padding: t.spacing.cardPadding,
  },
  previewWeek: {
    flexDirection: 'row',
    marginBottom: t.spacing.space5,
  },
  previewDay: {
    flex: 1,
    alignItems: 'center',
    gap: t.spacing.space3,
  },
  previewNumeral: {
    ...t.typography.dayNumeral,
    color: t.colors.textPrimary,
  },
  previewDots: {
    flexDirection: 'row',
    gap: t.dot.gap,
    minHeight: t.dot.size,
  },
  previewDot: {
    width: t.dot.size,
    height: t.dot.size,
    borderRadius: t.radius.pill,
  },
  previewDivider: {
    height: t.border.hairline,
    backgroundColor: t.colors.lineSeparator,
    marginBottom: t.spacing.space5,
  },
  sideBySideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.space5,
  },
  sideBySideDots: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chosenRing: {
    padding: 2.5,
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: t.colors.textPrimary,
    backgroundColor: t.colors.surface,
  },
  hexReadout: {
    ...t.typography.meta,
    color: t.colors.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  // Padding-based sizing like subInput: no forced height, natural line box.
  // Not singleLineField: this is a compact readout sitting in a row of dots,
  // sized to them rather than to the 44pt hit target.
  hexInput: {
    fontSize: t.typography.meta.fontSize,
    color: t.colors.textPrimary,
    fontVariant: ['tabular-nums'],
    backgroundColor: t.colors.background,
    borderRadius: t.radius.r2,
    borderWidth: t.border.hairline,
    borderColor: t.colors.lineField,
    paddingHorizontal: t.spacing.space3,
    paddingVertical: t.spacing.space1,
    minWidth: 84,
  },
}));
