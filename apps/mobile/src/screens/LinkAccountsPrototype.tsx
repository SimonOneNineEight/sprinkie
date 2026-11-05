/* eslint-disable */
/**
 * THROWAWAY PROTOTYPE for #20: the 連結帳戶 section in 設定. Branch
 * `prototype/email-and-linking` only, never merges.
 *
 * Stubbed: no native Apple/Google sheet, no linkIdentity. Apple starts
 * unlinked and links after ~800ms; Google always fails as already claimed,
 * so the error copy is visible. State is module-level so it survives leaving
 * 設定; long-press the pill to put both back to unlinked.
 */
import { Check, ChevronRight } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Pressable } from '../theme/press';
import { createStyles, theme } from '../theme';

import { useOnPrototypeReset, useVariant, wait } from './AccountVariantPrototype';

type Provider = 'apple' | 'google';
const NAME: Record<Provider, string> = { apple: 'Apple', google: 'Google' };

const COPY = {
  header: '連結帳戶',
  steer: '已有帳戶？請先用原本的方式登入，再從這裡連結。',
  explain: '連結後，用 Apple 或 Google 登入都會打開同一本日記。',
  linked: '已連結',
  link: '連結',
  linkWith: (p: string) => `連結 ${p}`,
  linkedWith: (p: string) => `${p} 已連結`,
  claimed: '此登入方式已屬於另一個帳戶',
  claimedHint: '若要連結，請先登入那個帳戶並刪除它；刪除 30 天後，它的登入方式才會釋出。',
};

let linkedStore: Record<Provider, boolean> = { apple: false, google: false };

function useLinking() {
  const [linked, setLinked] = useState(linkedStore);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [failed, setFailed] = useState<Provider | null>(null);

  const link = async (p: Provider) => {
    if (busy || linked[p]) return;
    setFailed(null);
    setBusy(p);
    await wait(800);
    setBusy(null);
    if (p === 'google') {
      setFailed('google');
      return;
    }
    linkedStore = { ...linkedStore, [p]: true };
    setLinked(linkedStore);
  };

  const reset = useCallback(() => {
    linkedStore = { apple: false, google: false };
    setLinked(linkedStore);
    setFailed(null);
  }, []);
  useOnPrototypeReset(reset);

  return { linked, busy, failed, link };
}

type Linking = ReturnType<typeof useLinking>;
const PROVIDERS: Provider[] = ['apple', 'google'];

export function LinkAccountsPrototype() {
  const linking = useLinking();
  const variant = useVariant();
  if (!__DEV__) return null;
  if (variant === 'A') return <VariantA linking={linking} />;
  if (variant === 'B') return <VariantB linking={linking} />;
  return <VariantC linking={linking} />;
}

function ClaimedError({ center }: { center?: boolean }) {
  return (
    <View style={styles.errorBlock}>
      <Text style={[styles.error, center && styles.textCenter]}>{COPY.claimed}</Text>
      <Text style={[styles.hint, center && styles.textCenter]}>{COPY.claimedHint}</Text>
    </View>
  );
}

// ─── A: a plain grouped list, trailing 已連結 / 連結 ──────────────────────

function VariantA({ linking }: { linking: Linking }) {
  return (
    <View>
      <Text style={styles.sectionHeader}>{COPY.header}</Text>
      <View style={styles.card}>
        {PROVIDERS.map((p, i) => (
          <Pressable
            key={p}
            accessibilityRole="button"
            disabled={linking.linked[p]}
            style={[styles.row, i < PROVIDERS.length - 1 && styles.rowDivided]}
            onPress={() => void linking.link(p)}
          >
            <Text style={[styles.rowTitle, styles.rowText]}>{NAME[p]}</Text>
            {linking.busy === p ? (
              <ActivityIndicator size="small" color={theme.colors.iconMuted} />
            ) : linking.linked[p] ? (
              <Text style={styles.rowValue}>{COPY.linked}</Text>
            ) : (
              <Text style={styles.rowAction}>{COPY.link}</Text>
            )}
          </Pressable>
        ))}
      </View>
      {linking.failed ? <ClaimedError /> : null}
      <Text style={styles.footer}>{COPY.steer}</Text>
    </View>
  );
}

// ─── B: rows wear the sign-in buttons, a check once linked ────────────────

