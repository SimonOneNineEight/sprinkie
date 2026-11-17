import { useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Category } from '../api/client';
import { CategoryIcon } from '../calendar/CategoryIcon';
import { dateHeading } from '../calendar/dateLabel';
import { MiniMonth } from '../calendar/MiniMonth';
import { MonthGrid } from '../calendar/MonthGrid';
import { localDateString } from '../calendar/monthMath';
import { encodeContent, oneLine } from '../entries/content';
import { newDraftId } from '../entries/drafts';
import { saveEntry } from '../entries/save';
import { useStrings } from '../i18n/AppLanguageProvider';
import { Pressable } from '../theme/press';
import { createStyles } from '../theme';

import { sampleCategories, sampleMonth, sampleYearMonth } from './sample';

type Props = {
  accessToken: string;
  categories: Category[];
  /** Page 4's save went through: the first Entry is on `date`. */
  onSaved: (date: string) => void;
  /** 稍後再寫: on to the month view with nothing written. */
  onLater: () => void;
};

/** Five Categories share page 4's row; more scroll sideways. */
const ROW_FITS = 5;

// The Onboarding (#139): a zero-Entry account's first launch after sign-in.
// Pages 1–3 introduce the app on a made-up Journal that is never written;
// page 4 writes the first Entry through the form's own save pipeline. The
// look is variant B of the device prototype, ratified by Simon on
// 2026-11-16 (DESIGN.md): pages 1–3 put the sample on a raised card with
// the copy centred under it, page 4 is a sheet over today's month.
export function Onboarding({ accessToken, categories, onSaved, onLater }: Props) {
  const [page, setPage] = useState(0);
  if (page === 3) {
    return (
      <FirstEntryPage
        accessToken={accessToken}
        categories={categories}
        onSaved={onSaved}
        onLater={onLater}
      />
    );
  }
  return (
    <IntroPage
      page={page}
      onNext={() => setPage(page + 1)}
      onBack={() => setPage(page - 1)}
      onSkip={() => setPage(3)}
    />
  );
}

