/* eslint-disable */
/**
 * THROWAWAY PROTOTYPE for the phase 2 Reminder invite (onboarding page 5).
 * Lives only on the `prototype/reminder` branch and never merges. It exists
 * so Simon can pick a look for the first-save line and the invite sheet on
 * the simulator; the real implementation is written fresh from the chosen
 * variant. In dev every save from the entry form plays the sequence, and the
 * floating pill cycles the variant and replays it, so no save is needed. 設定提醒 only closes the
 * sheet here: no permission prompt, nothing scheduled.
 */
import DateTimePicker from '@react-native-community/datetimepicker';
import { Bell } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Text, View } from 'react-native';

import { Pressable } from '../theme/press';
import { createStyles, theme } from '../theme';

export type Variant = 'A' | 'B' | 'C';
const VARIANTS: Variant[] = ['A', 'B', 'C'];
const NAMES: Record<Variant, string> = {
  A: 'A · bell + compact time row',
  B: 'B · inline wheel',
  C: 'C · big time, tap to change',
};

const TITLE = '要不要每天提醒你記一行？';
const BODY = '選個喜歡的時間，偶爾忙到忘記也沒關係。';
const FIRST_SAVE_LINE = '第一個生活片段，收藏好了。';

function defaultTime() {
  const d = new Date();
  d.setHours(21, 0, 0, 0);
  return d;
}

