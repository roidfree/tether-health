import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

import { colors } from '../lib/theme';

type Props = { size?: number; color?: string };

// The small breathing dot used for "live"/"in progress" indicators
// throughout the reference theme (the call screen's "TETHER · LIVE" badge,
// the Home screen's current-dose icon) - shared so every instance pulses
// identically.
export default function PulseDot({ size = 8, color = colors.accent }: Props) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: pulse,
        transform: [{ scale: pulse }],
      }}
    />
  );
}
