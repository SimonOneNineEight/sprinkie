import DateTimePicker from '@react-native-community/datetimepicker';

import { theme } from '../theme';

// The one time wheel the Reminder is picked with, in the first-save invite
// (#138) and in 設定's 提醒時間 sheet (#142): iOS's spinner in 5-minute steps.
export function ReminderWheel({
  testID,
  accessibilityLabel,
  value,
  onChange,
}: {
  testID: string;
  accessibilityLabel: string;
  value: Date;
  onChange: (date: Date) => void;
}) {
  return (
    <DateTimePicker
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      value={value}
      mode="time"
      display="spinner"
      minuteInterval={5}
      themeVariant="light"
      accentColor={theme.colors.ink}
      textColor={theme.colors.textPrimary}
      onValueChange={(_, date) => onChange(date)}
    />
  );
}
