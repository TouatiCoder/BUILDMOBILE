import { useState } from 'react';
import { View } from 'react-native';

import type { SupplierInput } from '@/api/endpoints';
import type { Supplier } from '@/api/types';
import { AppButton, AppText } from '@/components/primitives';
import { AppInput } from '@/components/fields';
import { Screen } from '@/components/layout';
import { useI18n } from '@/i18n/I18nProvider';
import { colors, spacing } from '@/theme/tokens';

export function SupplierForm({
  supplier,
  submitting,
  onSubmit,
}: {
  supplier?: Supplier;
  submitting: boolean;
  onSubmit: (input: SupplierInput) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(supplier?.name ?? '');
  const [contactPerson, setContactPerson] = useState(supplier?.contactPerson ?? '');
  const [email, setEmail] = useState(supplier?.email ?? '');
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [address, setAddress] = useState(supplier?.address ?? '');
  const [error, setError] = useState('');

  return (
    <Screen>
      <View style={{ gap: spacing.md }}>
        <AppInput label={t('suppliers.name')} value={name} onChangeText={(value) => { setName(value); setError(''); }} required autoCapitalize="words" />
        <AppInput label={t('suppliers.contactPerson')} value={contactPerson} onChangeText={setContactPerson} autoCapitalize="words" />
        <AppInput label={t('suppliers.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        <AppInput label={t('suppliers.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <AppInput label={t('suppliers.address')} value={address} onChangeText={setAddress} multiline numberOfLines={3} />
        {error ? <AppText color={undefined} accessibilityRole="alert" style={{ color: colors.danger }}>{error}</AppText> : null}
        <AppButton
          title={supplier ? t('suppliers.saveChanges') : t('suppliers.create')}
          icon="save-outline"
          loading={submitting}
          disabled={submitting}
          onPress={() => {
            if (!name.trim()) {
              setError(t('suppliers.nameRequired'));
              return;
            }
            if (email.trim() && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email.trim())) {
              setError(t('suppliers.invalidEmail'));
              return;
            }
            onSubmit({
              name: name.trim(),
              contactPerson: contactPerson.trim() || null,
              email: email.trim() || null,
              phone: phone.trim() || null,
              address: address.trim() || null,
            });
          }}
        />
      </View>
    </Screen>
  );
}
