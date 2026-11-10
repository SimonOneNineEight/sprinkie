// Manual mock, auto-applied: the native time picker cannot render in jest.
// A plain stand-in: it shows its time as an accessibility value (HH:MM),
// and a test sets one with fireEvent(picker, 'change', { type: 'set' }, date),
// as the native picker reports a choice.
import { View } from 'react-native';

type Props = {
  testID?: string;
  accessibilityLabel?: string;
  value: Date;
  onChange?: (event: { type: string }, date?: Date) => void;
};

export default function DateTimePicker({ testID, accessibilityLabel, value }: Props) {
  const time = `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  return (
    <View testID={testID} accessibilityLabel={accessibilityLabel} accessibilityValue={{ text: time }} />
  );
}
