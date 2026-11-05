/* eslint-disable */
/**
 * THROWAWAY PROTOTYPE for #92 (attaching and saving show they are working).
 * Lives only on the `prototype/attach-save` branch and never merges. It exists
 * so Simon can pick a look for the processing tile and the saving overlay on
 * the simulator; the real implementation is written fresh from the chosen
 * variant. Dev-only delays and a forced failure make the states visible.
 */
import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Text, View } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';

import type { ProcessedPhoto } from '../photos/processPhoto';
import { processPhoto } from '../photos/processPhoto';
import { Pressable } from '../theme/press';
import { createStyles, theme } from '../theme';

export type Variant = 'A' | 'B' | 'C';
const VARIANTS: Variant[] = ['A', 'B', 'C'];
const NAMES: Record<Variant, string> = {
  A: 'A · fill tile + scrim card',
  B: 'B · dashed tile + paper veil',
  C: 'C · dimmed preview + ink pill',
};

// Module-level so the choice survives leaving and reopening the form.
let currentVariant: Variant = 'A';

export function useVariant() {
  const [variant, setVariant] = useState<Variant>(currentVariant);
  const cycle = () => {
    const next = VARIANTS[(VARIANTS.indexOf(variant) + 1) % VARIANTS.length];
    currentVariant = next;
    setVariant(next);
  };
  return { variant, cycle };
}

export type ProcessingTile = { key: string; previewUri?: string };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Simulator photos process instantly; in dev each picked photo takes a
// staggered few seconds and the second of a multi-pick fails.
const DELAYS = [2000, 3500, 5000];
export async function prototypeProcess(asset: ImagePickerAsset, index: number): Promise<ProcessedPhoto> {
  if (__DEV__) {
    await wait(DELAYS[index] ?? 5000);
    if (index === 1) throw new Error('prototype: forced failure');
  }
  return processPhoto(asset);
}

/** Dev-only: a save with photos waits this long before it really saves. */
export async function prototypeSaveDelay(hasPhotos: boolean) {
  if (__DEV__ && hasPhotos) await wait(4000);
}

export function ProcessingTileView({ variant, size, previewUri }: { variant: Variant; size: number; previewUri?: string }) {
  const box = { width: size, height: size };
  if (variant === 'A') {
    return (
      <View accessible accessibilityLabel="處理中" style={[styles.tileA, box]}>
        <ActivityIndicator size="small" color={theme.colors.iconMuted} />
      </View>
    );
  }
  if (variant === 'B') {
    return (
      <View accessible accessibilityLabel="處理中" style={[styles.tileB, box]}>
        <ActivityIndicator size="small" color={theme.colors.iconMuted} />
        <Text style={styles.tileBLabel}>處理中</Text>
      </View>
    );
  }
  return (
    <View accessible accessibilityLabel="處理中" style={[styles.tileC, box]}>
      {previewUri ? <Image source={{ uri: previewUri }} style={[styles.tileCImage, box]} /> : null}
      <View style={[styles.tileCDim, box]}>
        <ActivityIndicator size="small" color={theme.colors.textOnDark} />
      </View>
    </View>
  );
}

export function SavingOverlay({ variant, visible }: { variant: Variant; visible: boolean }) {
  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      {variant === 'A' ? (
        <View style={styles.scrimA} accessibilityViewIsModal>
          <View style={styles.cardA} accessible accessibilityLabel="儲存中">
            <ActivityIndicator size="large" color={theme.colors.textSecondary} />
            <Text style={styles.cardALabel}>儲存中</Text>
          </View>
        </View>
      ) : variant === 'B' ? (
        <View style={styles.veilB} accessibilityViewIsModal accessible accessibilityLabel="儲存中">
          <ActivityIndicator size="large" color={theme.colors.textSecondary} />
          <Text style={styles.veilBLabel}>儲存中</Text>
        </View>
      ) : (
        <View style={styles.scrimC} accessibilityViewIsModal>
          <View style={styles.pillC} accessible accessibilityLabel="儲存中">
            <ActivityIndicator size="small" color={theme.colors.textOnDark} />
            <Text style={styles.pillCLabel}>儲存中</Text>
          </View>
        </View>
      )}
    </Modal>
  );
}

/** Off-palette on purpose: this pill is not the design. */
export function VariantSwitcher({ variant, onCycle }: { variant: Variant; onCycle: () => void }) {
  if (!__DEV__) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 48, alignItems: 'center' }}>
      <Pressable
        onPress={onCycle}
        style={{ backgroundColor: '#FF00CC', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>{`#92 ${NAMES[variant]} ▸`}</Text>
      </Pressable>
    </View>
  );
}

const styles = createStyles((t) => ({
  tileA: {
    borderRadius: t.radius.photo,
    backgroundColor: t.colors.surfaceFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileB: {
    borderRadius: t.radius.photo,
    borderWidth: t.border.hairline,
    borderStyle: 'dashed',
    borderColor: t.colors.lineSeparatorStrong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.space1,
  },
  tileBLabel: {
    ...t.typography.meta,
    color: t.colors.textTertiary,
  },
  tileC: {
    borderRadius: t.radius.photo,
    backgroundColor: t.colors.surfaceFillStrong,
    overflow: 'hidden',
  },
  tileCImage: {
    position: 'absolute',
  },
  tileCDim: {
    position: 'absolute',
    backgroundColor: t.colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrimA: {
    flex: 1,
    backgroundColor: t.colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardA: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.card,
    paddingHorizontal: t.spacing.space8,
    paddingVertical: t.spacing.space6,
    alignItems: 'center',
    gap: t.spacing.space3,
  },
  cardALabel: {
    ...t.typography.meta,
    color: t.colors.textSecondary,
  },
  veilB: {
    flex: 1,
    backgroundColor: t.colors.materialBar,
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.space3,
  },
  veilBLabel: {
    ...t.typography.entryTitle,
    color: t.colors.textSecondary,
  },
  scrimC: {
    flex: 1,
    backgroundColor: t.colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillC: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.space3,
    backgroundColor: t.colors.controlPrimaryBg,
    borderRadius: t.radius.pill,
    paddingHorizontal: t.spacing.space6,
    paddingVertical: t.spacing.space4,
  },
  pillCLabel: {
    ...t.typography.meta,
    color: t.colors.textOnDark,
  },
}));
