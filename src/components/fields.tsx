import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n/I18nProvider';
import { formatDate, parseIsoDate, toIsoDate } from '@/lib/format';
import { colors, controlHeight, font, radius, spacing, TOUCH_TARGET } from '@/theme/tokens';

import { useKeyboardAware } from './keyboard';
import { AppText, AppButton, IconButton } from './primitives';

type FieldChromeProps = { label?: string; error?: string; hint?: string; required?: boolean };

function FieldChrome({ label, error, hint, required, children }: FieldChromeProps & { children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      {label ? (
        <AppText variant="label">
          {label}
          {required ? <AppText variant="label" color={colors.danger}> *</AppText> : null}
        </AppText>
      ) : null}
      {children}
      {error ? (
        <AppText variant="caption" color={colors.danger} accessibilityRole="alert">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption">{hint}</AppText>
      ) : null}
    </View>
  );
}

type AppInputProps = TextInputProps &
  FieldChromeProps & {
    /** Leading icon inside the field. */
    icon?: React.ComponentProps<typeof Ionicons>['name'];
  };

/**
 * Text field of the design system. With `secureTextEntry` it renders the
 * show/hide eye required by the backlog for password fields.
 */
export const AppInput = forwardRef<TextInput, AppInputProps>(function AppInput(
  { label, error, hint, required, style, multiline, icon, secureTextEntry, ...rest },
  ref,
) {
  const { t, rtl } = useI18n();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  // Callers keep a ref to the TextInput (e.g. focus chain email → password).
  useImperativeHandle(ref, () => inputRef.current as TextInput);
  const keyboard = useKeyboardAware();
  const [revealed, setRevealed] = useState(false);
  const isPassword = !!secureTextEntry;
  const decorated = !!icon || isPassword;

  const input = (
    <TextInput
      ref={inputRef}
      placeholderTextColor={colors.textMuted}
      accessibilityLabel={label}
      {...rest}
      secureTextEntry={isPassword && !revealed}
      multiline={multiline}
      onFocus={(e) => {
        setFocused(true);
        keyboard?.onInputFocus(inputRef.current);
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        rest.onBlur?.(e);
      }}
      style={[
        decorated ? styles.inputBare : styles.input,
        multiline && styles.multiline,
        // TextInput does not follow the layout direction for alignment.
        { textAlign: rtl ? 'right' : 'left' },
        !decorated && focused && styles.inputFocused,
        !decorated && error ? styles.inputError : null,
        style,
      ]}
    />
  );

  return (
    <FieldChrome label={label} error={error} hint={hint} required={required}>
      {decorated ? (
        <View style={[styles.input, styles.inputRow, focused && styles.inputFocused, error ? styles.inputError : null]}>
          {icon ? <Ionicons name={icon} size={20} color={focused ? colors.brand : colors.textMuted} /> : null}
          {input}
          {isPassword ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={revealed ? t('auth.hidePassword') : t('auth.showPassword')}
              onPress={() => setRevealed((v) => !v)}
              hitSlop={10}
              style={styles.eye}>
              <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      ) : (
        input
      )}
    </FieldChrome>
  );
});

export type Option<V extends string = string> = { value: V; label: string; description?: string };

export function SelectField<V extends string>({
  label,
  value,
  options,
  onChange,
  placeholder,
  error,
  hint,
  required,
  searchable,
  allowClear,
  disabled,
}: FieldChromeProps & {
  value: V | null | undefined;
  options: Option<V>[];
  onChange: (value: V | null) => void;
  placeholder?: string;
  searchable?: boolean;
  allowClear?: boolean;
  disabled?: boolean;
}) {
  const { t, rtl } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  return (
    <FieldChrome label={label} error={error} hint={hint} required={required}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={selected?.label ?? placeholder}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.input, styles.select, error ? styles.inputError : null, disabled && { opacity: 0.5 }]}>
        <AppText style={{ flex: 1 }} color={selected ? colors.text : colors.textMuted} numberOfLines={1}>
          {selected?.label ?? placeholder ?? t('common.select')}
        </AppText>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={[styles.sheet, { direction: rtl ? 'rtl' : 'ltr' }]} edges={['top', 'bottom']}>
          <View style={styles.sheetHeader}>
            <AppText variant="title" style={{ flex: 1 }}>
              {label ?? t('common.select')}
            </AppText>
            <IconButton icon="close" accessibilityLabel={t('common.close')} onPress={() => setOpen(false)} />
          </View>
          {searchable ? (
            <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
              <SearchInput value={query} onChangeText={setQuery} />
            </View>
          ) : null}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              allowClear ? (
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    onChange(null);
                    setOpen(false);
                  }}>
                  <AppText color={colors.textMuted}>{placeholder ?? t('common.none')}</AppText>
                </Pressable>
              ) : null
            }
            renderItem={({ item }) => {
              const active = item.value === value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.surfaceMuted }]}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                    setQuery('');
                  }}>
                  <View style={{ flex: 1 }}>
                    <AppText variant={active ? 'bodyStrong' : 'body'} color={active ? colors.brand : colors.text}>
                      {item.label}
                    </AppText>
                    {item.description ? <AppText variant="caption">{item.description}</AppText> : null}
                  </View>
                  {active ? <Ionicons name="checkmark" size={20} color={colors.brand} /> : null}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <AppText variant="small" style={{ padding: spacing.lg, textAlign: 'center' }}>
                {t('common.noResults')}
              </AppText>
            }
          />
        </SafeAreaView>
      </Modal>
    </FieldChrome>
  );
}

