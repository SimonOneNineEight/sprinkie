/* eslint-disable */
// PROTOTYPE (#139), throwaway: three looks for the Onboarding's pages 1–4,
// mounted over the real month view in dev builds so they're judged on the
// device. Lives only on `prototype/onboarding` and never merges.
//
// The magenta ‹ A › pill cycles the look and restarts at page 1. Pages 1–3
// draw with the real MonthGrid and MiniMonth on made-up data (never
// written); page 2's chips light up only one Category's days. Page 4 uses
// the account's real Categories, but 收藏這一刻 SAVES NOTHING here: it just
// closes, as 稍後再寫 does. The month view's small pill reopens it.
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Category } from '../api/client';
import { CategoryIcon } from '../calendar/CategoryIcon';
import { MiniMonth } from '../calendar/MiniMonth';
import { MonthGrid } from '../calendar/MonthGrid';
import { Pressable } from '../theme/press';
import { createStyles, theme } from '../theme';

const VARIANTS = [
  { key: 'A', name: 'A · 書頁 quiet pages' },
  { key: 'B', name: 'B · 卡片 swipe cards' },
  { key: 'C', name: 'C · 舞台 one live calendar' },
] as const;
let lastVariant = 0;

const COPY = [
  { title: '一天一行，就好。', body: '不用寫很多，記下今天的一件小事。' },
  { title: '想看看最近都做了什麼？', body: '點一個類別，只看那些日子。' },
  { title: '原來，生活比想像中豐富。', body: '一年下來，每一格都是你。' },
  { title: '寫下第一個生活片段', body: '' },
];
const PLACEHOLDER = '今天下班去吃了好吃的拉麵 🍜';
const MAX_TITLE = 80;

// Made-up sample data, for show only.
const C = theme.categories;
const SAMPLE = [
  { id: 's-work', name: '工作', icon: 'briefcase', color: C.blue.base },
  { id: 's-food', name: '美食', icon: 'utensils', color: C.orange.base },
  { id: 's-move', name: '運動', icon: 'dumbbell', color: C.green.base },
  { id: 's-friends', name: '朋友', icon: 'users', color: C.pink.base },
  { id: 's-read', name: '閱讀', icon: 'book-open', color: C.indigo.base },
];
function pseudo(n: number) {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}
function sampleMonth(year: number, month: number, upTo: number, filter: string | null) {
  const days: Record<number, string[]> = {};
  for (let d = 1; d <= upTo; d++) {
    const n = Math.floor(pseudo(year * 400 + month * 31 + d) * 4); // 0–3 entries
    const ids = [...new Set(Array.from({ length: n }, (_, i) => SAMPLE[Math.floor(pseudo(d * 7 + i + month) * 5)].id))];
    const shown = ids.filter((id) => !filter || id === filter);
    if (shown.length) days[d] = shown.map((id) => SAMPLE.find((s) => s.id === id)!.color);
  }
  return days;
}
function sampleYearColors(year: number, month: number, todayMonth: number) {
  if (month > todayMonth) return {};
  const days = sampleMonth(year, month, 31, null);
  const out: Record<number, string> = {};
  for (const [d, colors] of Object.entries(days)) out[Number(d)] = colors[0];
  return out;
}

type Props = { categories: Category[]; onClose: () => void };

