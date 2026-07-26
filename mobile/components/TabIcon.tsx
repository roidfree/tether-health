import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';

type IoniconName = keyof typeof Ionicons.glyphMap;

// Builds a tabBarIcon renderer for a given base icon, swapping to the
// filled variant when the tab is focused (outline otherwise) - shared by
// every tab group (home, carer-home, cared-for) so icon choice/behavior
// stays consistent across account types.
export function tabIcon(outlineName: IoniconName, filledName: IoniconName) {
  return ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <Ionicons name={focused ? filledName : outlineName} size={size} color={color as string} />
  );
}
