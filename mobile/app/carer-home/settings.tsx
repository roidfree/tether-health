import { SafeAreaView } from 'react-native-safe-area-context';

import CarerSettingsPanel from '../../components/CarerSettingsPanel';
import { colors } from '../../lib/theme';

export default function CarerHomeSettings() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <CarerSettingsPanel />
    </SafeAreaView>
  );
}
