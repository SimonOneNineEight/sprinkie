import { Text, View } from 'react-native';

import { useStrings } from '../i18n/AppLanguageProvider';
import { Pressable } from '../theme/press';
import { createStyles, theme } from '../theme';
import { weekRows } from './monthMath';

/**
 * How tall this component renders for a given month. The year ribbon (#51)
 * virtualises mini months and needs exact heights to land a scroll on a month
 * rather than near it, and reconstructing these numbers at the call site meant
 * a margin changed here would silently shorten every offset there. The styles
 * below are the only place these tokens are read.
 */
const LABEL_GAP = theme.spacing.space3;
const CELL_GAP = theme.spacing.space1;
/** One week row: a day box plus the gap under it. */
const WEEK_ROW = theme.yearBox.size + CELL_GAP;

export function miniMonthHeight(year: number, month: number): number {
  return theme.typography.meta.lineHeight + LABEL_GAP + weekRows(year, month) * WEEK_ROW;
}

type Props = {
  year: number;
  /** 1-based month. */
  month: number;
  /** Day number → the day's first Entry's category color. */
  colors: Record<number, string>;
  /** Today's day number when this mini month contains today. */
  todayDay?: number;
  onPress: () => void;
};

// One mini month of the year view (#12): a recorded day is a solid rounded
// box in its FIRST Entry's color with the numeral punched out in white —
// one color per day, never stripes. Today gets a ring only while uncolored.
export function MiniMonth({ year, month, colors, todayDay, onPress }: Props) {
  const strings = useStrings();
  const leading = new Date(year, month - 1, 1).getDay();
  const dayCount = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: dayCount }, (_, i) => i + 1),
  ];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={strings.year.monthLabel(month)}
      style={styles.month}
      onPress={onPress}
    >
      <Text style={styles.label}>{strings.year.monthLabel(month)}</Text>
      <View style={styles.grid}>
        {cells.map((day, index) => {
          const color = day ? colors[day] : undefined;
          const isToday = day !== null && day === todayDay;
          return (
            <View key={index} style={styles.cell}>
              {day !== null ? (
                <View
                  testID={color ? `year-day-${month}-${day}` : undefined}
                  style={[
                    styles.box,
                    color ? { backgroundColor: color } : null,
                    !color && isToday ? styles.boxToday : null,
                  ]}
                >
                  <Text style={[styles.numeral, color ? styles.numeralOnColor : null]}>{day}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

const styles = createStyles((t) => ({
  month: {},
  label: {
    ...t.typography.meta,
    fontWeight: '600',
    color: t.colors.textPrimary,
    marginBottom: LABEL_GAP,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    paddingRight: CELL_GAP,
    marginBottom: CELL_GAP,
  },
  box: {
    height: WEEK_ROW - CELL_GAP,
    borderRadius: t.yearBox.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxToday: {
    borderWidth: 1,
    borderColor: t.colors.textPrimary,
  },
  numeral: {
    ...t.typography.yearNumeral,
    color: t.colors.textTertiary,
  },
  numeralOnColor: {
    color: t.colors.textOnDark,
  },
}));
