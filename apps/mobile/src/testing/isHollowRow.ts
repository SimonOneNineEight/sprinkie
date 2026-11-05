import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

/**
 * Whether the 類別 sheet row named `name` draws its icon hollow, as a hidden
 * family's is (#30, #109).
 *
 * This reads the resolved style rather than anything a person could tap or
 * read, the same departure from #45's testing rule expectSingleLineField
 * makes: hollow exists on screen only as a border where a fill was, and jest
 * paints neither. It walks up from the name to the row's button, then looks
 * for the outlined box inside it (CategoryIcon's hollow treatment).
 */
export function isHollowRow(name: string): boolean {
  let row = screen.getByText(name);
  while (row.props.accessibilityRole !== 'button') row = row.parent!;
  const outlined = row.findAll(
    (node) =>
      typeof node.type === 'string' &&
      (StyleSheet.flatten(node.props.style) as { borderWidth?: number } | undefined)?.borderWidth === 1.5,
  );
  return outlined.length > 0;
}
