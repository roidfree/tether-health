import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii } from '../lib/theme';

// The floating frosted "dock" tab bar from the reference theme's Home screen
// (wellnest-export-src.dc.html, "02 · TODAY — HOME") - a rounded glass pill
// that floats above the bottom edge rather than a flush full-width bar, with
// the active tab getting its own light-blue pill behind the icon+label.
// Shared by every tab group (home, carer-home, cared-for) for a consistent
// look across account types.
export default function GlassTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <View style={styles.dock}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = (options.title ?? route.name) as string;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          const icon = options.tabBarIcon?.({
            focused: isFocused,
            color: isFocused ? colors.primary : colors.textMuted,
            size: 18,
          });

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              style={[styles.tab, isFocused && styles.tabActive]}
            >
              {icon}
              <Text style={[styles.label, isFocused && styles.labelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 16, paddingTop: 8 },
  dock: {
    flexDirection: 'row',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radii.xl + 4,
    padding: 7,
    shadowColor: colors.primaryDeep,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 8,
    borderRadius: radii.lg + 1,
  },
  tabActive: { backgroundColor: colors.tint },
  label: { fontSize: 11, fontFamily: fonts.medium, color: colors.textMuted },
  labelActive: { color: colors.primary, fontFamily: fonts.bold },
});
