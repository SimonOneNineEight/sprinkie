import { GripHorizontal } from 'lucide-react-native';
import { Text, View, useWindowDimensions } from 'react-native';

import { CategoryIcon } from '../calendar/CategoryIcon';
import { Pressable } from '../theme/press';
import { createStyles, theme } from '../theme';

import { PhotoGrid } from './PhotoGrid';

type Props = {
  title: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  subcategoryName?: string;
  note?: string;
  photos?: { id: string; thumbUrl: string }[];
  dragging?: boolean;
  onPress: () => void;
  /** Absent while the calendar filter shows a partial list (#13). */
  onLongPress?: () => void;
};

// Day-view entry card per the canvas EntryCard: category icon, title, the
// category · subcategory line, note preview, and a grip. The photo grid
// arrives with #8, the card shadow when elevation tokens land.
export function EntryCard({
  title,
  categoryName,
  categoryColor,
  categoryIcon,
  subcategoryName,
  note,
  photos,
  dragging,
  onPress,
  onLongPress,
}: Props) {
  const categoryLine = subcategoryName ? `${categoryName} · ${subcategoryName}` : categoryName;
  // Card inner width: screen minus the day view's gutters and card padding.
  const cardGridWidth =
    useWindowDimensions().width - theme.spacing.screenGutter * 2 - theme.spacing.cardPadding * 2;
  return (
    <Pressable
      accessibilityRole="button"
      style={[styles.card, dragging && styles.cardDragging]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={200}
    >
      {/* One center-aligned row (#31): icon, title, and grip share a visual
          line no matter how the platform seats glyphs in the line box; the
          category line hangs beneath, indented to the title's left edge. The
          title runs to three lines and the note to five (#116); the card
          grows rather than scrolls, since its list scrolls and drags. */}
      <View style={styles.titleRow}>
        <CategoryIcon icon={categoryIcon} color={categoryColor} />
        <Text style={styles.title} numberOfLines={3}>
          {title}
        </Text>
        <GripHorizontal size={18} color={theme.colors.textQuaternary} strokeWidth={2} />
      </View>
      <Text style={styles.categoryLine} numberOfLines={1}>
        {categoryLine}
      </Text>
      {note ? (
        <Text style={styles.note} numberOfLines={5}>
          {note}
        </Text>
      ) : null}
      {photos && photos.length > 0 ? (
        <View style={styles.photos}>
          <PhotoGrid
            photos={photos.map((p) => ({ key: p.id, uri: p.thumbUrl }))}
            width={cardGridWidth}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = createStyles((t) => ({
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.card,
    padding: t.spacing.cardPadding,
  },
  cardDragging: {
    backgroundColor: t.colors.surfaceSunken,
    borderWidth: t.border.hairline,
    borderColor: t.colors.lineSeparatorStrong,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.space5,
  },
  title: {
    ...t.typography.entryTitle,
    color: t.colors.textPrimary,
    flex: 1,
  },
  categoryLine: {
    ...t.typography.meta,
    color: t.colors.textTertiary,
    marginTop: t.spacing.space1,
    // Indented under the title: the icon's 22px box plus the row gap.
    marginLeft: 22 + t.spacing.space5,
  },
  note: {
    ...t.typography.note,
    color: t.colors.textSecondary,
    marginTop: t.spacing.space5,
  },
  photos: {
    marginTop: t.spacing.space5,
  },
}));