function VariantB({ linking }: { linking: Linking }) {
  return (
    <View>
      <Text style={styles.sectionHeader}>{COPY.header}</Text>
      <Text style={styles.leadNote}>{COPY.steer}</Text>
      <View style={styles.buttons}>
        {PROVIDERS.map((p) => {
          const on = linking.linked[p];
          const dark = p === 'apple' && !on;
          return (
            <Pressable
              key={p}
              accessibilityRole="button"
              disabled={on}
              style={[styles.brandButton, dark ? styles.brandDark : styles.brandLight]}
              onPress={() => void linking.link(p)}
            >
              {linking.busy === p ? (
                <ActivityIndicator
                  size="small"
                  color={dark ? theme.colors.controlPrimaryFg : theme.colors.iconMuted}
                />
              ) : on ? (
                <>
                  <Check size={18} color={theme.colors.textPrimary} strokeWidth={2.5} />
                  <Text style={styles.brandLabelLight}>{COPY.linkedWith(NAME[p])}</Text>
                </>
              ) : (
                <Text style={dark ? styles.brandLabelDark : styles.brandLabelLight}>
                  {COPY.linkWith(NAME[p])}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
      {linking.failed ? <ClaimedError center /> : null}
    </View>
  );
}

// ─── C: a card that explains first, then compact status rows ──────────────

function VariantC({ linking }: { linking: Linking }) {
  return (
    <View>
      <Text style={styles.sectionHeader}>{COPY.header}</Text>
      <View style={styles.card}>
        <View style={[styles.cardIntro, styles.rowDivided]}>
          <Text style={styles.introText}>{COPY.explain}</Text>
          <Text style={styles.introText}>{COPY.steer}</Text>
        </View>
        {PROVIDERS.map((p, i) => (
          <View key={p}>
            <Pressable
              accessibilityRole="button"
              disabled={linking.linked[p]}
              style={[styles.compactRow, i < PROVIDERS.length - 1 && styles.rowDivided]}
              onPress={() => void linking.link(p)}
            >
              <Text style={[styles.compactTitle, styles.rowText]}>{NAME[p]}</Text>
              {linking.busy === p ? (
                <ActivityIndicator size="small" color={theme.colors.iconMuted} />
              ) : linking.linked[p] ? (
                <>
                  <Check size={16} color={theme.colors.textSecondary} strokeWidth={2} />
                  <Text style={styles.compactValue}>{COPY.linked}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.compactValue}>未連結</Text>
                  <ChevronRight size={16} color={theme.colors.iconMuted} strokeWidth={2} />
                </>
              )}
            </Pressable>
            {linking.failed === p ? (
              <View style={[styles.inCardError, i < PROVIDERS.length - 1 && styles.rowDivided]}>
                <ClaimedError />
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = createStyles((t) => ({
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
  rowTitle: {
    ...t.typography.entryTitle,
    color: t.colors.textPrimary,
    flexShrink: 1,
  },
  rowValue: {
    ...t.typography.entryTitle,
    color: t.colors.textSecondary,
  },
  rowAction: {
    ...t.typography.entryTitle,
    fontWeight: '600',
    color: t.colors.textPrimary,
  },
  footer: {
    ...t.typography.meta,
    color: t.colors.textTertiary,
    marginTop: t.spacing.space4,
    marginHorizontal: t.spacing.space1,
  },
  errorBlock: {
    gap: t.spacing.space1,
    marginTop: t.spacing.space4,
    marginHorizontal: t.spacing.space1,
  },
  error: {
    ...t.typography.meta,
    fontWeight: '600',
    color: t.colors.textDestructive,
  },
  hint: {
    ...t.typography.meta,
    color: t.colors.textSecondary,
  },
  textCenter: {
    textAlign: 'center',
  },
  // B
  leadNote: {
    ...t.typography.note,
    color: t.colors.textSecondary,
    marginBottom: t.spacing.space5,
    marginHorizontal: t.spacing.space1,
  },
  buttons: {
    gap: t.spacing.space5,
  },
  brandButton: {
    flexDirection: 'row',
    gap: t.spacing.space3,
    height: t.spacing.rowHeight,
    borderRadius: t.radius.r4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandDark: {
    backgroundColor: t.colors.controlPrimaryBg,
  },
  brandLight: {
    backgroundColor: t.colors.surface,
    borderWidth: t.border.hairline,
    borderColor: t.colors.lineSeparatorStrong,
  },
  brandLabelDark: {
    ...t.typography.entryTitle,
    fontWeight: '600',
    color: t.colors.controlPrimaryFg,
  },
  brandLabelLight: {
    ...t.typography.entryTitle,
    color: t.colors.textPrimary,
  },
  // C
  cardIntro: {
    gap: t.spacing.space4,
    paddingVertical: t.spacing.cardPadding,
    paddingHorizontal: t.spacing.cardPadding,
  },
  introText: {
    ...t.typography.note,
    color: t.colors.textSecondary,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.space3,
    minHeight: t.spacing.rowHeight,
    paddingHorizontal: t.spacing.cardPadding,
  },
  compactTitle: {
    ...t.typography.note,
    color: t.colors.textPrimary,
  },
  compactValue: {
    ...t.typography.meta,
    color: t.colors.textTertiary,
  },
  inCardError: {
    paddingHorizontal: t.spacing.cardPadding - t.spacing.space1,
    paddingBottom: t.spacing.space5,
  },
}));
