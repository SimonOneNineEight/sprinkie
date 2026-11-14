import { Tags } from 'lucide-react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useStrings } from '../i18n/AppLanguageProvider';
import { Pressable } from '../theme/press';
import { theme } from '../theme';

// The 類別 nav button the month, year and day views share (#41). While a
// Filter is on its glyph fills in ink (#134), the one sign on the calendar
// that it is showing a chosen part of the Journal.
export function CategoriesButton({
  filtering,
  style,
  onPress,
}: {
  filtering: boolean;
  style: StyleProp<ViewStyle>;
  onPress: () => void;
}) {
  const strings = useStrings();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={filtering ? strings.categories.titleFiltered : strings.categories.title}
      style={style}
      onPress={onPress}
    >
      <Tags
        size={20}
        color={filtering ? theme.colors.textPrimary : theme.colors.iconDefault}
        fill={filtering ? theme.colors.textPrimary : 'none'}
        strokeWidth={2}
      />
    </Pressable>
  );
}
