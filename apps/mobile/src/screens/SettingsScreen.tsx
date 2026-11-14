import * as Updates from 'expo-updates';
import * as WebBrowser from 'expo-web-browser';
import { Check, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { expo } from '../../app.json';
import { deactivateMe } from '../api/client';
import { providerIdToken, type Provider } from '../auth/providerTokens';
import { supabase } from '../auth/supabase';
import { useSession } from '../auth/useSession';
import type { LanguageOverride, Published, StringCatalog } from '../i18n/appLanguage';
import { useAppLanguage, useStrings } from '../i18n/AppLanguageProvider';
import { legalUrls } from '../legal';
import { dateAsTime, timeAsDate, timeLabel, type ReminderTime } from '../reminder/reminder';
import { ReminderWheel } from '../reminder/ReminderWheel';
import { useReminder } from '../reminder/useReminder';
import { Pressable } from '../theme/press';
import { createStyles, theme } from '../theme';

type Props = {
  accessToken: string;
  onBack: () => void;
};

// Settings (#15, artboard added with #35): quiet cards of rows in the list
// idiom (類別 moved to the calendar's 類別 sheet, ratified 2026-08-20);
// leaving is a right, so 刪除帳號 closes the screen with the grace spelled
// out.
// When the running over-the-air update was published (#147), or null while
// the build runs the code it shipped with. The version alone cannot say: an
// update keeps its build's version (runtimeVersion follows appVersion). Read
// in the phone's own time with its offset, so a tester in another zone can
// be matched exactly against the publish.
function runningUpdate(): Published | null {
  const at = Updates.createdAt;
  if (Updates.isEmbeddedLaunch || !at) return null;
  return {
    month: at.getMonth() + 1,
    day: at.getDate(),
    time: `${at.getHours()}:${String(at.getMinutes()).padStart(2, '0')}`,
    zone: zoneLabel(-at.getTimezoneOffset()),
  };
}

/** An offset east of UTC in minutes, as GMT+8, GMT-6 or GMT+5:30. */
export function zoneLabel(offset: number): string {
  const hours = Math.trunc(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;
  const sign = offset < 0 ? '-' : '+';
  return `GMT${sign}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
}

export function SettingsScreen({ accessToken, onBack }: Props) {
  const strings = useStrings();
  const { override, setOverride } = useAppLanguage();
  const session = useSession();
  const [failed, setFailed] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  // A refusal at the prompt just now: nothing is said until 設定 next opens
  // (#135 story 11), though iOS now reports notifications blocked.
  const [reminderJustRefused, setReminderJustRefused] = useState(false);

  const confirmDelete = () => {
    Alert.alert(strings.settings.deleteConfirmTitle, strings.settings.deleteConfirmBody, [
      { text: strings.entryForm.cancel, style: 'cancel' },
      {
        text: strings.settings.deleteConfirm,
        style: 'destructive',
        onPress: () => {
          // Global sign-out revokes every device's refresh token: a deletion
          // must not be silently undone by another signed-in phone.
          deactivateMe(accessToken)
            .then(() => supabase.auth.signOut({ scope: 'global' }))
            .catch(() => setFailed(true));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.navBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={strings.day.back}
          style={styles.navButton}
          onPress={onBack}
        >
          <ChevronLeft size={22} color={theme.colors.iconDefault} strokeWidth={2} />
        </Pressable>
        <Text style={styles.navTitle}>{strings.settings.title}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View>
          <Text style={styles.sectionHeader}>{strings.settings.accountHeader}</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={[styles.rowTitle, styles.rowText]} numberOfLines={1}>
                {session?.user.email ?? ''}
              </Text>
            </View>
          </View>
        </View>

        <LinkedAccounts />

        <View>
          <Text style={styles.sectionHeader}>{strings.settings.generalHeader}</Text>
          <View style={styles.card}>
            <Pressable
              accessibilityRole="button"
              style={[styles.row, styles.rowDivided]}
              onPress={() => setLanguageOpen(true)}
            >
              <Text style={[styles.rowTitle, styles.rowText]}>{strings.settings.language}</Text>
              <Text style={styles.rowValue}>{languageLabel(strings, override)}</Text>
              <ChevronRight size={18} color={theme.colors.iconMuted} strokeWidth={2} />
            </Pressable>
            <ReminderRows onRefused={setReminderJustRefused} />
          </View>
          <ReminderBlockedNote quiet={reminderJustRefused} />
        </View>

        <View>
          <Text style={styles.sectionHeader}>{strings.settings.aboutHeader}</Text>
          <View style={styles.card}>
            <Pressable
              accessibilityRole="button"
              style={[styles.row, styles.rowDivided]}
              onPress={() => {
                void WebBrowser.openBrowserAsync(legalUrls.privacy);
              }}
            >
              <Text style={[styles.rowTitle, styles.rowText]}>
                {strings.settings.privacyPolicy}
              </Text>
              <ChevronRight size={18} color={theme.colors.iconMuted} strokeWidth={2} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.row}
              onPress={() => {
                void WebBrowser.openBrowserAsync(legalUrls.terms);
              }}
            >
              <Text style={[styles.rowTitle, styles.rowText]}>
                {strings.settings.termsOfService}
              </Text>
              <ChevronRight size={18} color={theme.colors.iconMuted} strokeWidth={2} />
            </Pressable>
          </View>
          <Text style={[styles.linkHint, styles.versionLine]}>
            {strings.settings.version(expo.version, runningUpdate())}
          </Text>
        </View>

        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            style={styles.row}
            onPress={() => {
              void supabase.auth.signOut();
            }}
          >
            <Text style={[styles.rowTitle, styles.rowText]}>{strings.settings.signOut}</Text>
          </Pressable>
        </View>

        {failed ? <Text style={styles.error}>{strings.settings.deleteFailed}</Text> : null}

        <Pressable accessibilityRole="button" style={styles.deleteButton} onPress={confirmDelete}>
          <Trash2 size={16} color={theme.colors.textDestructive} strokeWidth={2} />
          <Text style={styles.deleteLabel}>{strings.settings.deleteAccount}</Text>
        </Pressable>
      </ScrollView>

      {languageOpen ? (
        <LanguageSheet
          override={override}
          onPick={(next) => {
            setOverride(next);
            setLanguageOpen(false);
          }}
          onClose={() => setLanguageOpen(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

// 每日提醒 (#136): a switch, and while it is on, 提醒時間 showing the time,
// which opens ReminderTimeSheet (#142). The first switch-on asks iOS for
// permission; a refusal there leaves it off with nothing said.
function ReminderRows({ onRefused }: { onRefused: (refused: boolean) => void }) {
  const strings = useStrings();
  const reminder = useReminder();
  const [timeSheetOpen, setTimeSheetOpen] = useState(false);
  const shownTime = timeLabel(reminder.time);
  // The sheet goes with its row: if the Reminder goes off while it is open
  // (notifications turned off in iOS), it closes and stays closed.
  if (!reminder.on && timeSheetOpen) setTimeSheetOpen(false);

  return (
    <>
      <View style={[styles.row, reminder.on && styles.rowDivided]}>
        <Text style={[styles.rowTitle, styles.rowText]}>{strings.settings.reminder}</Text>
        <Switch
          accessibilityLabel={strings.settings.reminder}
          value={reminder.on}
          trackColor={{ true: theme.colors.controlPrimaryBg }}
          onValueChange={(next) => {
            if (!next) {
              void reminder.turnOff();
              return;
            }
            void reminder.turnOn().then((result) => {
              onRefused(result === 'refused');
            });
          }}
        />
      </View>
      {reminder.on ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={strings.settings.reminderTime}
          accessibilityValue={{ text: shownTime }}
          style={styles.row}
          onPress={() => setTimeSheetOpen(true)}
        >
          <Text style={[styles.rowTitle, styles.rowText]}>{strings.settings.reminderTime}</Text>
          <Text style={styles.rowValue}>{shownTime}</Text>
          <ChevronRight size={18} color={theme.colors.iconMuted} strokeWidth={2} />
        </Pressable>
      ) : null}
      {timeSheetOpen ? (
        <ReminderTimeSheet
          initial={reminder.time}
          onSave={(time) => {
            void reminder.changeTime(time);
            setTimeSheetOpen(false);
          }}
          onClose={() => setTimeSheetOpen(false)}
        />
      ) : null}
    </>
  );
}

// The 提醒時間 sheet (#142): Apple's editor-sheet pattern, its header matching
// CategoryEditorSheet's (取消 / centered title / 儲存), over only the invite's
// wheel (#138, variant B). Nothing changes until 儲存; 取消 or a tap outside
// drops the spun time.
function ReminderTimeSheet({
  initial,
  onSave,
  onClose,
}: {
  initial: ReminderTime;
  onSave: (time: ReminderTime) => void;
  onClose: () => void;
}) {
  const strings = useStrings();
  const [time, setTime] = useState(() => timeAsDate(initial));

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          testID="reminder-time-scrim"
          accessibilityRole="button"
          accessibilityLabel={strings.entryForm.cancel}
          feedback="none"
          style={styles.scrim}
          onPress={onClose}
        />
        <View style={styles.sheet} testID="reminder-time-sheet">
          <View style={styles.editorHeader}>
            {/* Absolutely spanned first child: the title centers on the sheet,
                not on the gap between the unequal side buttons. */}
            <Text style={styles.editorTitle} numberOfLines={1}>
              {strings.settings.reminderTime}
            </Text>
            <Pressable accessibilityRole="button" style={styles.headerButton} onPress={onClose}>
              <Text style={styles.headerCancel}>{strings.entryForm.cancel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.headerSave}
              onPress={() => onSave(dateAsTime(time))}
            >
              <Text style={styles.headerSaveLabel}>{strings.entryForm.save}</Text>
            </Pressable>
          </View>
          <View style={styles.wheel}>
            <ReminderWheel
              testID="reminder-time"
              accessibilityLabel={strings.settings.reminderTime}
              value={time}
              onChange={setTime}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Blocked permission never prompts (#136): the line says why the switch
// stays off and opens the iOS Settings app, as the camera does. Shown
// whenever iOS has Sprinkie's notifications blocked and the Reminder is not
// on (#135 stories 9 and 12), except right after a refusal at the prompt.
function ReminderBlockedNote({ quiet }: { quiet: boolean }) {
  const strings = useStrings();
  const reminder = useReminder();
  if (reminder.on || !reminder.blocked || quiet) return null;
  return (
    <View style={styles.linkNote}>
      <Text style={styles.linkHint}>{strings.settings.reminderBlocked}</Text>
      <Pressable
        accessibilityRole="button"
        hitSlop={12}
        style={styles.noteAction}
        onPress={() => void Linking.openSettings()}
      >
        <Text style={styles.linkRetry}>{strings.settings.openSettings}</Text>
      </Pressable>
    </View>
  );
}

const providers: Provider[] = ['apple', 'google'];

// 連結帳戶 (#20), variant A of the device prototype (ratified 2026-11-05): a
// plain grouped list, one row per provider, ending in 已連結 or 連結. Link
// state is the account's identities as Supabase holds them, read fresh on
// open: another phone may have linked one since this session began.
function LinkedAccounts() {
  const strings = useStrings();
  const [linked, setLinked] = useState<Provider[] | null>(null);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [failure, setFailure] = useState<'claimed' | 'failed' | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // Bumped by 重試 to read the identities again.
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    readLinked().then(
      (fresh) => {
        if (active) setLinked(fresh);
      },
      () => {
        if (active) setLoadFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [loadAttempt]);

  // The provider's own sheet first, then Supabase links its ID token to the
  // signed-in account.
  const link = async (provider: Provider) => {
    setFailure(null);
    setBusy(provider);
    try {
      const token = await providerIdToken(provider);
      if (!token) return;
      const { data, error } = await supabase.auth.linkIdentity({ provider, token });
      if (error) throw error;
      setLinked(providersOf(data.user?.identities));
    } catch (error) {
      if ((error as { code?: string }).code !== 'identity_already_exists') {
        setFailure('failed');
        return;
      }
      // Supabase Auth gives that code both for a method on another account
      // and for one already on this account, linked from another phone since
      // 設定 opened. A fresh read tells them apart; neither changed anything.
      try {
        const fresh = await readLinked();
        setLinked(fresh);
        if (!fresh.includes(provider)) setFailure('claimed');
      } catch {
        setFailure('failed');
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <View>
      <Text style={styles.sectionHeader}>{strings.settings.linkHeader}</Text>
      <View style={styles.card}>
        {providers.map((provider, index) => {
          const isLinked = linked?.includes(provider) ?? false;
          return (
            <Pressable
              key={provider}
              accessibilityRole="button"
              disabled={linked === null || isLinked || busy !== null}
              style={[styles.row, index < providers.length - 1 && styles.rowDivided]}
              onPress={() => void link(provider)}
            >
              <Text style={[styles.rowTitle, styles.rowText]}>{strings.settings[provider]}</Text>
              {busy === provider ? (
                <ActivityIndicator size="small" color={theme.colors.iconMuted} />
              ) : linked === null ? null : isLinked ? (
                <Text style={styles.rowValue}>{strings.settings.linked}</Text>
              ) : (
                <Text style={styles.rowAction}>{strings.settings.link}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
      {loadFailed ? (
        <View style={[styles.linkNote, styles.linkRetryLine]}>
          <Text style={styles.linkError}>{strings.settings.linkLoadFailed}</Text>
          <Pressable
            accessibilityRole="button"
            // A short word at meta size: the slop brings it to a fair target.
            hitSlop={12}
            onPress={() => {
              setLoadFailed(false);
              setLoadAttempt((n) => n + 1);
            }}
          >
            <Text style={styles.linkRetry}>{strings.settings.linkRetry}</Text>
          </Pressable>
        </View>
      ) : null}
      {failure === 'claimed' ? (
        <View style={styles.linkNote}>
          <Text style={styles.linkError}>{strings.settings.claimed}</Text>
          <Text style={styles.linkHint}>{strings.settings.claimedHint}</Text>
        </View>
      ) : failure === 'failed' ? (
        <View style={styles.linkNote}>
          <Text style={styles.linkError}>{strings.settings.linkFailed}</Text>
        </View>
      ) : null}
      <Text style={styles.linkFooter}>{strings.settings.linkSteer}</Text>
    </View>
  );
}

// The providers on the signed-in account, read from Supabase Auth.
async function readLinked(): Promise<Provider[]> {
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error) throw error;
  return providersOf(data.identities);
}

function providersOf(identities: { provider: string }[] | undefined): Provider[] {
  return providers.filter((provider) => identities?.some((i) => i.provider === provider));
}

// The row readout and the sheet rows share one mapping: 系統預設 translates
// with the UI; a chosen language shows as its fixed endonym (#35).
function languageLabel(strings: StringCatalog, override: LanguageOverride): string {
  if (override === null) return strings.settings.systemDefault;
  return override === 'zh-TW' ? strings.settings.zhHant : strings.settings.english;
}

// The 語言 picker (#35), per the canvas artboard: a plain bottom sheet —
// grab handle, centered title, one card of the three ratified choices, a
// check on the current one. Tapping applies instantly; no save step.
function LanguageSheet({
  override,
  onPick,
  onClose,
}: {
  override: LanguageOverride;
  onPick: (next: LanguageOverride) => void;
  onClose: () => void;
}) {
  const strings = useStrings();
  const choices: LanguageOverride[] = [null, 'zh-TW', 'en'];

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={strings.entryForm.cancel}
          feedback="none"
          style={styles.scrim}
          onPress={onClose}
        />
        <View style={styles.sheet} testID="language-sheet">
          <View style={styles.sheetHeader}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{strings.settings.language}</Text>
          </View>
          <View style={styles.sheetBody}>
            <View style={styles.card}>
              {choices.map((choice, index) => (
                <Pressable
                  key={choice ?? 'system'}
                  accessibilityRole="button"
                  accessibilityState={{ selected: override === choice }}
                  style={[styles.row, index < choices.length - 1 && styles.rowDivided]}
                  onPress={() => onPick(choice)}
                >
                  <Text style={[styles.rowTitle, styles.rowText]}>
                    {languageLabel(strings, choice)}
                  </Text>
                  {override === choice ? (
                    <Check size={18} color={theme.colors.textPrimary} strokeWidth={2} />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = createStyles((t) => ({
  screen: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.space4,
    height: t.spacing.navBarHeight,
    paddingHorizontal: t.spacing.space4,
  },
  navButton: {
    width: t.spacing.hitMin,
    height: t.spacing.hitMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    ...t.typography.sectionHeader,
    color: t.colors.textPrimary,
    flex: 1,
  },
  body: {
    gap: t.spacing.space7,
    paddingHorizontal: t.spacing.screenGutter,
    paddingTop: t.spacing.space5,
    paddingBottom: t.spacing.space10,
  },
  sectionHeader: {
    ...t.typography.meta,
    color: t.colors.textTertiary,
    marginBottom: t.spacing.space4,
    marginLeft: t.spacing.space1,
  },
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.space5,
    minHeight: t.spacing.rowHeight,
    paddingVertical: t.spacing.rowPaddingY,
    paddingHorizontal: t.spacing.cardPadding,
  },
  rowDivided: {
    borderBottomWidth: t.border.hairline,
    borderBottomColor: t.colors.lineSeparator,
  },
  rowText: {
    flex: 1,
  },
  rowValue: {
    ...t.typography.entryTitle,
    color: t.colors.textSecondary,
  },
  rowAction: {
    // An action reads heavier than a value beside it, as in the prototype.
    ...t.typography.entryTitle,
    fontWeight: '600',
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
    overflow: 'hidden',
  },
  sheetHeader: {
    alignItems: 'center',
    gap: t.spacing.space4,
    paddingTop: t.spacing.space4,
    paddingBottom: t.spacing.space5,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.lineSeparator,
  },
  sheetTitle: {
    // The artboard titles this sheet at headline size (17/22 semibold),
    // not the 15px sectionHeader the older sheets use.
    ...t.typography.sectionHeader,
    fontSize: 17,
    color: t.colors.textPrimary,
  },
  sheetBody: {
    paddingHorizontal: t.spacing.screenGutter,
    // Home-indicator clearance, same off-token value as the other sheets.
    paddingBottom: 32,
  },
  rowTitle: {
    ...t.typography.entryTitle,
    color: t.colors.textPrimary,
    flexShrink: 1,
  },
  // The 提醒時間 sheet's header, drawn as CategoryEditorSheet draws its own.
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.spacing.space4,
    padding: t.spacing.space4,
    backgroundColor: t.colors.materialBar,
    borderBottomWidth: t.border.hairline,
    borderBottomColor: t.colors.lineSeparator,
  },
  editorTitle: {
    ...t.typography.sectionHeader,
    color: t.colors.textPrimary,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
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
  headerSave: {
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: t.spacing.space5,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.controlPrimaryBg,
  },
  headerSaveLabel: {
    ...t.typography.entryTitle,
    color: t.colors.controlPrimaryFg,
  },
  wheel: {
    alignItems: 'center',
    paddingHorizontal: t.spacing.screenGutter,
    paddingTop: t.spacing.space4,
    // Home-indicator clearance, as the invite sheet leaves it.
    paddingBottom: 28,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: t.spacing.space3,
    height: t.spacing.hitMin,
    paddingHorizontal: t.spacing.space2,
  },
  deleteLabel: {
    ...t.typography.entryTitle,
    color: t.colors.textDestructive,
  },
  error: {
    ...t.typography.meta,
    color: t.colors.textDestructive,
  },
  linkNote: {
    gap: t.spacing.space1,
    marginTop: t.spacing.space4,
    marginHorizontal: t.spacing.space1,
  },
  linkError: {
    ...t.typography.meta,
    fontWeight: '600',
    color: t.colors.textDestructive,
  },
  linkFooter: {
    ...t.typography.meta,
    color: t.colors.textTertiary,
    marginTop: t.spacing.space4,
    marginHorizontal: t.spacing.space1,
  },
  linkRetryLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.space4,
  },
  linkRetry: {
    ...t.typography.meta,
    fontWeight: '600',
    color: t.colors.textPrimary,
  },
  noteAction: {
    alignSelf: 'flex-start',
  },
  linkHint: {
    ...t.typography.meta,
    color: t.colors.textSecondary,
  },
  versionLine: {
    marginTop: t.spacing.space4,
    marginHorizontal: t.spacing.space1,
  },
}));
