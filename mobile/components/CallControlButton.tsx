import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../lib/theme';

type IoniconName = keyof typeof Ionicons.glyphMap;

type Props = {
  icon: IoniconName;
  label: string;
  onPress: () => void;
  /** Highlights the circle (like iOS's own call screen toggling mute on). */
  active?: boolean;
  variant?: 'toggle' | 'danger';
  /** Degrees to rotate the icon - used to turn the "call" glyph into a hang-up icon. */
  rotateIcon?: number;
  size?: number;
};

// Matches the iPhone in-call screen convention: a circular icon button with
// its label underneath rather than inside the circle (previously the end
// call button had its label inside the circle itself).
export default function CallControlButton({
  icon,
  label,
  onPress,
  active = false,
  variant = 'toggle',
  rotateIcon = 0,
  size = 64,
}: Props) {
  const isDanger = variant === 'danger';

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.circle,
          { width: size, height: size, borderRadius: size / 2 },
          isDanger ? styles.danger : active ? styles.toggleActive : styles.toggleIdle,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name={icon}
          size={size * 0.42}
          color={isDanger || !active ? colors.textOnPrimary : colors.primaryDark}
          style={rotateIcon ? { transform: [{ rotate: `${rotateIcon}deg` }] } : undefined}
        />
      </Pressable>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8 },
  circle: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
  toggleIdle: { backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  toggleActive: { backgroundColor: colors.textOnPrimary },
  danger: { backgroundColor: colors.danger },
  label: { color: colors.textOnPrimary, fontSize: 13, fontFamily: fonts.semiBold },
});
