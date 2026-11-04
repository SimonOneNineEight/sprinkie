/* eslint-disable */
// PROTOTYPE (#117), throwaway: three layouts of the read-only Entry view,
// mounted on the real day view so they're judged against real Entries.
// Tap a card (dev builds only) → this; the floating ‹ A › pill cycles the
// layouts. 編輯 opens the real form and comes back here. Swipe moves through
// the day's visible Entries and stops at the ends (#119). Photo taps do
// nothing yet: the viewer is #114. Never merges to main.
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react-native';
import { useRef, useState } from 'react';
import type { ViewToken } from 'react-native';
import { FlatList, Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Category, Entry } from '../api/client';
import { CategoryIcon } from '../calendar/CategoryIcon';
import { dateHeading } from '../calendar/dateLabel';
import { deriveInk, deriveTint } from '../categories/colorDerivation';
import { useStrings } from '../i18n/AppLanguageProvider';
import { Pressable } from '../theme/press';
import { createStyles, theme } from '../theme';

import { decodeContent } from './content';
import { PhotoGrid } from './PhotoGrid';

type Props = {
  entries: Entry[];
  startIndex: number;
  categories: Category[];
  onBack: () => void;
  onEdit: (entry: Entry) => void;
};

type PageProps = {
  entry: Entry;
  categories: Category[];
  width: number;
};

const VARIANTS = [
  { key: 'A', name: '卡片放大' },
  { key: 'B', name: '文章頁' },
  { key: 'C', name: '色帶＋大圖' },
] as const;

// Module-level so the chosen layout survives closing and reopening.
let lastVariant = 0;

function describe(entry: Entry, categories: Category[]) {
  const category = categories.find((c) => c.id === entry.categoryId);
  const subcategory = categories.find((c) => c.id === entry.subcategoryId);
  const content = decodeContent(entry.content);
  return {
    title: content?.title ?? '（無法讀取的紀錄）',
    note: content?.note ?? '',
    color: category?.color ?? theme.colors.iconMuted,
    icon: category?.icon ?? 'tag',
    categoryLine: subcategory ? `${category?.name ?? ''} · ${subcategory.name}` : (category?.name ?? ''),
    photos: entry.photos ?? [],
  };
}

