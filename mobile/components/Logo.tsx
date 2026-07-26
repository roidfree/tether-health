import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../lib/theme';

type Props = {
  size?: number;
  /** Set false on dark/blue banners where a light wordmark reads better. */
  dark?: boolean;
  showWordmark?: boolean;
};

// The Tether mark + wordmark. Only shown on the login screen - see
// app/login.tsx - everywhere else in the app (onboarding, tab headers) has
// had it removed to keep the brand moment to that one first-impression
// screen. Wordmark size scales with the icon's `size` so a bigger `size`
// (as login uses) reads as one bigger lockup rather than a big icon next to
// small text.
export default function Logo({ size = 42, dark = true, showWordmark = true }: Props) {
  return (
    <View style={[styles.row, { gap: size * 0.24 }]}>
      <View style={[styles.badge, { width: size, height: size, borderRadius: size * 0.32 }]}>
        <Image
          source={require('../assets/tether-logo.png')}
          style={{ width: size * 0.72, height: size * 0.6 }}
          resizeMode="contain"
        />
      </View>
      {showWordmark && (
        <Text
          style={[
            styles.wordmark,
            { color: dark ? colors.textPrimary : colors.textOnPrimary, fontSize: size * 0.52 },
          ]}
        >
          Tether
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#061630',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  wordmark: { fontFamily: fonts.extraBold, letterSpacing: -0.5 },
});
