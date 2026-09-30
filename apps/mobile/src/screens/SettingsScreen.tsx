import * as WebBrowser from 'expo-web-browser';
import { Check, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deactivateMe } from '../api/client';
import { supabase } from '../auth/supabase';
import { useSession } from '../auth/useSession';
import type { LanguageOverride, StringCatalog } from '../i18n/appLanguage';
import { useAppLanguage, useStrings } from '../i18n/AppLanguageProvider';
import { legalUrls } from '../legal';
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
export function SettingsScreen({ accessToken, onBack }: Props) {
  const strings = useStrings();
  const { override, setOverride } = useAppLanguage();
  const session = useSession();
  const [failed, setFailed] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);

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

        <View>
          <Text style={styles.sectionHeader}>{strings.settings.generalHeader}</Text>
          <View style={styles.card}>
            <Pressable
              accessibilityRole="button"
              style={styles.row}
              onPress={() => setLanguageOpen(true)}
            >
              <Text style={[styles.rowTitle, styles.rowText]}>{strings.settings.language}</Text>
              <Text style={styles.rowValue}>{languageLabel(strings, override)}</Text>
              <ChevronRight size={18} color={theme.colors.iconMuted} strokeWidth={2} />
            </Pressable>
          </View>
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
}));
