import { Camera, X } from 'lucide-react-native';
import { Image, Text, View, useWindowDimensions } from 'react-native';
import DraggableGrid from 'react-native-draggable-grid';

import { useStrings } from '../i18n/AppLanguageProvider';
import { Pressable } from '../theme/press';
import { createStyles, theme } from '../theme';
import type { ProcessingTile, Variant } from './AttachSavePrototype';
import { ProcessingTileView } from './AttachSavePrototype';

export type GridPhoto = {
  key: string;
  uri: string;
};

type EditableProps = {
  onAdd: () => void;
  onOpen: (key: string) => void;
  onRemove: (key: string) => void;
  onReorder: (keys: string[]) => void;
};

type Props = {
  photos: GridPhoto[];
  max?: number;
  /** Present in the entry form; absent on read-only surfaces (day cards). */
  editable?: EditableProps;
  /** Horizontal space the grid may fill; defaults to the window width minus gutters. */
  width?: number;
  /** #92 prototype: placeholder tiles for photos still processing. */
  processing?: ProcessingTile[];
  variant?: Variant;
};

const COLUMNS = 4;
const ADD_KEY = '__add__';

/**
 * Client-side mirror of the server's per-entry photo cap, lowered from 10
 * to 3 (#44, ratified 2026-09-12): a day's record is a glance, not an
 * album. The server is what enforces it; this is what the User sees.
 */
export const MAX_PHOTOS = 3;

// The ✕ chip sits in from the tile's corner; its slop reaches the 44pt hit
// target by growing into the tile, never past its edge, where the
// neighbouring tile would take the touch instead (#118).
const REMOVE_CHIP = 20;
const REMOVE_INSET = theme.spacing.space2;
const REMOVE_REACH = theme.spacing.hitMin - REMOVE_CHIP - REMOVE_INSET;
const REMOVE_HIT_SLOP = { top: REMOVE_INSET, right: REMOVE_INSET, bottom: REMOVE_REACH, left: REMOVE_REACH };

// Photo grid per the canvas: square tiles, 4 columns, never a carousel.
// Editing: tap a tile to open it in the viewer, tap its ✕ to remove it
// (#118), long-press-drag to reorder, and the dashed tile adds (camera + n/3).
// Every photo handed in renders, cap or no cap: an Entry saved under the
// old cap of 10 keeps all of them and simply cannot gain more (#44).
export function PhotoGrid({ photos, max = MAX_PHOTOS, editable, width, processing = [], variant = 'A' }: Props) {
  const strings = useStrings();
  const { width: windowWidth } = useWindowDimensions();
  const gridWidth = width ?? windowWidth - theme.spacing.screenGutter * 2;
  const tile = (gridWidth - theme.spacing.photoGridGap * (COLUMNS - 1)) / COLUMNS;

  if (!editable) {
    return (
      <View style={styles.staticGrid}>
        {photos.map((photo) => (
          <Image
            key={photo.key}
            source={{ uri: photo.uri }}
            style={[styles.tile, { width: tile, height: tile }]}
          />
        ))}
      </View>
    );
  }

  const items = photos.map((photo) => ({ ...photo, disabledDrag: false, disabledReSorted: false }));
  const pending = processing.map((p) => ({ key: p.key, uri: p.previewUri ?? '', disabledDrag: true, disabledReSorted: true }));
  const occupied = items.length + pending.length;
  const withAdd =
    occupied < max
      ? [...items, ...pending, { key: ADD_KEY, uri: '', disabledDrag: true, disabledReSorted: true }]
      : [...items, ...pending];

  return (
    <DraggableGrid
      numColumns={COLUMNS}
      data={withAdd}
      itemHeight={tile + theme.spacing.photoGridGap}
      style={{ width: gridWidth }}
      onItemPress={(item: GridPhoto) => {
        if (item.key.startsWith('processing:')) return; // a processing tile ignores taps
        if (item.key === ADD_KEY) {
          editable.onAdd();
        } else {
          editable.onOpen(item.key);
        }
      }}
      onDragRelease={(data: GridPhoto[]) => {
        editable.onReorder(data.filter((d) => d.key !== ADD_KEY && !d.key.startsWith('processing:')).map((d) => d.key));
      }}
      renderItem={(item: GridPhoto) =>
        item.key.startsWith('processing:') ? (
          <ProcessingTileView variant={variant} size={tile} previewUri={item.uri || undefined} />
        ) : item.key === ADD_KEY ? (
          <View style={[styles.addTile, { width: tile, height: tile }]}>
            <Camera size={18} color={theme.colors.iconMuted} strokeWidth={2} />
            <Text style={styles.addCount}>{`${occupied}/${max}`}</Text>
          </View>
        ) : (
          <View style={{ width: tile, height: tile }}>
            <Image source={{ uri: item.uri }} style={[styles.tile, { width: tile, height: tile }]} />
            {/* Nested inside the grid's own touchable, the ✕ is the deeper
                responder and takes the tap before the tile can (#118). */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={strings.photos.remove}
              hitSlop={REMOVE_HIT_SLOP}
              style={styles.removeChip}
              onPress={() => editable.onRemove(item.key)}
            >
              <X size={12} color={theme.colors.textOnDark} strokeWidth={2.25} />
            </Pressable>
          </View>
        )
      }
    />
  );
}

const styles = createStyles((t) => ({
  staticGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.photoGridGap,
  },
  tile: {
    borderRadius: t.radius.photo,
    backgroundColor: t.colors.surfaceFillStrong,
  },
  addTile: {
    borderRadius: t.radius.photo,
    backgroundColor: t.colors.surfaceFill,
    borderWidth: t.border.hairline,
    borderStyle: 'dashed',
    borderColor: t.colors.lineSeparatorStrong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.space1,
  },
  addCount: {
    ...t.typography.dotOverflow,
    color: t.colors.textTertiary,
  },
  removeChip: {
    position: 'absolute',
    top: REMOVE_INSET,
    right: REMOVE_INSET,
    width: REMOVE_CHIP,
    height: REMOVE_CHIP,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
