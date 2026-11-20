import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { useDirectionStyle, useI18n } from '@/i18n/I18nProvider';
import { colors, radius, shadows, spacing } from '@/theme/tokens';

import { AppInput } from './fields';
import { AppButton, AppText } from './primitives';

/**
 * Modal asking for a free-text reason before a sensitive action (suspend a
 * company, reject a payment). With `required`, an empty reason is refused
 * client-side — the server validates again.
 */
export function ReasonDialog({
  visible,
  title,
  message,
  placeholder,
  confirmLabel,
  destructive = true,
  required = false,
  loading = false,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  confirmLabel: string;
  destructive?: boolean;
  required?: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const { t } = useI18n();
  const direction = useDirectionStyle();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();

  const close = () => {
    setReason('');
    setError(undefined);
    onCancel();
  };

  const submit = () => {
    const value = reason.trim();
    if (required && !value) {
      setError(t('platform.reasonRequired'));
      return;
    }
    setError(undefined);
    onConfirm(value);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={[styles.backdrop, direction]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel={t('common.cancel')} />
        <View style={styles.card}>
          <AppText variant="title" accessibilityRole="header">
            {title}
          </AppText>
          {message ? <AppText variant="small">{message}</AppText> : null}
          <AppInput
            value={reason}
            onChangeText={(v) => {
              setReason(v);
              if (error) setError(undefined);
            }}
            placeholder={placeholder}
            multiline
            error={error}
            autoFocus
            maxLength={255}
          />
          <View style={styles.actions}>
            <AppButton title={t('common.cancel')} variant="secondary" onPress={close} style={{ flex: 1 }} disabled={loading} />
            <AppButton
              title={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={submit}
              loading={loading}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Modal to enter a new quantity (zero or more). Mount it only while open
 * (with a `key`) so it starts from `initialValue` each time.
 */
export function QuantityDialog({
  title,
  message,
  label,
  initialValue,
  invalidMessage,
  confirmLabel,
  loading = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  message?: string;
  label: string;
  initialValue: string;
  invalidMessage: string;
  confirmLabel: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (quantity: number) => void;
}) {
  const { t } = useI18n();
  const direction = useDirectionStyle();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string>();

  const submit = () => {
    const quantity = Number(value.trim().replace(/\s/g, '').replace(',', '.'));
    if (value.trim() === '' || !Number.isFinite(quantity) || quantity < 0) {
      setError(invalidMessage);
      return;
    }
    onConfirm(quantity);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={[styles.backdrop, direction]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityRole="button" accessibilityLabel={t('common.cancel')} />
        <View style={styles.card}>
          <AppText variant="title" accessibilityRole="header">
            {title}
          </AppText>
          {message ? <AppText variant="small">{message}</AppText> : null}
          <AppInput
            label={label}
            value={value}
            onChangeText={(v) => {
              setValue(v.replace(/[^0-9.,]/g, ''));
              if (error) setError(undefined);
            }}
            keyboardType="decimal-pad"
            error={error}
            autoFocus
            selectTextOnFocus
          />
          <View style={styles.actions}>
            <AppButton title={t('common.cancel')} variant="secondary" onPress={onCancel} style={{ flex: 1 }} disabled={loading} />
            <AppButton title={confirmLabel} onPress={submit} loading={loading} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    ...shadows.lg,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
});
