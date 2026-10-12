import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { materialsApi } from '@/api/endpoints';
import { SelectField, AppInput } from '@/components/fields';
import { AppCard, Divider } from '@/components/primitives';
import { CalculatorShell, ResultRow, useCalcErrorText } from '@/features/tools/CalculatorShell';
import { usePermissions } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';
import { collectHaWeightFieldErrors, computeHaWeight, HA_DIAMETERS_MM } from '@/lib/calculators/steel';
import { parseNumberInput } from '@/lib/calculators/validation';
import { formatCurrency, formatNumber } from '@/lib/format';
import { spacing } from '@/theme/tokens';

/** Mobile port of app/tools/steel-calculator (HA rebar weight, optional price from the material library). */
export default function SteelCalculatorScreen() {
  const { t, locale } = useI18n();
  const errorText = useCalcErrorText();
  const { allows } = usePermissions();
  const [diameter, setDiameter] = useState('12');
  const [length, setLength] = useState('');
  const [quantity, setQuantity] = useState('');
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const library = useQuery({ queryKey: ['materials', 'library'], queryFn: materialsApi.library, enabled: allows('tools.steel') });
  const selected = library.data?.items.find((m) => m.id === materialId);

  const inputs = { diameterMm: parseNumberInput(diameter), lengthM: parseNumberInput(length), quantity: parseNumberInput(quantity) };
  const calc = useMemo(() => {
    try {
      const result = computeHaWeight(inputs);
      const estimatedCost = selected?.unitPrice != null ? result.totalWeightKg * selected.unitPrice : null;
      return { ok: true as const, value: { ...result, estimatedCost } };
    } catch {
      return { ok: false as const };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diameter, length, quantity, selected?.unitPrice]);
  const errors = collectHaWeightFieldErrors(inputs);

  return (
    <CalculatorShell
      toolType="steel"
      title={t('common.steelPageTitle')}
      savedTitle={t('common.steelSavedTitle')}
      savedMessage={t('common.steelSavedMessage')}
      emptySaved={t('common.steelEmptySaved')}
      onInvalid={() => setShowErrors(true)}
      buildPayload={() =>
        calc.ok
          ? {
              input: { barDiameterMm: inputs.diameterMm || 0, barLengthM: inputs.lengthM || 0, quantity: inputs.quantity || 0, materialId },
              output: { totalWeightKg: calc.value.totalWeightKg, estimatedCost: calc.value.estimatedCost },
            }
          : null
      }
      summarize={(c) => {
        const out = c.output as { totalWeightKg?: number; estimatedCost?: number | null };
        const weight = formatNumber(out.totalWeightKg ?? 0, locale);
        return out.estimatedCost != null
          ? t('common.steelSavedSummaryWithCost', { weight, cost: formatCurrency(out.estimatedCost, locale) })
          : t('common.steelSavedSummary', { weight });
      }}>
      <AppCard style={{ gap: spacing.lg }}>
        <SelectField
          label={t('common.steelDiameterPlaceholder')}
          value={diameter}
          options={HA_DIAMETERS_MM.map((d) => ({ value: String(d), label: `HA ${d}` }))}
          onChange={(v) => setDiameter(v ?? '')}
          error={showErrors ? errorText(errors.diameterMm) : undefined}
        />
        <AppInput
          label={t('common.steelLengthPlaceholder')}
          value={length}
          onChangeText={setLength}
          keyboardType="decimal-pad"
          error={showErrors ? errorText(errors.lengthM) : undefined}
        />
        <AppInput
          label={t('common.steelQuantityPlaceholder')}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="number-pad"
          error={showErrors ? errorText(errors.quantity) : undefined}
        />
        <SelectField
          label={t('common.steelMaterialPlaceholder')}
          value={materialId}
          options={(library.data?.items ?? []).map((m) => ({
            value: m.id,
            label:
              m.unitPrice != null
                ? t('common.steelMaterialOptionWithPrice', { name: m.name, price: formatCurrency(m.unitPrice, locale), unit: m.unit })
                : t('common.steelMaterialOptionWithoutPrice', { name: m.name, noPrice: t('common.steelNoPrice') }),
          }))}
          onChange={setMaterialId}
          allowClear
          searchable
        />
        <Divider />
        <ResultRow label={t('common.steelUnitWeight')} value={calc.ok ? `${formatNumber(calc.value.unitWeightKgPerM, locale, 3)} kg/m` : '—'} />
        <ResultRow label={t('common.steelTotalWeight')} value={calc.ok ? `${formatNumber(calc.value.totalWeightKg, locale)} kg` : '—'} strong />
        <ResultRow
          label={t('common.steelEstimatedCost')}
          value={calc.ok && calc.value.estimatedCost != null ? formatCurrency(calc.value.estimatedCost, locale) : '—'}
        />
      </AppCard>
    </CalculatorShell>
  );
}
