import { ChevronLeft, Tags } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import type { RenderItemParams } from 'react-native-draggable-flatlist';
import { Directions, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Category, Entry } from '../api/client';
import { listEntries, reorderDay } from '../api/client';
import type { HiddenSet } from '../calendar/hidden';
import { CalendarFloatingActions, useFloatingActions } from '../calendar/CalendarFloatingActions';
import { CategorySheet } from '../calendar/CategorySheet';
import { entryIsVisible, nothingHidden } from '../calendar/hidden';
import { dateHeading } from '../calendar/dateLabel';
import { localDateString, shiftDay } from '../calendar/monthMath';
import { decodeContent } from '../entries/content';
import type { EntryDraft } from '../entries/drafts';
import { listDrafts } from '../entries/drafts';
import { EntryCard } from '../entries/EntryCard';
import { EntryView } from '../entries/EntryView';
import { useStrings } from '../i18n/AppLanguageProvider';
import { Pressable } from '../theme/press';
import { createStyles, theme } from '../theme';

import { EntryFormScreen, type OpenForm } from './EntryFormScreen';

/** How an Entry changed on the day view, as onEntrySaved reports it. */
export type EntryChange = 'saved' | 'deleted' | 'reordered';

type Props = {
  accessToken: string;
  categories: Category[];
  /** The date whose Entries this screen shows, YYYY-MM-DD. */
  date: string;
  /** Injectable for tests; defaults to the device's now. */
  today?: Date;
  onBack?: () => void;
  /**
   * A horizontal swipe asks for the previous/next date (#26); so does 今天,
   * and an Entry the form moved while the Entry view showed it (#119).
   */
  onChangeDate?: (date: string) => void;
  /**
   * Called after an Entry changes here (save, edit, delete, reorder), saying
   * which: only a save can be a first Entry (#138).
   */
  onEntrySaved?: (change: EntryChange) => void;
  /** What this screen's Entry form holds while open (#140); see EntryFormScreen. */
  onFormState?: (form: OpenForm | null) => void;
  onCategoriesChanged?: () => void;
  /**
   * The persistent hidden-set (#30). Hidden cards drop out; drag-reorder
   * disables only while THIS day shows a partial list, since ordering a
   * partial view is undefined — a fully visible day reorders freely even
   * while other categories hide.
   */
  hidden?: HiddenSet;
  /** Opens the 類別 sheet from this header (#41). Absent, no button is drawn. */
  onChangeHidden?: (hidden: HiddenSet) => void;
};