function IntroPage({
  page,
  onNext,
  onBack,
  onSkip,
}: {
  page: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const strings = useStrings();
  const copy = strings.onboarding.pages[page];
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onSkip} style={styles.ghost}>
          <Text style={styles.ghostText}>{strings.onboarding.skip}</Text>
        </Pressable>
      </View>
      <View style={styles.card}>
        {page === 0 ? <SampleLine /> : null}
        {page === 1 ? <SampleMonth /> : null}
        {page === 2 ? <SampleYear /> : null}
      </View>
      <View style={styles.copy}>
        <View accessible accessibilityLabel={strings.onboarding.progress(page + 1)} style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
          ))}
        </View>
        <Text accessibilityRole="header" style={styles.headline}>
          {copy.title}
        </Text>
        <Text style={styles.body}>{copy.body}</Text>
      </View>
      <View style={styles.spacer} />
      <View style={styles.buttonRow}>
        {page > 0 ? (
          <Pressable accessibilityRole="button" onPress={onBack} style={[styles.secondary, styles.half]}>
            <Text style={styles.secondaryText}>{strings.onboarding.back}</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          feedback="scale"
          onPress={onNext}
          style={[styles.primary, styles.half]}
        >
          <Text style={styles.primaryText}>{strings.onboarding.next}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function today() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

// Page 1: one day holding one line.
function SampleLine() {
  const strings = useStrings();
  const { month, day } = today();
  const food = sampleCategories(strings)[1];
  return (
    <View style={styles.lineCard}>
      <View style={styles.lineHead}>
        <CategoryIcon icon={food.icon} color={food.color} />
        <Text style={styles.meta}>
          {strings.month.dateLabel(month, day, new Date().getDay())} · {food.name}
        </Text>
      </View>
      <Text style={styles.bigLine}>{strings.onboarding.sampleLine}</Text>
    </View>
  );
}

// Page 2: the sample month; a chip lights up only its Category's days, a
// second tap shows them all again.
function SampleMonth() {
  const strings = useStrings();
  const [only, setOnly] = useState<string | null>(null);
  const { year, month, day } = today();
  const samples = sampleCategories(strings);
  const days = sampleMonth(samples, year, month, day, only);
  return (
    <View>
      <MonthGrid year={year} month={month} days={days} today={day} onSelectDay={() => {}} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {samples.map((sample) => {
          const on = only === sample.id;
          return (
            <Pressable
              key={sample.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setOnly(on ? null : sample.id)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <CategoryIcon icon={sample.icon} color={sample.color} hollow={only !== null && !on} />
              <Text style={styles.chipText}>{sample.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Page 3: the sample year, three months to a row.
function SampleYear() {
  const strings = useStrings();
  const now = today();
  const samples = sampleCategories(strings);
  return (
    <View style={styles.yearGrid}>
      {Array.from({ length: 12 }, (_, i) => (
        <View key={i} style={styles.yearCell}>
          <MiniMonth
            year={now.year}
            month={i + 1}
            colors={sampleYearMonth(samples, now.year, i + 1, now)}
            todayDay={i + 1 === now.month ? now.day : undefined}
            onPress={() => {}}
          />
        </View>
      ))}
    </View>
  );
}

function FirstEntryPage({ accessToken, categories, onSaved, onLater }: Props) {
  const strings = useStrings();
  const [date] = useState(() => localDateString(new Date()));
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  // One Draft slot for every retry, which doubles as the create's retry key.
  const [draftId] = useState(newDraftId);
  const inFlight = useRef(false);
  const topLevel = categories
    .filter((category) => category.parentId === undefined || category.parentId === null)
    .sort((a, b) => a.position - b.position);
  const category = topLevel.find((c) => c.id === categoryId) ?? null;
  const canSave = !saving && category !== null && title.trim() !== '';
  const [year, month, day] = date.split('-').map(Number);

  const save = async () => {
    if (!canSave || category === null || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setFailed(false);
    const result = await saveEntry({
      accessToken,
      date,
      categoryId: category.id,
      categoryColor: category.color,
      content: encodeContent({ title: title.trim(), note: '' }),
      photos: [],
      draftId,
    });
    inFlight.current = false;
    if (result.kind === 'saved') {
      onSaved(date);
      return;
    }
    // A failed save keeps what was typed, here and as a Draft on today.
    setSaving(false);
    setFailed(true);
  };

  const fits = topLevel.length <= ROW_FITS;
  const tiles = topLevel.map((c) => {
    const on = c.id === categoryId;
    return (
      <Pressable
        key={c.id}
        accessibilityRole="button"
        accessibilityLabel={c.name}
        accessibilityState={{ selected: on }}
        onPress={() => setCategoryId(c.id)}
        style={[styles.tile, fits ? styles.tileShared : styles.tileFixed, on && styles.tileOn]}
      >
        <CategoryIcon icon={c.icon} color={c.color} size={36} />
        <Text style={styles.tileText} numberOfLines={1}>
          {c.name}
        </Text>
      </Pressable>
    );
  });

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.fadedMonth} pointerEvents="none">
        <MonthGrid
          year={year}
          month={month}
          days={category ? { [day]: [category.color] } : {}}
          today={day}
          onSelectDay={() => {}}
        />
      </View>
      <KeyboardAvoidingView behavior="padding" style={styles.sheet}>
        <SafeAreaView edges={['bottom']} style={styles.fill}>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            <Text accessibilityRole="header" style={[styles.headline, styles.sheetHeadline]}>
              {strings.onboarding.firstEntryTitle}
            </Text>
            <Text style={[styles.meta, styles.centred]}>{dateHeading(strings, date)}</Text>
            <View style={styles.titleBox}>
              <TextInput
                style={styles.titleInput}
                placeholder={strings.onboarding.titlePlaceholder}
                placeholderTextColor={styles.placeholder.color}
                multiline
                maxLength={80}
                value={title}
                onChangeText={(text) => setTitle(oneLine(text))}
              />
              <Text style={styles.counter}>{strings.onboarding.titleCount(title.length)}</Text>
            </View>
            {fits ? (
              <View style={styles.tileRow}>{tiles}</View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tileScroll}
                contentContainerStyle={styles.tileScrollContent}
              >
                {tiles}
              </ScrollView>
            )}
            {failed ? <Text style={styles.error}>{strings.entryForm.saveFailed}</Text> : null}
          </ScrollView>
          <View style={styles.buttonRow}>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={onLater}
              style={[styles.secondary, styles.half]}
            >
              <Text style={styles.secondaryText}>{strings.onboarding.later}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave }}
              feedback="scale"
              disabled={!canSave}
              onPress={() => void save()}
              style={[styles.primary, styles.half, !canSave && !saving && styles.primaryOff]}
            >
              <Text style={[styles.primaryText, !canSave && !saving && styles.primaryTextOff]}>
                {saving ? strings.entryForm.saving : strings.onboarding.keep}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const TITLE_LINES = 3;

const styles = createStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.surfaceFill },
  fill: { flex: 1 },
  spacer: { flex: 1 },
  topBar: {
    height: t.spacing.hitMin,
    paddingHorizontal: t.spacing.screenGutter,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  ghost: { paddingVertical: t.spacing.space4, paddingHorizontal: t.spacing.space2 },
  ghostText: { ...t.typography.note, color: t.colors.controlGhostFg },
  card: {
    marginHorizontal: t.spacing.space7,
    marginTop: t.spacing.space4,
    minHeight: 400,
    borderRadius: t.radius.sheet,
    backgroundColor: t.colors.surface,
    padding: t.spacing.space6,
    justifyContent: 'center',
  },
  copy: { alignItems: 'center', paddingHorizontal: t.spacing.space9, marginTop: 28 },
  dots: { flexDirection: 'row', gap: t.spacing.space3, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.colors.lineSeparatorStrong },
  dotOn: { width: 18, backgroundColor: t.colors.ink },
  headline: {
    fontSize: 26,
    lineHeight: 36,
    fontWeight: '600',
    color: t.colors.textPrimary,
    textAlign: 'center',
    marginTop: t.spacing.space7,
  },
  body: { ...t.typography.note, color: t.colors.textSecondary, textAlign: 'center', marginTop: t.spacing.space4 },
  meta: { ...t.typography.meta, color: t.colors.textTertiary },
  centred: { textAlign: 'center', marginTop: t.spacing.space2 },
  lineCard: { gap: t.spacing.space4, padding: t.spacing.space7 },
  lineHead: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.space4 },
  bigLine: { fontSize: 22, lineHeight: 32, color: t.colors.textPrimary },
  chips: { gap: t.spacing.space4, paddingTop: t.spacing.space6, paddingHorizontal: t.spacing.space1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.space3,
    paddingLeft: t.spacing.space3,
    paddingRight: t.spacing.space5,
    height: 36,
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: t.colors.lineSeparator,
    backgroundColor: t.colors.surface,
  },
  chipOn: { borderColor: t.colors.ink },
  chipText: { ...t.typography.meta, color: t.colors.textPrimary },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: t.spacing.space5 },
  yearCell: { width: '33.33%', paddingHorizontal: t.spacing.space3 },
  buttonRow: {
    flexDirection: 'row',
    gap: t.spacing.space5,
    paddingHorizontal: t.spacing.space7,
    paddingBottom: t.spacing.space5,
    paddingTop: t.spacing.space4,
  },
  half: { flex: 1 },
  primary: {
    height: 50,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.controlPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryOff: { backgroundColor: t.colors.controlDisabledBg },
  primaryText: { fontSize: 17, fontWeight: '600', color: t.colors.controlPrimaryFg },
  primaryTextOff: { color: t.colors.controlDisabledFg },
  secondary: {
    height: 50,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.controlSecondaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 17, fontWeight: '600', color: t.colors.controlSecondaryFg },
  fadedMonth: { paddingHorizontal: t.spacing.screenGutter, opacity: 0.55 },
  sheet: {
    flex: 1,
    marginTop: t.spacing.space6,
    borderTopLeftRadius: t.radius.sheet,
    borderTopRightRadius: t.radius.sheet,
    backgroundColor: t.colors.surface,
  },
  sheetBody: { padding: t.spacing.space7 },
  sheetHeadline: { fontSize: 22, lineHeight: 30, marginTop: 0 },
  titleBox: {
    marginTop: t.spacing.space7,
    backgroundColor: t.colors.surfaceSunken,
    borderRadius: t.radius.r4,
    padding: t.spacing.space5,
  },
  titleInput: {
    ...t.typography.entryTitle,
    color: t.colors.textPrimary,
    minHeight: t.typography.entryTitle.lineHeight * TITLE_LINES,
    maxHeight: t.typography.entryTitle.lineHeight * TITLE_LINES,
    padding: 0,
    textAlignVertical: 'top',
  },
  placeholder: { color: t.colors.textPlaceholder },
  counter: { ...t.typography.meta, color: t.colors.textQuaternary, alignSelf: 'flex-end' },
  tileRow: { flexDirection: 'row', gap: t.spacing.space3, marginTop: t.spacing.space6 },
  tileScroll: { marginTop: t.spacing.space6, marginHorizontal: -t.spacing.space7 },
  tileScrollContent: { gap: t.spacing.space3, paddingHorizontal: t.spacing.space7 },
  tile: {
    alignItems: 'center',
    gap: t.spacing.space3,
    paddingVertical: t.spacing.space4,
    borderRadius: t.radius.r4,
    borderWidth: 1.5,
    borderColor: t.colors.surface,
  },
  tileShared: { flex: 1 },
  tileFixed: { width: 68 },
  tileOn: { borderColor: t.colors.ink },
  tileText: { ...t.typography.meta, color: t.colors.textPrimary },
  error: { ...t.typography.meta, color: t.colors.textDestructive, marginTop: t.spacing.space5 },
}));