export function EntryViewPrototype({ entries, startIndex, categories, onBack, onEdit }: Props) {
  const strings = useStrings();
  const { width } = useWindowDimensions();
  const [variant, setVariantState] = useState(lastVariant);
  const [index, setIndex] = useState(Math.min(startIndex, entries.length - 1));
  const setVariant = (next: number) => {
    lastVariant = (next + VARIANTS.length) % VARIANTS.length;
    setVariantState(lastVariant);
  };
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  }).current;

  const entry = entries[index];
  if (!entry) return null;
  const heading = dateHeading(strings, entry.date);
  const Page = [PageA, PageB, PageC][variant];

  const pager = (
    <FlatList
      key={variant}
      data={entries}
      horizontal
      pagingEnabled
      bounces={false}
      showsHorizontalScrollIndicator={false}
      initialScrollIndex={index}
      getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
      keyExtractor={(e) => e.id}
      onViewableItemsChanged={onViewable}
      viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
      renderItem={({ item }) => <Page entry={item} categories={categories} width={width} />}
    />
  );

  const back = (
    <Pressable accessibilityRole="button" style={styles.iconButton} onPress={onBack}>
      <ChevronLeft size={22} color={theme.colors.iconDefault} strokeWidth={2} />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {variant === 0 ? (
        // A: the day view's card, zoomed in. Header = day view's header with
        // 編輯 where 類別 sits; position = dots under the card.
        <>
          <View style={styles.headerRow}>
            {back}
            <Text style={styles.heading}>{heading}</Text>
            <Pressable accessibilityRole="button" style={styles.textButton} onPress={() => onEdit(entry)}>
              <Text style={styles.textButtonLabel}>編輯</Text>
            </Pressable>
          </View>
          <View style={styles.fill}>{pager}</View>
          <View style={styles.dots}>
            {entries.map((e, i) => (
              <View key={e.id} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        </>
      ) : variant === 1 ? (
        // B: an article. Compact nav bar with the count in the middle; the
        // date and category live in the page, the title is the headline.
        <>
          <View style={styles.compactBar}>
            {back}
            <Text style={styles.counter}>
              {index + 1} / {entries.length}
            </Text>
            <Pressable accessibilityRole="button" style={styles.textButton} onPress={() => onEdit(entry)}>
              <Text style={styles.textButtonLabel}>編輯</Text>
            </Pressable>
          </View>
          <View style={styles.fill}>{pager}</View>
        </>
      ) : (
        // C: segmented progress on top like stories, date + 第 n 篇 as the
        // header, 編輯 as a floating capsule where + floats on the calendars.
        <>
          <View style={styles.segments}>
            {entries.map((e, i) => (
              <View key={e.id} style={[styles.segment, i <= index && styles.segmentActive]} />
            ))}
          </View>
          <View style={styles.headerRow}>
            {back}
            <View style={styles.fill}>
              <Text style={styles.headingSmall}>{heading}</Text>
              <Text style={styles.subheading}>
                第 {index + 1} 篇，共 {entries.length} 篇
              </Text>
            </View>
          </View>
          <View style={styles.fill}>{pager}</View>
          <Pressable accessibilityRole="button" style={styles.editFab} onPress={() => onEdit(entry)}>
            <Pencil size={16} color={theme.colors.controlPrimaryFg} strokeWidth={2} />
            <Text style={styles.editFabLabel}>編輯</Text>
          </Pressable>
        </>
      )}
      <PrototypeSwitcher
        label={`${VARIANTS[variant].key} (${VARIANTS[variant].name})`}
        onPrev={() => setVariant(variant - 1)}
        onNext={() => setVariant(variant + 1)}
      />
    </SafeAreaView>
  );
}

function PageA({ entry, categories, width }: PageProps) {
  const d = describe(entry, categories);
  const inner = width - theme.spacing.screenGutter * 2 - theme.spacing.cardPadding * 2;
  return (
    <ScrollView style={{ width }} contentContainerStyle={styles.pageA}>
      <View style={styles.card}>
        <View style={styles.titleRowTop}>
          <CategoryIcon icon={d.icon} color={d.color} />
          <Text style={styles.cardTitle}>{d.title}</Text>
        </View>
        <Text style={styles.categoryLine}>{d.categoryLine}</Text>
        {d.note ? <Text style={styles.noteRead}>{d.note}</Text> : null}
        {d.photos.length > 0 ? (
          <View style={styles.gap}>
            <PhotoGrid photos={d.photos.map((p) => ({ key: p.id, uri: p.thumbUrl }))} width={inner} />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function PageB({ entry, categories, width }: PageProps) {
  const strings = useStrings();
  const d = describe(entry, categories);
  const content = width - theme.spacing.screenGutter * 2;
  const [hero, ...rest] = d.photos;
  const restSize = (content - theme.spacing.photoGridGap * 2) / 3;
  return (
    <ScrollView style={{ width }} contentContainerStyle={styles.pageB}>
      {hero ? (
        <>
          <Image source={{ uri: hero.url }} style={[raw.hero, { width: content, height: content * 0.75 }]} />
          {rest.length > 0 ? (
            <View style={styles.thumbRow}>
              {rest.map((p) => (
                <Image key={p.id} source={{ uri: p.thumbUrl }} style={[raw.photo, { width: restSize, height: restSize }]} />
              ))}
            </View>
          ) : null}
        </>
      ) : null}
      <View style={[styles.chip, { backgroundColor: deriveTint(d.color) }]}>
        <CategoryIcon icon={d.icon} color={d.color} size={18} />
        <Text style={[styles.chipLabel, { color: deriveInk(d.color) }]}>{d.categoryLine}</Text>
      </View>
      <Text style={styles.headline}>{d.title}</Text>
      <Text style={styles.meta}>{dateHeading(strings, entry.date)}</Text>
      {d.note ? <Text style={styles.noteArticle}>{d.note}</Text> : null}
    </ScrollView>
  );
}

function PageC({ entry, categories, width }: PageProps) {
  const d = describe(entry, categories);
  const content = width - theme.spacing.screenGutter * 2;
  return (
    <ScrollView style={{ width }} contentContainerStyle={styles.pageC}>
      <View style={[styles.band, { backgroundColor: deriveTint(d.color) }]}>
        <CategoryIcon icon={d.icon} color={d.color} size={28} />
        <Text style={[styles.bandLabel, { color: deriveInk(d.color) }]}>{d.categoryLine}</Text>
      </View>
      <Text style={styles.titleC}>{d.title}</Text>
      {d.note ? <Text style={styles.noteRead}>{d.note}</Text> : null}
      {d.photos.map((p) => (
        <Image key={p.id} source={{ uri: p.url }} style={[raw.photoFull, { width: content, height: content }]} />
      ))}
    </ScrollView>
  );
}

// Deliberately off-palette so it never reads as part of the design.
function PrototypeSwitcher({ label, onPrev, onNext }: { label: string; onPrev: () => void; onNext: () => void }) {
  return (
    <View style={raw.switcher} pointerEvents="box-none">
      <View style={raw.switcherPill}>
        <Pressable accessibilityRole="button" onPress={onPrev} style={raw.switcherArrow}>
          <ChevronLeft size={20} color="#fff" />
        </Pressable>
        <Text style={raw.switcherLabel}>{label}</Text>
        <Pressable accessibilityRole="button" onPress={onNext} style={raw.switcherArrow}>
          <ChevronRight size={20} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = createStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.background },
  fill: { flex: 1 },
  gap: { marginTop: t.spacing.space5 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.space3,
    paddingHorizontal: t.spacing.screenGutter,
    paddingTop: t.spacing.space6,
    paddingBottom: t.spacing.space4,
  },
  compactBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: t.spacing.screenGutter,
    height: t.spacing.navBarHeight,
  },
  iconButton: { width: t.spacing.hitMin, height: t.spacing.hitMin, alignItems: 'center', justifyContent: 'center' },
  heading: { ...t.typography.navTitle, color: t.colors.textPrimary, flex: 1 },
  headingSmall: { ...t.typography.sectionHeader, color: t.colors.textPrimary },
  subheading: { ...t.typography.meta, color: t.colors.textTertiary },
  counter: { ...t.typography.sectionHeader, color: t.colors.textSecondary },
  textButton: { minWidth: t.spacing.hitMin, height: t.spacing.hitMin, alignItems: 'center', justifyContent: 'center' },
  textButtonLabel: { ...t.typography.sectionHeader, color: t.colors.controlGhostFg },

  // A
  pageA: { paddingHorizontal: t.spacing.screenGutter, paddingBottom: 120 },
  card: { backgroundColor: t.colors.surface, borderRadius: t.radius.card, padding: t.spacing.cardPadding },
  titleRowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.space5 },
  cardTitle: { ...t.typography.entryTitle, color: t.colors.textPrimary, flex: 1 },
  categoryLine: {
    ...t.typography.meta,
    color: t.colors.textTertiary,
    marginTop: t.spacing.space1,
    marginLeft: 22 + t.spacing.space5,
  },
  noteRead: { ...t.typography.note, color: t.colors.textSecondary, marginTop: t.spacing.space5 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: t.spacing.space3, paddingVertical: t.spacing.space5, marginBottom: 56 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.colors.lineSeparatorStrong },
  dotActive: { backgroundColor: t.colors.textPrimary },

  // B
  pageB: { paddingHorizontal: t.spacing.screenGutter, paddingBottom: 120, gap: t.spacing.space5 },
  thumbRow: { flexDirection: 'row', gap: t.spacing.photoGridGap },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.space3,
    paddingVertical: t.spacing.space2,
    paddingLeft: t.spacing.space2,
    paddingRight: t.spacing.space5,
    borderRadius: t.radius.pill,
    marginTop: t.spacing.space4,
  },
  chipLabel: { ...t.typography.meta, fontWeight: '600' },
  headline: { ...t.typography.navTitle, color: t.colors.textPrimary },
  meta: { ...t.typography.meta, color: t.colors.textTertiary, marginTop: -t.spacing.space4 },
  noteArticle: { fontSize: 17, lineHeight: 28, color: t.colors.textSecondary },

  // C
  segments: { flexDirection: 'row', gap: t.spacing.space2, paddingHorizontal: t.spacing.screenGutter, paddingTop: t.spacing.space4 },
  segment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: t.colors.lineSeparator },
  segmentActive: { backgroundColor: t.colors.textPrimary },
  pageC: { paddingHorizontal: t.spacing.screenGutter, paddingBottom: 160, gap: t.spacing.space5 },
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.space5,
    padding: t.spacing.space6,
    borderRadius: t.radius.panel,
  },
  bandLabel: { ...t.typography.sectionHeader },
  titleC: { fontSize: 22, lineHeight: 30, fontWeight: '600', color: t.colors.textPrimary },
  editFab: {
    position: 'absolute',
    right: t.spacing.screenGutter,
    bottom: 96,
    height: t.spacing.hitMin,
    paddingHorizontal: t.spacing.space7,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.controlPrimaryBg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.space3,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  editFabLabel: { ...t.typography.sectionHeader, color: t.colors.controlPrimaryFg },

}));

const raw = StyleSheet.create({
  hero: { borderRadius: theme.radius.photo, backgroundColor: theme.colors.surfaceFill },
  photo: { borderRadius: theme.radius.photo, backgroundColor: theme.colors.surfaceFill },
  photoFull: { borderRadius: theme.radius.photo, backgroundColor: theme.colors.surfaceFill },
  switcher: { position: 'absolute', left: 0, right: 0, bottom: 34, alignItems: 'center' },
  switcherPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C2185B',
    borderRadius: 999,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  switcherArrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  switcherLabel: { color: '#fff', fontSize: 14, fontWeight: '600', minWidth: 120, textAlign: 'center' },
});