function hhmm(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Plays the first-save line, then the invite, over the month view. */
export function ReminderInvitePrototype({ play, onFinished }: { play: number; onFinished: () => void }) {
  const [variant, setVariant] = useState<Variant>('A');
  const [phase, setPhase] = useState<'idle' | 'line' | 'sheet'>('idle');
  const [time, setTime] = useState(defaultTime);
  const opacity = useRef(new Animated.Value(0)).current;

  const replay = () => {
    setTime(defaultTime());
    setPhase('line');
    opacity.setValue(0);
    // The month has just gained today's color; let it be seen first, then the
    // line, then the sheet.
    Animated.sequence([
      Animated.delay(600),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start(() => setPhase('sheet'));
  };

  useEffect(() => {
    if (play !== 0) replay();
  }, [play]);

  const close = () => {
    setPhase('idle');
    onFinished();
  };

  const cycle = () => {
    setVariant(VARIANTS[(VARIANTS.indexOf(variant) + 1) % VARIANTS.length]);
    replay();
  };

  return (
    <>
      {phase === 'line' ? (
        <Animated.View pointerEvents="none" style={[styles.lineHolder, { opacity }]}>
          <View style={styles.line}>
            <Text style={styles.lineText}>{FIRST_SAVE_LINE}</Text>
          </View>
        </Animated.View>
      ) : null}
      <Pressable style={styles.switcher} onPress={cycle} accessibilityRole="button">
        <Text style={styles.switcherText}>{NAMES[variant]} ↻</Text>
      </Pressable>
      {phase === 'sheet' ? (
        <Modal transparent animationType="slide" onRequestClose={close}>
          <View style={styles.overlay}>
            <Pressable feedback="none" style={styles.scrim} onPress={close} accessibilityRole="button" />
            <View style={styles.sheet}>
              {variant === 'A' ? <SheetA time={time} setTime={setTime} onDone={close} /> : null}
              {variant === 'B' ? <SheetB time={time} setTime={setTime} onDone={close} /> : null}
              {variant === 'C' ? <SheetC time={time} setTime={setTime} onDone={close} /> : null}
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

type SheetProps = { time: Date; setTime: (d: Date) => void; onDone: () => void };

function picker(time: Date, setTime: (d: Date) => void, display: 'compact' | 'spinner') {
  return (
    <DateTimePicker
      value={time}
      mode="time"
      display={display}
      locale="zh-TW"
      minuteInterval={5}
      themeVariant="light"
      accentColor={theme.colors.ink}
      textColor={theme.colors.textPrimary}
      onChange={(_, d) => d && setTime(d)}
    />
  );
}

function SheetA({ time, setTime, onDone }: SheetProps) {
  return (
    <View style={styles.bodyCentered}>
      <View style={styles.bellCircle}>
        <Bell size={24} color={theme.colors.iconDefault} strokeWidth={1.75} />
      </View>
      <Text style={styles.titleCentered}>{TITLE}</Text>
      <Text style={styles.copyCentered}>{BODY}</Text>
      <View style={styles.timeRow}>
        <Text style={styles.timeRowLabel}>提醒時間</Text>
        {picker(time, setTime, 'compact')}
      </View>
      <Buttons stacked onDone={onDone} />
    </View>
  );
}

function SheetB({ time, setTime, onDone }: SheetProps) {
  return (
    <View style={styles.body}>
      <Text style={styles.title}>{TITLE}</Text>
      <Text style={styles.copy}>{BODY}</Text>
      <View style={styles.wheel}>{picker(time, setTime, 'spinner')}</View>
      <Buttons onDone={onDone} />
    </View>
  );
}

function SheetC({ time, setTime, onDone }: SheetProps) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.bodyCentered}>
      <Text style={styles.titleCentered}>{TITLE}</Text>
      <Text style={styles.copyCentered}>{BODY}</Text>
      <Pressable style={styles.bigTime} onPress={() => setOpen(!open)} accessibilityRole="button">
        <Text style={styles.bigTimeText}>{hhmm(time)}</Text>
        <Text style={styles.bigTimeHint}>{open ? '完成' : '每天・點一下更改'}</Text>
      </Pressable>
      {open ? <View style={styles.wheel}>{picker(time, setTime, 'spinner')}</View> : null}
      <Buttons stacked onDone={onDone} />
    </View>
  );
}

function Buttons({ stacked = false, onDone }: { stacked?: boolean; onDone: () => void }) {
  return (
    <View style={stacked ? styles.buttonsStacked : styles.buttonsRow}>
      {stacked ? null : (
        <Pressable style={[styles.secondary, styles.flex]} onPress={onDone} accessibilityRole="button">
          <Text style={styles.secondaryText}>先不用</Text>
        </Pressable>
      )}
      <Pressable style={[styles.primary, stacked ? null : styles.flex]} onPress={onDone} accessibilityRole="button">
        <Text style={styles.primaryText}>設定提醒</Text>
      </Pressable>
      {stacked ? (
        <Pressable style={styles.ghost} onPress={onDone} accessibilityRole="button">
          <Text style={styles.ghostText}>先不用</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = createStyles((t) => ({
  lineHolder: {
    position: 'absolute',
    top: 64,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  line: {
    backgroundColor: t.colors.surfaceRaised,
    borderRadius: t.radius.pill,
    paddingHorizontal: t.spacing.space6,
    paddingVertical: t.spacing.space4,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  lineText: {
    ...t.typography.note,
    color: t.colors.textPrimary,
  },
  switcher: {
    position: 'absolute',
    top: 4,
    alignSelf: 'center',
    backgroundColor: t.colors.controlPrimaryBg,
    borderRadius: t.radius.pill,
    paddingHorizontal: t.spacing.space5,
    paddingVertical: t.spacing.space2,
  },
  switcherText: {
    ...t.typography.meta,
    color: t.colors.controlPrimaryFg,
  },
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
    paddingBottom: 28,
  },
  body: {
    paddingHorizontal: t.spacing.screenGutter,
    paddingTop: t.spacing.space8,
    gap: t.spacing.space4,
  },
  bodyCentered: {
    paddingHorizontal: t.spacing.screenGutter,
    paddingTop: t.spacing.space8,
    gap: t.spacing.space4,
    alignItems: 'center',
  },
  bellCircle: {
    width: 52,
    height: 52,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surfaceFill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: t.spacing.space2,
  },
  title: {
    ...t.typography.sectionHeader,
    fontSize: 20,
    lineHeight: 28,
    color: t.colors.textPrimary,
  },
  titleCentered: {
    ...t.typography.sectionHeader,
    fontSize: 20,
    lineHeight: 28,
    color: t.colors.textPrimary,
    textAlign: 'center',
  },
  copy: {
    ...t.typography.note,
    color: t.colors.textSecondary,
  },
  copyCentered: {
    ...t.typography.note,
    color: t.colors.textSecondary,
    textAlign: 'center',
  },
  timeRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.card,
    paddingHorizontal: t.spacing.cardPadding,
    minHeight: t.spacing.rowHeight + t.spacing.space4,
    marginTop: t.spacing.space5,
  },
  timeRowLabel: {
    ...t.typography.entryTitle,
    color: t.colors.textPrimary,
  },
  wheel: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  bigTime: {
    alignItems: 'center',
    paddingVertical: t.spacing.space5,
    marginTop: t.spacing.space4,
  },
  bigTimeText: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: '300',
    color: t.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  bigTimeHint: {
    ...t.typography.meta,
    color: t.colors.textTertiary,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: t.spacing.space5,
    marginTop: t.spacing.space6,
  },
  buttonsStacked: {
    alignSelf: 'stretch',
    gap: t.spacing.space2,
    marginTop: t.spacing.space6,
  },
  flex: {
    flex: 1,
  },
  primary: {
    height: t.spacing.hitMin + t.spacing.space2,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.controlPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    ...t.typography.sectionHeader,
    color: t.colors.controlPrimaryFg,
  },
  secondary: {
    height: t.spacing.hitMin + t.spacing.space2,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.controlSecondaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    ...t.typography.sectionHeader,
    color: t.colors.controlSecondaryFg,
  },
  ghost: {
    height: t.spacing.hitMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: {
    ...t.typography.entryTitle,
    color: t.colors.controlGhostFg,
  },
}));