export function OnboardingPrototype({ categories, onClose }: Props) {
  const [variant, setVariantState] = useState(lastVariant);
  const [page, setPage] = useState(0);
  const cycle = (step: number) => {
    lastVariant = (variant + step + VARIANTS.length) % VARIANTS.length;
    setVariantState(lastVariant);
    setPage(0);
  };
  const nav = {
    page,
    next: () => setPage((p) => Math.min(p + 1, 3)),
    back: () => setPage((p) => Math.max(p - 1, 0)),
    skip: () => setPage(3),
    done: onClose,
  };
  const Look = [LookA, LookB, LookC][variant];
  return (
    <View style={{ flex: 1 }}>
      <Look nav={nav} categories={categories} />
      <View pointerEvents="box-none" style={styles.pillWrap}>
        <View style={styles.pill}>
          <Pressable hitSlop={10} onPress={() => cycle(-1)}>
            <ChevronLeft size={18} color={theme.colors.textOnDark} />
          </Pressable>
          <Text style={styles.pillText}>{VARIANTS[variant].name} · p{page + 1}</Text>
          <Pressable hitSlop={10} onPress={() => cycle(1)}>
            <ChevronRight size={18} color={theme.colors.textOnDark} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** The month view's way back in. */
export function OnboardingReopenPill({ onPress }: { onPress: () => void }) {
  return (
    <View pointerEvents="box-none" style={styles.pillWrap}>
      <Pressable onPress={onPress} style={styles.pill}>
        <Text style={styles.pillText}>▶ Onboarding prototype</Text>
      </Pressable>
    </View>
  );
}

type Nav = {
  page: number;
  next: () => void;
  back: () => void;
  skip: () => void;
  done: () => void;
};
type LookProps = { nav: Nav; categories: Category[] };

// ─── shared illustrations ──────────────────────────────────────────────

const now = new Date();
const Y = now.getFullYear();
const M = now.getMonth() + 1;
const D = now.getDate();

function OneLine({ big }: { big?: boolean }) {
  // Page 1: a single day holding a single line.
  return (
    <View style={[styles.lineCard, big && { padding: 20 }]}>
      <View style={styles.lineCardHead}>
        <CategoryIcon icon="utensils" color={C.orange.base} />
        <Text style={styles.meta}>
          {M}月{D}日 · 美食
        </Text>
      </View>
      <Text style={big ? styles.bigLine : styles.entryTitle}>{PLACEHOLDER}</Text>
    </View>
  );
}

function SampleMonth({ filter, setFilter }: { filter: string | null; setFilter: (id: string | null) => void }) {
  const days = useMemo(() => sampleMonth(Y, M, D, filter), [filter]);
  return (
    <View>
      <MonthGrid year={Y} month={M} days={days} today={D} onSelectDay={() => {}} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {SAMPLE.map((s) => {
          const on = filter === s.id;
          return (
            <Pressable
              key={s.id}
              onPress={() => setFilter(on ? null : s.id)}
              style={[styles.chip, on && { borderColor: s.color, backgroundColor: theme.colors.surface }]}
            >
              <CategoryIcon icon={s.icon} color={s.color} hollow={!!filter && !on} />
              <Text style={styles.chipText}>{s.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function SampleYear() {
  return (
    <View style={styles.yearGrid}>
      {Array.from({ length: 12 }, (_, i) => (
        <View key={i} style={styles.yearCell}>
          <MiniMonth year={Y} month={i + 1} colors={sampleYearColors(Y, i + 1, M)} todayDay={i + 1 === M ? D : undefined} onPress={() => {}} />
        </View>
      ))}
    </View>
  );
}

function Dots({ page, dark }: { page: number; dark?: boolean }) {
  return (
    <View style={styles.dots}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[styles.dot, i === page && styles.dotOn, i === page && dark && { width: 18 }]}
        />
      ))}
    </View>
  );
}

// Page 4's Category picker: the account's real top-level Categories.
function useTopLevel(categories: Category[]) {
  return categories.filter((c) => !c.parentId).sort((a, b) => a.position - b.position);
}
function CategoryChips({ categories, value, onChange }: { categories: Category[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <View style={styles.wrapChips}>
      {useTopLevel(categories).map((c) => {
        const on = value === c.id;
        return (
          <Pressable key={c.id} onPress={() => onChange(c.id)} style={[styles.chip, on && styles.chipOn]}>
            <CategoryIcon icon={c.icon} color={c.color} />
            <Text style={[styles.chipText, on && { color: theme.colors.textOnDark }]}>{c.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
function CategoryTiles({ categories, value, onChange }: { categories: Category[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <View style={styles.tiles}>
      {useTopLevel(categories).map((c) => {
        const on = value === c.id;
        return (
          <Pressable key={c.id} onPress={() => onChange(c.id)} style={[styles.tile, on && { borderColor: theme.colors.ink }]}>
            <CategoryIcon icon={c.icon} color={c.color} size={36} />
            <Text style={styles.tileText} numberOfLines={1}>
              {c.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TitleField({ value, onChange, style }: { value: string; onChange: (s: string) => void; style?: object }) {
  return (
    <View>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={PLACEHOLDER}
        placeholderTextColor={theme.colors.textPlaceholder}
        maxLength={MAX_TITLE}
        multiline
        numberOfLines={3}
        style={[styles.titleInput, style]}
      />
      <Text style={styles.counter}>
        {value.length}/{MAX_TITLE}
      </Text>
    </View>
  );
}

function usePage4() {
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  return { title, setTitle, categoryId, setCategoryId, ready: title.trim().length > 0 && categoryId !== null };
}

function PrimaryButton({ label, onPress, disabled, style }: { label: string; onPress: () => void; disabled?: boolean; style?: object }) {
  return (
    <Pressable feedback="scale" disabled={disabled} onPress={onPress} style={[styles.primary, disabled && styles.primaryOff, style]}>
      <Text style={[styles.primaryText, disabled && { color: theme.colors.controlDisabledFg }]}>{label}</Text>
    </Pressable>
  );
}
function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable hitSlop={8} onPress={onPress} style={styles.ghost}>
      <Text style={styles.ghostText}>{label}</Text>
    </Pressable>
  );
}

const todayLabel = `${M}月${D}日 星期${'日一二三四五六'[now.getDay()]}`;

// ─── A · 書頁: quiet pages, copy on top, the real component below ─────────

function LookA({ nav, categories }: LookProps) {
  const [filter, setFilter] = useState<string | null>(null);
  const p4 = usePage4();
  if (nav.page === 3) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.aBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.meta}>{todayLabel}</Text>
            <Text style={[styles.headline, { marginTop: 8 }]}>{COPY[3].title}</Text>
            <TitleField value={p4.title} onChange={p4.setTitle} style={{ marginTop: 24 }} />
            <Text style={[styles.section, { marginTop: 24 }]}>類別</Text>
            <CategoryChips categories={categories} value={p4.categoryId} onChange={p4.setCategoryId} />
          </ScrollView>
          <View style={styles.aFooter}>
            <PrimaryButton label="收藏這一刻" disabled={!p4.ready} onPress={nav.done} style={{ alignSelf: 'stretch' }} />
            <GhostButton label="稍後再寫" onPress={nav.done} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.aTop}>
        {nav.page > 0 ? <GhostButton label="返回" onPress={nav.back} /> : <View />}
        <GhostButton label="略過" onPress={nav.skip} />
      </View>
      <View style={styles.aBody}>
        <Text style={styles.headline}>{COPY[nav.page].title}</Text>
        <Text style={[styles.bodyText, { marginTop: 8 }]}>{COPY[nav.page].body}</Text>
        <View style={{ marginTop: 32 }}>
          {nav.page === 0 && <OneLine />}
          {nav.page === 1 && <SampleMonth filter={filter} setFilter={setFilter} />}
          {nav.page === 2 && <SampleYear />}
        </View>
      </View>
      <View style={styles.aFooter}>
        <Dots page={nav.page} />
        <PrimaryButton label="下一步" onPress={nav.next} style={{ alignSelf: 'stretch' }} />
      </View>
    </SafeAreaView>
  );
}

// ─── B · 卡片: illustration on a raised card, copy centered under it ──────

function LookB({ nav, categories }: LookProps) {
  const [filter, setFilter] = useState<string | null>(null);
  const p4 = usePage4();
  if (nav.page === 3) {
    // The first Entry written as a sheet over the (empty) month.
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.surfaceFill }]} edges={['top']}>
        <View style={{ paddingHorizontal: 16, opacity: 0.55 }}>
          <MonthGrid year={Y} month={M} days={p4.categoryId ? { [D]: [categories.find((c) => c.id === p4.categoryId)?.color ?? C.clay.base] } : {}} today={D} onSelectDay={() => {}} />
        </View>
        <KeyboardAvoidingView behavior="padding" style={styles.bSheet}>
          <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              <Text style={[styles.headline, { textAlign: 'center', fontSize: 22, lineHeight: 30 }]}>{COPY[3].title}</Text>
              <Text style={[styles.meta, { textAlign: 'center', marginTop: 4 }]}>{todayLabel}</Text>
              <TitleField value={p4.title} onChange={p4.setTitle} style={[styles.boxedInput, { marginTop: 20 }]} />
              <CategoryTiles categories={categories} value={p4.categoryId} onChange={p4.setCategoryId} />
            </ScrollView>
            <View style={styles.bRow}>
              <Pressable onPress={nav.done} style={[styles.secondary, { flex: 1 }]}>
                <Text style={styles.secondaryText}>稍後再寫</Text>
              </Pressable>
              <PrimaryButton label="收藏這一刻" disabled={!p4.ready} onPress={nav.done} style={{ flex: 1 }} />
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.surfaceFill }]} edges={['top', 'bottom']}>
      <View style={[styles.aTop, { justifyContent: 'flex-end' }]}>
        <GhostButton label="略過" onPress={nav.skip} />
      </View>
      <View style={styles.bCard}>
        {nav.page === 0 && (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <OneLine big />
          </View>
        )}
        {nav.page === 1 && <SampleMonth filter={filter} setFilter={setFilter} />}
        {nav.page === 2 && <SampleYear />}
      </View>
      <View style={{ alignItems: 'center', paddingHorizontal: 32, marginTop: 28 }}>
        <Dots page={nav.page} dark />
        <Text style={[styles.headline, { textAlign: 'center', marginTop: 20 }]}>{COPY[nav.page].title}</Text>
        <Text style={[styles.bodyText, { textAlign: 'center', marginTop: 8 }]}>{COPY[nav.page].body}</Text>
      </View>
      <View style={{ flex: 1 }} />
      <View style={styles.bRow}>
        {nav.page > 0 ? (
          <Pressable onPress={nav.back} style={[styles.secondary, { flex: 1 }]}>
            <Text style={styles.secondaryText}>返回</Text>
          </Pressable>
        ) : null}
        <PrimaryButton label="下一步" onPress={nav.next} style={{ flex: 1 }} />
      </View>
    </SafeAreaView>
  );
}

// ─── C · 舞台: one live calendar that grows page by page ──────────────────

function LookC({ nav, categories }: LookProps) {
  const [filter, setFilter] = useState<string | null>(null);
  const p4 = usePage4();
  if (nav.page === 3) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 48 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.meta}>{todayLabel}</Text>
            <Text style={styles.cPrompt}>今天，</Text>
            <TextInput
              value={p4.title}
              onChangeText={p4.setTitle}
              placeholder={PLACEHOLDER}
              placeholderTextColor={theme.colors.textPlaceholder}
              maxLength={MAX_TITLE}
              multiline
              autoFocus
              style={styles.cInput}
            />
            <Text style={styles.counter}>
              {p4.title.length}/{MAX_TITLE}
            </Text>
            <Text style={[styles.section, { marginTop: 28 }]}>這是哪一類？</Text>
            <CategoryTiles categories={categories} value={p4.categoryId} onChange={p4.setCategoryId} />
          </ScrollView>
          <View style={styles.aFooter}>
            <PrimaryButton label="收藏這一刻" disabled={!p4.ready} onPress={nav.done} style={{ alignSelf: 'stretch' }} />
            <GhostButton label="稍後再寫" onPress={nav.done} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }
  // Page 1 lights one day; page 2 fills the month; page 3 zooms out to the year.
  const oneDay = { [D]: [C.orange.base] };
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={[styles.aTop, { justifyContent: 'flex-end' }]}>
        <GhostButton label="略過" onPress={nav.skip} />
      </View>
      <View style={{ flex: 1, paddingHorizontal: 16, justifyContent: 'center' }}>
        <Text style={[styles.navTitle, { marginBottom: 8 }]}>{nav.page === 2 ? `${Y}年` : `${M}月`}</Text>
        {nav.page === 0 && <MonthGrid year={Y} month={M} days={oneDay} today={D} selected={D} onSelectDay={() => {}} />}
        {nav.page === 1 && <SampleMonth filter={filter} setFilter={setFilter} />}
        {nav.page === 2 && <SampleYear />}
      </View>
      <SafeAreaView edges={['bottom']} style={styles.cPanel}>
        {nav.page === 0 && <OneLine />}
        <Text style={[styles.headline, { marginTop: nav.page === 0 ? 16 : 0 }]}>{COPY[nav.page].title}</Text>
        <Text style={[styles.bodyText, { marginTop: 6 }]}>{COPY[nav.page].body}</Text>
        <View style={styles.cRow}>
          {nav.page > 0 ? (
            <Pressable hitSlop={8} onPress={nav.back} style={styles.round}>
              <ArrowLeft size={20} color={theme.colors.ink} />
            </Pressable>
          ) : (
            <View style={{ width: 48 }} />
          )}
          <Dots page={nav.page} />
          <Pressable feedback="scale" onPress={nav.next} style={[styles.round, styles.roundDark]}>
            <ArrowRight size={20} color={theme.colors.textOnDark} />
          </Pressable>
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = createStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.background },
  pillWrap: { position: 'absolute', left: 0, right: 0, top: 56, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: t.radius.pill,
    backgroundColor: '#D6338A' as never,
    opacity: 0.92,
  },
  pillText: { color: t.colors.textOnDark, fontSize: 12, fontWeight: '600' },
  aTop: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, alignItems: 'center' },
  aBody: { paddingHorizontal: 24, paddingTop: 24, flexGrow: 1 },
  aFooter: { paddingHorizontal: 24, paddingBottom: 12, gap: 12, alignItems: 'center' },
  headline: { fontSize: 26, lineHeight: 36, fontWeight: '600', color: t.colors.textPrimary },
  navTitle: { ...t.typography.navTitle, color: t.colors.textPrimary },
  bodyText: { ...t.typography.note, color: t.colors.textSecondary },
  meta: { ...t.typography.meta, color: t.colors.textTertiary },
  section: { ...t.typography.sectionHeader, color: t.colors.textPrimary, marginBottom: 10 },
  entryTitle: { ...t.typography.entryTitle, color: t.colors.textPrimary },
  bigLine: { fontSize: 22, lineHeight: 32, color: t.colors.textPrimary },
  lineCard: { backgroundColor: t.colors.surface, borderRadius: t.radius.card, padding: t.spacing.cardPadding, gap: 8 },
  lineCardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { gap: 8, paddingTop: 16, paddingHorizontal: 2 },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 6,
    paddingRight: 12,
    height: 36,
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: t.colors.lineSeparator,
    backgroundColor: t.colors.surface,
  },
  chipOn: { backgroundColor: t.colors.controlPrimaryBg, borderColor: t.colors.controlPrimaryBg },
  chipText: { ...t.typography.meta, color: t.colors.textPrimary },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  tile: {
    width: '22%' as never,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: t.radius.r4,
    borderWidth: 1.5,
    borderColor: 'transparent' as never,
  },
  tileText: { ...t.typography.meta, color: t.colors.textPrimary },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  yearCell: { width: '33.33%' as never, paddingHorizontal: 6 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.colors.lineSeparatorStrong },
  dotOn: { backgroundColor: t.colors.ink },
  titleInput: { ...t.typography.entryTitle, color: t.colors.textPrimary, minHeight: 24 * 3, textAlignVertical: 'top' },
  boxedInput: { backgroundColor: t.colors.surfaceSunken, borderRadius: t.radius.r4, padding: 12, minHeight: 24 * 3 + 24 },
  counter: { ...t.typography.meta, color: t.colors.textQuaternary, alignSelf: 'flex-end' },
  primary: {
    height: 50,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.controlPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  primaryOff: { backgroundColor: t.colors.controlDisabledBg },
  primaryText: { fontSize: 17, fontWeight: '600', color: t.colors.controlPrimaryFg },
  secondary: { height: 50, borderRadius: t.radius.pill, backgroundColor: t.colors.controlSecondaryBg, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 17, fontWeight: '600', color: t.colors.controlSecondaryFg },
  ghost: { paddingVertical: 8, paddingHorizontal: 4 },
  ghostText: { fontSize: 15, color: t.colors.controlGhostFg },
  bCard: {
    marginHorizontal: 20,
    marginTop: 8,
    height: 400,
    borderRadius: t.radius.sheet,
    backgroundColor: t.colors.surface,
    padding: 16,
    justifyContent: 'center',
  },
  bRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  bSheet: {
    flex: 1,
    marginTop: 16,
    borderTopLeftRadius: t.radius.sheet,
    borderTopRightRadius: t.radius.sheet,
    backgroundColor: t.colors.surface,
  },
  cPrompt: { fontSize: 34, lineHeight: 44, fontWeight: '600', color: t.colors.textPrimary, marginTop: 12 },
  cInput: {
    fontSize: 24,
    lineHeight: 34,
    color: t.colors.textPrimary,
    minHeight: 34 * 3,
    borderBottomWidth: 1.5,
    borderBottomColor: t.colors.lineField,
    paddingBottom: 8,
    textAlignVertical: 'top',
  },
  cPanel: {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: t.radius.sheet,
    borderTopRightRadius: t.radius.sheet,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  cRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.surfaceFill,
  },
  roundDark: { backgroundColor: t.colors.controlPrimaryBg },
}));
