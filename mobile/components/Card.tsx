import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii } from '../lib/theme';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Solid deep-blue banner style, used for the day's next call / hero moments. */
  tone?: 'glass' | 'solid' | 'flat';
};

// Frosted-glass card look from the reference theme, approximated with a
// translucent white fill + soft border (no native blur module linked into
// the current build, so this is the closest match without a rebuild).
export default function Card({ children, style, tone = 'glass' }: Props) {
  return <View style={[styles.base, toneStyles[tone], style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.xl,
    padding: 16,
  },
});

const toneStyles: Record<NonNullable<Props['tone']>, ViewStyle> = {
  glass: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  solid: {
    backgroundColor: colors.primary,
  },
  flat: {
    backgroundColor: colors.surfaceMuted,
  },
};