// The day view (#7): the date's Entries as cards; long-press drag reorders
// and persists, a tap opens the Entry view (#119), whose 編輯 opens the form,
// and the form's 刪除紀錄 deletes.
export function DayScreen({
  accessToken,
  categories,
  date,
  today = new Date(),
  onBack,
  onChangeDate,
  onEntrySaved,
  onFormState,
  onCategoriesChanged,
  hidden = nothingHidden,
  onChangeHidden,
}: Props) {
  const strings = useStrings();
  // A loaded list carries the date it answers, as the month's dots carry
  // their request (#40): after a swipe or a move (#119) the last day's list
  // must not stand in for this one, so until this date answers, nothing is
  // loaded.
  const [loaded, setLoaded] = useState<{ date: string; entries: Entry[] } | null>(null);
  const entries = loaded?.date === date ? loaded.entries : null;
  const [failed, setFailed] = useState(false);
  const [reorderFailed, setReorderFailed] = useState(false);
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  // The Entry a card tap opened (#119), by id so a reload shows it fresh.
  const [viewingId, setViewingId] = useState<string | null>(null);
  // Retained failed saves for this date (#14), shown as quiet rows above the
  // list; tapping one reopens the form prefilled, where 儲存 retries.
  const [drafts, setDrafts] = useState<EntryDraft[]>([]);
  const [openDraft, setOpenDraft] = useState<EntryDraft | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { visible: actionsVisible, scrollHandlers, clearance } = useFloatingActions();

  // Bumping refresh reloads the list (after a save/edit/delete).
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    listEntries(accessToken, date)
      .then((result) => {
        if (active) {
          setLoaded({ date, entries: result.entries });
          setFailed(false);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [accessToken, date, refresh]);

  useEffect(() => {
    let active = true;
    void listDrafts(date).then((found) => {
      if (active) setDrafts(found);
    });
    return () => {
      active = false;
    };
  }, [date, refresh]);

  // The Entry view lets go of an Entry this day no longer shows, however it
  // went (hidden, moved, deleted elsewhere): back means the day view (#119),
  // so a later reload must not reopen it, nor a later save follow it. Set
  // during render, React's adjust-state-on-change pattern, so no frame
  // renders with the stale id. Not an effect: that renders the stale id once
  // first, and lint's set-state-in-effect rule rejects it.
  if (
    viewingId !== null &&
    entries !== null &&
    !entries.some((entry) => entry.id === viewingId && entryIsVisible(entry, hidden))
  ) {
    setViewingId(null);
  }

  const changed = (change: EntryChange) => {
    setRefresh((n) => n + 1);
    onEntrySaved?.(change);
  };

  if (composing || editing || openDraft) {
    return (
      <EntryFormScreen
        accessToken={accessToken}
        date={date}
        categories={categories}
        // A draft for an already-saved Entry brings its Entry along when the
        // list has it, so the server-side photos still show in the form.
        entry={
          editing ??
          (openDraft?.entryId ? entries?.find((e) => e.id === openDraft.entryId) : undefined)
        }
        draft={openDraft ?? undefined}
        onCategoriesChanged={onCategoriesChanged}
        onFormState={onFormState}
        onDone={(outcome) => {
          setComposing(false);
          setEditing(null);
          setOpenDraft(null);
          // A failed attempt in the form may have kept a draft; success
          // cleared one. Either way this date's rows need a fresh read.
          void listDrafts(date).then(setDrafts);
          // From the Entry view (#119), a save or a cancel returns to the
          // view and a delete lands on the day view.
          switch (outcome.kind) {
            case 'saved':
              changed('saved');
              // A save to a new date moves this screen there, so the view
              // finds the Entry again and back lands on the day it lives on now.
              if (viewingId !== null && outcome.date !== date) onChangeDate?.(outcome.date);
              return;
            case 'deleted':
              changed('deleted');
              setViewingId(null);
              return;
            case 'cancelled':
              return;
          }
        }}
      />
    );
  }

  const persistOrder = async (ordered: Entry[]) => {
    try {
      const result = await reorderDay(accessToken, date, ordered.map((e) => e.id));
      setLoaded({ date, entries: result.entries });
      setReorderFailed(false);
      onEntrySaved?.('reordered');
    } catch {
      // Roll the optimistic order back to server truth and say what failed.
      setReorderFailed(true);
      setRefresh((n) => n + 1);
    }
  };

  const heading = dateHeading(strings, date);
  const visibleEntries = (entries ?? []).filter((entry) => entryIsVisible(entry, hidden));
  const partialDay = visibleEntries.length !== (entries?.length ?? 0);

  // The Entry view (#119) moves over the Entries this day view shows, in its
  // order: Hidden ones are skipped, and a swipe never leaves the day.
  const viewedIndex = visibleEntries.findIndex((entry) => entry.id === viewingId);
  if (viewedIndex >= 0) {
    const viewed = visibleEntries[viewedIndex];
    const previous = visibleEntries[viewedIndex - 1];
    const next = visibleEntries[viewedIndex + 1];
    return (
      <EntryView
        entry={viewed}
        categories={categories}
        position={viewedIndex + 1}
        total={visibleEntries.length}
        onBack={() => setViewingId(null)}
        onEdit={() => setEditing(viewed)}
        {...(previous ? { onPrevious: () => setViewingId(previous.id) } : {})}
        {...(next ? { onNext: () => setViewingId(next.id) } : {})}
      />
    );
  }

  // Day ↔ day swipes (#26), the month pager's gesture family. Flings only
  // recognize fast horizontal movement, so the list's vertical scroll and
  // the long-press drag reorder keep working underneath.
  const flingNext = Gesture.Fling()
    .direction(Directions.LEFT)
    .runOnJS(true)
    .withTestId('day-fling-next')
    .onStart(() => onChangeDate?.(shiftDay(date, 1)));
  const flingPrev = Gesture.Fling()
    .direction(Directions.RIGHT)
    .runOnJS(true)
    .withTestId('day-fling-prev')
    .onStart(() => onChangeDate?.(shiftDay(date, -1)));

  const renderCard = ({ item, drag, isActive }: RenderItemParams<Entry>) => {
    const category = categories.find((c) => c.id === item.categoryId);
    const subcategory = categories.find((c) => c.id === item.subcategoryId);
    const content = decodeContent(item.content);
    return (
      <View style={styles.cardHolder}>
        <EntryCard
          title={content?.title ?? strings.day.unreadable}
          categoryName={category?.name ?? ''}
          categoryColor={category?.color ?? theme.colors.iconMuted}
          categoryIcon={category?.icon ?? 'tag'}
          subcategoryName={subcategory?.name}
          note={content?.note || undefined}
          photos={item.photos?.map((p) => ({ id: p.id, thumbUrl: p.thumbUrl }))}
          dragging={isActive}
          onPress={() => setViewingId(item.id)}
          onLongPress={partialDay ? undefined : drag}
        />
      </View>
    );
  };

  return (
    <GestureDetector gesture={Gesture.Exclusive(flingNext, flingPrev)}>
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        {/* The floats position against this View, not the SafeAreaView: an
            absolute child ignores its parent's safe-area padding. */}
        <View style={styles.fill}>
          <View style={styles.content}>
            <View style={styles.headerRow}>
              {onBack ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={strings.day.back}
                  style={styles.backButton}
                  onPress={onBack}
                >
                  <ChevronLeft size={22} color={theme.colors.iconDefault} strokeWidth={2} />
                </Pressable>
              ) : null}
              <Text style={styles.heading}>{heading}</Text>
              {/* The same 類別 icon the month and year nav bars carry, in the
                  same place and opening the same sheet: visibility is one
                  thing to learn (#41, DESIGN.md §9 as amended 2026-09-12). */}
              {onChangeHidden ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={strings.categories.title}
                  style={styles.navButton}
                  onPress={() => setSheetOpen(true)}
                >
                  <Tags size={20} color={theme.colors.iconDefault} strokeWidth={2} />
                </Pressable>
              ) : null}
            </View>
            {failed ? <Text style={styles.muted}>{strings.day.loadFailed}</Text> : null}
            {reorderFailed ? <Text style={styles.muted}>{strings.day.reorderFailed}</Text> : null}
            {entries !== null && visibleEntries.length === 0 && !failed ? (
              <Text style={styles.muted}>
                {date === localDateString(today) ? strings.day.empty : strings.day.emptyOtherDay}
              </Text>
            ) : null}
            {/* Kept drafts (#14). No canvas artboard exists for these, so the
                quietest surface consistent with the day view: a plain card with
                the title and a flat 尚未儲存 meta line. */}
            {drafts.map((draft) => (
              <Pressable
                key={draft.id}
                accessibilityRole="button"
                style={styles.draftCard}
                onPress={() => setOpenDraft(draft)}
              >
                <Text style={styles.draftTitle}>
                  {decodeContent(draft.content)?.title ?? strings.day.unreadable}
                </Text>
                <Text style={styles.draftMeta}>{strings.day.draftUnsaved}</Text>
              </Pressable>
            ))}
            <DraggableFlatList
              data={visibleEntries}
              keyExtractor={(entry) => entry.id}
              // Without this the list's pan activates on first touch and starves
              // the screen's horizontal flings (#26) everywhere the list sits —
              // most of the screen. 20pt of vertical travel arms the drag pan;
              // horizontal flings never cross it and pass through.
              activationDistance={20}
              renderItem={renderCard}
              onDragEnd={({ data }) => {
                if (partialDay) return; // a partial list can't define the order
                setLoaded({ date, entries: data });
                void persistOrder(data);
              }}
              containerStyle={styles.listContainer}
              contentContainerStyle={[styles.list, clearance]}
              {...scrollHandlers}
            />
          </View>
          <CalendarFloatingActions
            visible={actionsVisible}
            {...(onChangeDate ? { onToday: () => onChangeDate(localDateString(today)) } : {})}
            onAdd={() => setComposing(true)}
          />
          {sheetOpen && onChangeHidden ? (
            <CategorySheet
              accessToken={accessToken}
              categories={categories}
              hidden={hidden}
              onChange={onChangeHidden}
              onCategoriesChanged={() => onCategoriesChanged?.()}
              onClose={() => setSheetOpen(false)}
            />
          ) : null}
        </View>
      </SafeAreaView>
    </GestureDetector>
  );
}

