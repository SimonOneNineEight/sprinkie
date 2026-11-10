import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Animated, Modal, Text, View } from 'react-native';

import { useStrings } from '../i18n/AppLanguageProvider';
import { Pressable } from '../theme/press';
import { createStyles, theme } from '../theme';

import { claimFirstEntryInvite } from './firstEntryInvite';
import { dateAsTime, timeAsDate } from './reminder';
import { useReminder } from './useReminder';

type Phase = 'claiming' | 'line' | 'sheet' | 'pointer';

// The first-save line, then the Reminder invite (#138), played once over the
// month view after a zero-Entry account's first save. The look is variant B
// of the device prototype, ratified by Simon on 2026-11-10 (DESIGN.md): copy
// left-aligned, an inline wheel at 21:00, 先不用 and 設定提醒 side by side.
// 設定提醒 turns on the same Reminder 設定 does; notifications already
// blocked close the sheet with a pointer to 設定 instead of a prompt. The
// once-only mark is claimed as the line plays, not at the save, so Sprinkie
// closed before the month view does not use it up. A Reminder already on
// leaves nothing to offer: the line plays alone.
export function ReminderInvite({ onFinished }: { onFinished: () => void }) {
  const strings = useStrings();
  const reminder = useReminder();
  const alreadyOn = reminder.on;
  const [phase, setPhase] = useState<Phase>('claiming');
  const [time, setTime] = useState(() => timeAsDate(reminder.time));
  // useState's initialiser, not a ref: read during render for the style.
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let active = true;
    void claimFirstEntryInvite().then((claimed) => {
      if (!active) return;
      if (claimed) setPhase('line');
      else onFinished();
    });
    return () => {
      active = false;
    };
  }, [onFinished]);

  // The line, and later the pointer, fade in, hold about two seconds and
  // fade out. The line first lets today's new color be seen.
  useEffect(() => {
    if (phase !== 'line' && phase !== 'pointer') return;
    opacity.setValue(0);
    const fade = Animated.sequence([
      Animated.delay(phase === 'line' ? 600 : 0),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]);
    fade.start(({ finished }) => {
      if (!finished) return;
      if (phase === 'line' && !alreadyOn) setPhase('sheet');
      else onFinished();
    });
    return () => fade.stop();
  }, [phase, opacity, onFinished, alreadyOn]);

  const turnOn = async () => {
    const result = await reminder.turnOn(dateAsTime(time));
    if (result === 'blocked') setPhase('pointer');
    else onFinished();
  };

  if (phase === 'claiming') return null;
  if (phase !== 'sheet') {
    return (
      <Animated.View pointerEvents="none" style={[styles.lineHolder, { opacity }]}>
        <View style={styles.line}>
          <Text style={styles.lineText}>
            {phase === 'line'
              ? strings.reminderInvite.firstSaveLine
              : strings.reminderInvite.laterInSettings}
          </Text>
        </View>
      </Animated.View>
    );
  }
  return (
    <Modal transparent animationType="slide" onRequestClose={onFinished}>
      <View style={styles.overlay}>
        <Pressable
          testID="reminder-invite-scrim"
          accessibilityRole="button"
          accessibilityLabel={strings.reminderInvite.notNow}
          feedback="none"
          style={styles.scrim}
          onPress={onFinished}
        />
        <View style={styles.sheet}>
          <Text style={styles.title}>{strings.reminderInvite.title}</Text>
          <Text style={styles.copy}>{strings.reminderInvite.body}</Text>
          <View style={styles.wheel}>
            <DateTimePicker
              testID="reminder-invite-time"
              accessibilityLabel={strings.reminderInvite.time}
              value={time}
              mode="time"
              display="spinner"
              minuteInterval={5}
              themeVariant="light"
              accentColor={theme.colors.ink}
              textColor={theme.colors.textPrimary}
              onChange={(_, date) => {
                if (date) setTime(date);
              }}
            />
          </View>
          <View style={styles.buttons}>
            <Pressable
              accessibilityRole="button"
              style={[styles.button, styles.secondary]}
              onPress={onFinished}
            >
              <Text style={styles.secondaryText}>{strings.reminderInvite.notNow}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={[styles.button, styles.primary]}
              onPress={() => void turnOn()}
            >
              <Text style={styles.primaryText}>{strings.reminderInvite.turnOn}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
    paddingHorizontal: t.spacing.screenGutter,
    paddingTop: t.spacing.space8,
    paddingBottom: 28,
    gap: t.spacing.space4,
  },
  title: {
    ...t.typography.sectionHeader,
    fontSize: 20,
    lineHeight: 28,
    color: t.colors.textPrimary,
  },
  copy: {
    ...t.typography.note,
    color: t.colors.textSecondary,
  },
  wheel: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  buttons: {
    flexDirection: 'row',
    gap: t.spacing.space5,
    marginTop: t.spacing.space6,
  },
  button: {
    flex: 1,
    height: t.spacing.hitMin + t.spacing.space2,
    borderRadius: t.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: t.colors.controlPrimaryBg,
  },
  primaryText: {
    ...t.typography.sectionHeader,
    color: t.colors.controlPrimaryFg,
  },
  secondary: {
    backgroundColor: t.colors.controlSecondaryBg,
  },
  secondaryText: {
    ...t.typography.sectionHeader,
    color: t.colors.controlSecondaryFg,
  },
}));
