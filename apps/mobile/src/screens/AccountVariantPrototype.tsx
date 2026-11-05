/* eslint-disable */
/**
 * THROWAWAY PROTOTYPE for #21 (忘記密碼, sign-up by code) and #20 (連結帳戶).
 * Lives only on the `prototype/email-and-linking` branch and never merges.
 * One magenta pill cycles A/B/C across all three surfaces; the real
 * implementation is written fresh from the chosen variant.
 */
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Pressable } from '../theme/press';

export type Variant = 'A' | 'B' | 'C';
const VARIANTS: Variant[] = ['A', 'B', 'C'];
const NAMES: Record<Variant, string> = {
  A: 'A · in place',
  B: 'B · page per step',
  C: 'C · sheet',
};

// Module-level so the choice survives remounts, with listeners so every
// mounted surface (Settings, the email page, a sheet) flips together.
let currentVariant: Variant = 'A';
const listeners = new Set<(v: Variant) => void>();
const resetListeners = new Set<() => void>();

function cycleVariant() {
  currentVariant = VARIANTS[(VARIANTS.indexOf(currentVariant) + 1) % VARIANTS.length];
  listeners.forEach((l) => l(currentVariant));
}

export function useVariant(): Variant {
  const [variant, setVariant] = useState<Variant>(currentVariant);
  useEffect(() => {
    listeners.add(setVariant);
    return () => {
      listeners.delete(setVariant);
    };
  }, []);
  return variant;
}

/** Long-pressing the pill calls these: put every stub back to its first state. */
export function useOnPrototypeReset(reset: () => void) {
  useEffect(() => {
    resetListeners.add(reset);
    return () => {
      resetListeners.delete(reset);
    };
  }, [reset]);
}

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Off-palette on purpose: this pill is not the design. Tap cycles, long-press resets. */
export function VariantSwitcher({ label }: { label: string }) {
  const variant = useVariant();
  const insets = useSafeAreaInsets();
  if (!__DEV__) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: insets.top + 8, right: 12, alignItems: 'flex-end' }}
    >
      <Pressable
        onPress={cycleVariant}
        onLongPress={() => resetListeners.forEach((r) => r())}
        style={{ backgroundColor: '#FF00CC', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>{`${label} ${NAMES[variant]} ▸`}</Text>
      </Pressable>
    </View>
  );
}
