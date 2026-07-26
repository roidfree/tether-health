// Applies the app's default typeface to every <Text>/<TextInput> without
// having to touch each screen's individual style objects - only imported
// once, as a side effect, from the root layout after fonts have loaded.
import { Text, TextInput } from 'react-native';

import { fonts } from './theme';

export function applyDefaultFont() {
  const textAny = Text as any;
  textAny.defaultProps = textAny.defaultProps || {};
  textAny.defaultProps.style = [{ fontFamily: fonts.regular }, textAny.defaultProps.style];

  const inputAny = TextInput as any;
  inputAny.defaultProps = inputAny.defaultProps || {};
  inputAny.defaultProps.style = [{ fontFamily: fonts.regular }, inputAny.defaultProps.style];
}
