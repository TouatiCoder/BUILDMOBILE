import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';

import { inventoryApi } from '@/api/endpoints';
import type { MaterialDetail, MaterialInput } from '@/api/types';
import { SelectField, AppInput, type Option } from '@/components/fields';
import { Screen } from '@/components/layout';
import { AppButton, AppCard, SectionHeader } from '@/components/primitives';
import { useI18n } from '@/i18n/I18nProvider';
import { parseDecimalInput, toNumberOrNull } from '@/lib/format';
import { aggregateStock } from '@/lib/inventory';
import { spacing } from '@/theme/tokens';

/** Unit codes of the website's material form (app/inventory/materials/new/page.tsx). */
const UNITS: { value: string; labelKey: string }[] = [
  { value: 'kg', labelKey: 'inventory.unitKg' },
  { value: 'ton', labelKey: 'inventory.unitTonLabel' },
  { value: 'm3', labelKey: 'inventory.unitM3Label' },
  { value: 'm2', labelKey: 'inventory.unitM2Label' },
  { value: 'm', labelKey: 'inventory.unitMLabel' },
  { value: 'unit', labelKey: 'inventory.unitSingleLabel' },
  { value: 'bag', labelKey: 'inventory.unitBagLabel' },
  { value: 'pallet', labelKey: 'inventory.unitPalletLabel' },
];
const OTHER = 'other';
const NEW_CATEGORY = '__new__';

type Values = {
  name: string;
  category: string;
  newCategory: string;
  unit: string;
  customUnit: string;
  unitPrice: string;
  supplierId: string | null;
  minStockLevel: string;
  maxStockLevel: string;
  description: string;
};

function initial(material?: MaterialDetail): Values {
  const unitKnown = !material || UNITS.some((u) => u.value === material.unit);
  const stock = material ? aggregateStock(material.inventory) : null;
  return {
    name: material?.name ?? '',
    category: material?.category ?? '',
    newCategory: '',
    unit: material ? (unitKnown ? material.unit : OTHER) : 'unit',
    customUnit: material && !unitKnown ? material.unit : '',
    unitPrice: material ? String(toNumberOrNull(material.unitPrice) ?? '') : '',
    supplierId: material?.supplierId ?? null,
    minStockLevel: stock ? String(stock.minThreshold) : '',
    maxStockLevel: stock?.maxThreshold != null ? String(stock.maxThreshold) : '',
    description: material?.description ?? '',
  };
}

