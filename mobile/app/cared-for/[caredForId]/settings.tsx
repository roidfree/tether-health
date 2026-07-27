import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import AppButton from '../../../components/AppButton';
import CarerSettingsPanel from '../../../components/CarerSettingsPanel';
import * as api from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { useTranslation } from '../../../lib/i18n';
import { colors, fonts } from '../../../lib/theme';
import { useCaredFor } from './_layout';

// The carer's own settings (app language, logout) are general to the carer's
// account, not scoped to whichever cared-for they're currently viewing - see
// CarerSettingsPanel. Removing a cared-for, on the other hand, is specific to
// *this* person, so that section is passed in as children rather than living
// in the shared panel.
export default function CaredForSettings() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const { caredForId, caredForName } = useCaredFor();
  const [removing, setRemoving] = useState(false);

  const onRemove = () => {
    if (!token) return;
    Alert.alert(
      t('removeCaredForConfirmTitle', { name: caredForName ?? '' }),
      t('removeCaredForConfirmMessage'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('remove'),
          style: 'destructive',
          onPress: async () => {
            setRemoving(true);
            try {
              await api.unlinkCaredFor(token, caredForId);
              router.back();
            } catch (err: any) {
              Alert.alert(t('couldNotRemoveCaredFor'), err.message ?? 'Something went wrong');
              setRemoving(false);
            }
          },
        },
      ]
    );
  };

  return (
    <CarerSettingsPanel>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{caredForName}</Text>
        <AppButton
          title={t('removeCaredForButton')}
          variant="danger"
          onPress={onRemove}
          disabled={removing}
          loading={removing}
        />
      </View>
    </CarerSettingsPanel>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary },
});