const styles = createStyles((t) => ({
  screen: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  fill: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: t.spacing.screenGutter,
  },
  // The 類別 button is 44 (hitMin) and now the tallest thing in this row,
  // where the 28pt heading used to be. Month and year pair their 44 with
  // space6/space4, so matching that keeps all three headers ending level —
  // the alignment #50 spent four commits on (#41).
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.space3,
    paddingTop: t.spacing.space6,
    paddingBottom: t.spacing.space4,
  },
  backButton: {
    width: t.spacing.space9,
    height: t.spacing.space9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButton: {
    width: t.spacing.hitMin,
    height: t.spacing.hitMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    ...t.typography.navTitle,
    color: t.colors.textPrimary,
    flex: 1,
  },
  muted: {
    ...t.typography.note,
    color: t.colors.textTertiary,
  },
  draftCard: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.card,
    paddingVertical: t.spacing.space5,
    paddingHorizontal: t.spacing.cardPadding,
    marginBottom: t.spacing.space5,
    gap: t.spacing.space1,
  },
  draftTitle: {
    ...t.typography.entryTitle,
    color: t.colors.textPrimary,
  },
  draftMeta: {
    ...t.typography.meta,
    color: t.colors.textTertiary,
  },
  listContainer: {
    flex: 1,
  },
  list: {
    gap: t.spacing.space5,
  },
  cardHolder: {
    marginBottom: 0,
  },
}));