export function MaterialForm({
  material,
  submitLabel,
  submitting,
  onSubmit,
}: {
  material?: MaterialDetail;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (input: MaterialInput) => void;
}) {
  const { t } = useI18n();
  const filters = useQuery({ queryKey: ['inventory', 'filters'], queryFn: inventoryApi.filters });
  const [addingCategory, setAddingCategory] = useState(false);

  const nonNegative = (msg: string) =>
    z.string().refine((v) => {
      const n = parseDecimalInput(v);
      return n === null || (Number.isFinite(n) && n >= 0);
    }, msg);

  const schema = z
    .object({
      name: z.string().trim().min(1, t('inventory.materialNameRequired')),
      category: z.string(),
      newCategory: z.string(),
      unit: z.string().min(1, t('inventory.unitRequiredError')),
      customUnit: z.string(),
      unitPrice: nonNegative(t('inventory.unitPriceInvalid')),
      minStockLevel: nonNegative(t('inventory.minStockInvalid')),
      maxStockLevel: nonNegative(t('common.invalidNumber')),
    })
    .passthrough()
    .refine((v) => (v.category === NEW_CATEGORY ? v.newCategory.trim() !== '' : v.category.trim() !== ''), {
      path: ['category'],
      message: t('inventory.categoryRequiredError'),
    })
    .refine((v) => v.unit !== OTHER || v.customUnit.trim() !== '', { path: ['customUnit'], message: t('inventory.customUnitRequiredError') })
    .refine(
      (v) => {
        const min = parseDecimalInput(v.minStockLevel);
        const max = parseDecimalInput(v.maxStockLevel);
        return min === null || max === null || max >= min;
      },
      { path: ['maxStockLevel'], message: t('common.invalidNumber') },
    );

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) as never, defaultValues: initial(material) });

  const watchedCategory = useWatch({ control, name: 'category' });
  const watchedUnit = useWatch({ control, name: 'unit' });
  const categories = filters.data?.categories ?? [];
  const categoryOptions: Option[] = [
    ...categories.map((c) => ({ value: c, label: c })),
    ...(material?.category && !categories.includes(material.category) ? [{ value: material.category, label: material.category }] : []),
    { value: NEW_CATEGORY, label: `+ ${t('inventory.newCategoryTitle')}` },
  ];
  const unitOptions: Option[] = [...UNITS.map((u) => ({ value: u.value, label: t(u.labelKey) })), { value: OTHER, label: t('inventory.unitOtherLabel') }];
  const supplierOptions: Option[] = (filters.data?.suppliers ?? []).map((s) => ({ value: s.id, label: s.name }));

  const submit = handleSubmit((v) => {
    const category = v.category === NEW_CATEGORY ? v.newCategory.trim() : v.category.trim();
    onSubmit({
      name: v.name.trim(),
      description: v.description.trim() || null,
      unit: v.unit === OTHER ? v.customUnit.trim() : v.unit,
      unitPrice: parseDecimalInput(v.unitPrice),
      category,
      supplierId: v.supplierId,
      minStockLevel: parseDecimalInput(v.minStockLevel),
      maxStockLevel: parseDecimalInput(v.maxStockLevel),
    });
  });

  const text = (name: keyof Values, label: string, extra: Partial<React.ComponentProps<typeof AppInput>> = {}) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <AppInput label={label} value={(field.value as string) ?? ''} onChangeText={field.onChange} onBlur={field.onBlur} error={errors[name]?.message} {...extra} />
      )}
    />
  );

  return (
    <Screen keyboard footer={<AppButton title={submitLabel} onPress={submit} loading={submitting} />}>
      <AppCard style={{ gap: spacing.lg }}>
        <SectionHeader title={t('project.basicInfo')} />
        {text('name', t('inventory.materialNameLabel'), { required: true, placeholder: t('inventory.materialNamePlaceholder') })}
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <SelectField
              label={t('inventory.category')}
              required
              value={field.value || null}
              options={categoryOptions}
              onChange={(v) => {
                field.onChange(v ?? '');
                setAddingCategory(v === NEW_CATEGORY);
                if (v !== NEW_CATEGORY) setValue('newCategory', '');
              }}
              placeholder={t('inventory.selectCategory')}
              error={errors.category?.message}
              searchable
            />
          )}
        />
        {addingCategory || watchedCategory === NEW_CATEGORY
          ? text('newCategory', t('inventory.categoryNameLabel'), { placeholder: t('inventory.categoryNamePlaceholder') })
          : null}
        <Controller
          control={control}
          name="unit"
          render={({ field }) => (
            <SelectField label={t('inventory.unitMeasureLabel')} required value={field.value} options={unitOptions} onChange={(v) => field.onChange(v ?? 'unit')} error={errors.unit?.message} />
          )}
        />
        {watchedUnit === OTHER ? text('customUnit', t('inventory.customUnitLabel'), { placeholder: t('inventory.customUnitPlaceholder') }) : null}
        {text('unitPrice', t('inventory.unitPriceMadLabel'), { keyboardType: 'decimal-pad' })}
        <Controller
          control={control}
          name="supplierId"
          render={({ field }) => (
            <SelectField
              label={t('inventory.supplier')}
              value={field.value}
              options={supplierOptions}
              onChange={field.onChange}
              allowClear
              placeholder={t('inventory.noSupplier')}
              searchable
            />
          )}
        />
      </AppCard>
      <AppCard style={{ gap: spacing.lg }}>
        <SectionHeader title={t('inventory.criticalThresholds')} />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>{text('minStockLevel', t('inventory.minStockLabel'), { keyboardType: 'decimal-pad', hint: t('inventory.alertThresholdHint') })}</View>
          <View style={{ flex: 1 }}>{text('maxStockLevel', t('inventory.maxStockLabel'), { keyboardType: 'decimal-pad' })}</View>
        </View>
        {text('description', t('inventory.descriptionLabel'), { multiline: true })}
      </AppCard>
    </Screen>
  );
}
