import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Text, View, useWindowDimensions } from 'react-native';
import { Directions, Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Category, Entry } from '../api/client';
import { CategoryIcon } from '../calendar/CategoryIcon';
import { dateHeading } from '../calendar/dateLabel';
import { deriveInk, deriveTint } from '../categories/colorDerivation';
import { useStrings } from '../i18n/AppLanguageProvider';
import { Pressable } from '../theme/press';
import { createStyles, theme } from '../theme';

import { decodeContent } from './content';
import { PhotoViewer } from './PhotoViewer';

type Props = {
  entry: Entry;
  categories: Category[];
  /** 1-based place among the day's visible Entries, and their count. */
  position: number;
  total: number;
  onBack: () => void;
  onEdit: () => void;
  /** Absent at the first Entry: the swipe stops there. */
  onPrevious?: () => void;
  /** Absent at the last Entry. */
  onNext?: () => void;
};

// Photos sit three to a row, each a third of the content width: never a
// carousel (DESIGN.md ban 11). An Entry saved under the old cap of ten
// wraps onto further rows.
const PHOTOS_PER_ROW = 3;

// The Entry view (#119): one Entry to read, between the day view's card and
// the form, laid out as variant B (文章頁, #117) as amended 2026-11-04: the
// words first and the photos last, as on the card and in the form, with no
// large first photo. Everything here is whole; the card's line limits
// (#116) are the card's.
export function EntryView({
  entry,
  categories,
  position,
  total,
  onBack,
  onEdit,
  onPrevious,
  onNext,
}: Props) {
  const strings = useStrings();
  const contentWidth = useWindowDimensions().width - theme.spacing.screenGutter * 2;
  const photoSize = (contentWidth - theme.spacing.photoGridGap * (PHOTOS_PER_ROW - 1)) / PHOTOS_PER_ROW;

  const category = categories.find((c) => c.id === entry.categoryId);
  const subcategory = categories.find((c) => c.id === entry.subcategoryId);
  const color = category?.color ?? theme.colors.iconMuted;
  const categoryLine = subcategory
    ? `${category?.name ?? ''} · ${subcategory.name}`
    : (category?.name ?? '');
  const content = decodeContent(entry.content);
  const photos = entry.photos ?? [];
  // The photo a tap opened in the viewer (#114), by index into photos.
  const [viewingPhoto, setViewingPhoto] = useState<number | null>(null);

  // Entry ↔ Entry within the day, the day view's fling family (#26) one
  // level in. Flings only recognize fast horizontal movement, so the page's
  // vertical scroll keeps working underneath; the photo viewer is a Modal,
  // its own window, so its pager never meets these. Never across days:
  // that would make this a fourth surface applying the Filter (ADR 0009).
  const flingNext = Gesture.Fling()
    .direction(Directions.LEFT)
    .runOnJS(true)
    .withTestId('entry-fling-next')
    .onStart(() => onNext?.());
  const flingPrev = Gesture.Fling()
    .direction(Directions.RIGHT)
    .runOnJS(true)
    .withTestId('entry-fling-prev')
    .onStart(() => onPrevious?.());

  return (
    <GestureDetector gesture={Gesture.Exclusive(flingNext, flingPrev)}>
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.bar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={strings.day.back}
            style={styles.barButton}
            onPress={onBack}
          >
            <ChevronLeft size={22} color={theme.colors.iconDefault} strokeWidth={2} />
          </Pressable>
          {/* The only position marker. Spans the bar to centre on the screen,
              so it must not take the buttons' taps. */}
          <View style={styles.positionHolder} pointerEvents="none">
            <Text style={styles.position}>{strings.entryView.position(position, total)}</Text>
          </View>
          <Pressable accessibilityRole="button" style={styles.barButton} onPress={onEdit}>
            <Text style={styles.editLabel}>{strings.entryView.edit}</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.page}>
          <View style={[styles.chip, { backgroundColor: deriveTint(color) }]}>
            <CategoryIcon icon={category?.icon ?? 'tag'} color={color} size={18} />
            <Text style={[styles.chipLabel, { color: deriveInk(color) }]}>{categoryLine}</Text>
          </View>
          {/* The date reads as the title's byline, so the two share a block
              rather than taking the page's gap between them. */}
          <View style={styles.heading}>
            <Text style={styles.title}>{content?.title ?? strings.day.unreadable}</Text>
            <Text style={styles.date}>{dateHeading(strings, entry.date)}</Text>
          </View>
          {content?.note ? <Text style={styles.note}>{content.note}</Text> : null}
          {photos.length > 0 ? (
            <View style={styles.photos}>
              {photos.map((photo, index) => (
                <Pressable
                  key={photo.id}
                  accessibilityRole="imagebutton"
                  onPress={() => setViewingPhoto(index)}
                >
                  <Image
                    testID={`entry-photo-${photo.id}`}
                    source={{ uri: photo.thumbUrl }}
                    style={[styles.photo, { width: photoSize, height: photoSize }]}
                  />
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>
        {viewingPhoto !== null ? (
          <PhotoViewer
            photos={photos.map((p) => ({ key: p.id, uri: p.url, thumbUri: p.thumbUrl }))}
            startIndex={viewingPhoto}
            onClose={() => setViewingPhoto(null)}
          />
        ) : null}
      </SafeAreaView>
    </GestureDetector>
  );
}

const styles = createStyles((t) => ({
  screen: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: t.spacing.navBarHeight,
    paddingHorizontal: t.spacing.screenGutter,
  },
  positionHolder: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  position: {
    ...t.typography.sectionHeader,
    color: t.colors.textSecondary,
  },
  barButton: {
    minWidth: t.spacing.hitMin,
    height: t.spacing.hitMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editLabel: {
    ...t.typography.sectionHeader,
    color: t.colors.controlGhostFg,
  },
  page: {
    paddingHorizontal: t.spacing.screenGutter,
    paddingTop: t.spacing.space4,
    paddingBottom: t.spacing.space10,
    gap: t.spacing.space5,
  },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.space3,
    paddingVertical: t.spacing.space2,
    paddingLeft: t.spacing.space2,
    paddingRight: t.spacing.space5,
    borderRadius: t.radius.pill,
  },
  chipLabel: {
    ...t.typography.meta,
    fontWeight: '600',
  },
  heading: {
    gap: t.spacing.space1,
  },
  title: {
    ...t.typography.navTitle,
    color: t.colors.textPrimary,
  },
  date: {
    ...t.typography.meta,
    color: t.colors.textTertiary,
  },
  note: {
    ...t.typography.entryTitle,
    color: t.colors.textSecondary,
  },
  photos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.photoGridGap,
  },
  photo: {
    borderRadius: t.radius.photo,
    backgroundColor: t.colors.surfaceFill,
  },
}));