export function DateField({
  label,
  value,
  onChange,
  error,
  hint,
  required,
}: FieldChromeProps & { value: string | null; onChange: (value: string | null) => void }) {
  const { t, locale } = useI18n();
  const [iosOpen, setIosOpen] = useState(false);
  const date = parseIsoDate(value);

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date ?? new Date(),
        mode: 'date',
        onChange: (event: DateTimePickerEvent, selected?: Date) => {
          if (event.type === 'set' && selected) onChange(toIsoDate(selected));
        },
      });
    } else {
      setIosOpen(true);
    }
  };

  return (
    <FieldChrome label={label} error={error} hint={hint} required={required}>
      <View style={styles.dateRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={date ? formatDate(date, locale) : t('common.select')}
          onPress={open}
          style={[styles.input, styles.select, { flex: 1 }, error ? styles.inputError : null]}>
          <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
          <AppText style={{ flex: 1 }} color={date ? colors.text : colors.textMuted}>
            {date ? formatDate(date, locale) : t('common.select')}
          </AppText>
        </Pressable>
        {date ? <IconButton icon="close-circle" color={colors.textMuted} accessibilityLabel={t('common.close')} onPress={() => onChange(null)} /> : null}
      </View>
      {Platform.OS === 'ios' ? (
        <Modal visible={iosOpen} transparent animationType="fade" onRequestClose={() => setIosOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setIosOpen(false)}>
            <Pressable style={styles.iosPicker}>
              <DateTimePicker
                value={date ?? new Date()}
                mode="date"
                display="inline"
                onChange={(_e, selected) => {
                  if (selected) onChange(toIsoDate(selected));
                }}
              />
              <AppButton title={t('common.confirm')} onPress={() => setIosOpen(false)} />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </FieldChrome>
  );
}

export function SearchInput({ value, onChangeText, placeholder }: { value: string; onChangeText: (v: string) => void; placeholder?: string }) {
  const { t, rtl } = useI18n();
  return (
    <View style={[styles.input, styles.search]}>
      <Ionicons name="search" size={18} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? t('common.search')}
        placeholderTextColor={colors.textMuted}
        style={[styles.searchText, { textAlign: rtl ? 'right' : 'left' }]}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel={placeholder ?? t('common.search')}
        clearButtonMode="while-editing"
      />
    </View>
  );
}

export function ChipGroup<V extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<V>[];
  value: V;
  onChange: (value: V) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.chip, active && styles.chipActive]}>
            <AppText variant="small" color={active ? colors.textOnBrand : colors.textSecondary} style={{ fontWeight: '600' }}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function SwitchRow({
  label,
  description,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong">{label}</AppText>
        {description ? <AppText variant="small">{description}</AppText> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: colors.brand, false: colors.borderStrong }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  input: {
    minHeight: controlHeight.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: font.bodyLarge,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputFocused: { borderColor: colors.brand, borderWidth: 1.5 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 0 },
  inputBare: { flex: 1, fontSize: font.bodyLarge, color: colors.text, minHeight: controlHeight.md - 2, paddingVertical: 0 },
  eye: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  inputError: { borderColor: colors.danger },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  select: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sheet: { flex: 1, backgroundColor: colors.surface },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  option: {
    minHeight: TOUCH_TARGET + 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'center', padding: spacing.lg },
  iosPicker: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 0 },
  searchText: { flex: 1, fontSize: font.bodyLarge, color: colors.text, minHeight: TOUCH_TARGET },
  chips: { gap: spacing.sm, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
});
