import { useMemo, useState } from 'react';

import { ChipGroup, SelectField, AppInput } from '@/components/fields';
import { AppText, AppCard, Divider } from '@/components/primitives';
import { CalculatorShell, ResultRow, useCalcErrorText } from '@/features/tools/CalculatorShell';
import { useI18n } from '@/i18n/I18nProvider';
import {
  areaFromSquareMeters,
  collectFormworkFieldErrors,
  computeFormwork,
  DEFAULT_FORMWORK_PANEL_ID,
  FORMWORK_FOUNDATION_TYPES,
  FORMWORK_PANEL_SIZES,
  FORMWORK_TYPE_FIELDS,
  FORMWORK_TYPE_FORMULA,
  FORMWORK_UNIT_SYMBOLS,
  lengthFromMeters,
  lengthToMeters,
  usesNetLength,
  type FormworkDimensionField,
  type FormworkFoundationType,
  type FormworkUnitSystem,
} from '@/lib/calculators/formwork';
import { parseNumberInput } from '@/lib/calculators/validation';
import { formatNumber } from '@/lib/format';
import { spacing } from '@/theme/tokens';

const typeKey: Record<FormworkFoundationType, string> = {
  slab: 'common.formworkTypeSlab',
  strip: 'common.formworkTypeStrip',
  column: 'common.formworkTypePad',
  pile: 'common.formworkTypePile',
};

type LengthField = Exclude<FormworkDimensionField, 'plotCount'> | 'joistSpacingM';
const LENGTH_FIELDS: LengthField[] = ['lengthM', 'widthM', 'heightM', 'thicknessM', 'joistSpacingM'];

/** Mobile port of app/tools/formwork-calculator — same defaults, conversions and save payload. */
export default function FormworkCalculatorScreen() {
  const { t, locale } = useI18n();
  const errorText = useCalcErrorText();
  const [unit, setUnit] = useState<FormworkUnitSystem>('metric');
  const [type, setType] = useState<FormworkFoundationType>('pile');
  const [panelId, setPanelId] = useState(DEFAULT_FORMWORK_PANEL_ID);
  const [values, setValues] = useState<Record<string, string>>({
    lengthM: '6',
    widthM: '4',
    heightM: '0.5',
    thicknessM: '0.4',
    plotCount: '4',
    wastePercent: '10',
    joistSpacingM: '0.5',
  });
  const [showErrors, setShowErrors] = useState(false);
  const symbols = FORMWORK_UNIT_SYMBOLS[unit];

  const parsedInput = useMemo(() => {
    const toMeters = (raw: string) => {
      const v = parseNumberInput(raw);
      return v === null ? null : lengthToMeters(v, unit);
    };
    return {
      type,
      panelId,
      lengthM: toMeters(values.lengthM),
      widthM: toMeters(values.widthM),
      heightM: toMeters(values.heightM),
      thicknessM: toMeters(values.thicknessM),
      plotCount: parseNumberInput(values.plotCount),
      wastePercent: parseNumberInput(values.wastePercent),
      joistSpacingM: toMeters(values.joistSpacingM),
    };
  }, [unit, type, panelId, values]);

  const calc = useMemo(() => {
    try {
      return { ok: true as const, value: computeFormwork(parsedInput) };
    } catch {
      return { ok: false as const };
    }
  }, [parsedInput]);
  const errors = collectFormworkFieldErrors(parsedInput);

  // Switching units converts what the user typed, like the website does.
  const switchUnit = (next: FormworkUnitSystem) => {
    if (next === unit) return;
    setValues((prev) => {
      const out = { ...prev };
      for (const field of LENGTH_FIELDS) {
        const v = parseNumberInput(prev[field]);
        if (v !== null) out[field] = String(Number(lengthFromMeters(lengthToMeters(v, unit), next).toFixed(4)));
      }
      return out;
    });
    setUnit(next);
  };

  const field = (name: string, label: string, kind: 'length' | 'count' | 'percent') => (
    <AppInput
      key={name}
      label={kind === 'length' ? `${label} (${symbols.length})` : label}
      value={values[name] ?? ''}
      onChangeText={(v) => setValues((prev) => ({ ...prev, [name]: v }))}
      keyboardType={kind === 'count' ? 'number-pad' : 'decimal-pad'}
      error={showErrors ? errorText(errors[name as keyof typeof errors]) : undefined}
    />
  );

  return (
    <CalculatorShell
      toolType="formwork"
      title={t('common.formworkPageTitle')}
      savedTitle={t('common.formworkSavedTitle')}
      savedMessage={t('common.formworkSavedMessage')}
      emptySaved={t('common.formworkEmptySaved')}
      onInvalid={() => setShowErrors(true)}
      buildPayload={() =>
        calc.ok
          ? {
              input: {
                foundationType: type,
                panelId,
                unitSystem: unit,
                lengthM: parsedInput.lengthM,
                widthM: parsedInput.widthM,
                heightM: parsedInput.heightM,
                thicknessM: usesNetLength(type) ? parsedInput.thicknessM : null,
                plotCount: type === 'column' ? parsedInput.plotCount : null,
                wastePercent: parsedInput.wastePercent,
                joistSpacingM: parsedInput.joistSpacingM,
              },
              output: {
                surfaceAreaM2: calc.value.contactAreaM2,
                plywoodSheets: calc.value.panelCount,
                timberLengthM: calc.value.timberLengthM,
                netLengthM: calc.value.netLengthM,
              },
            }
          : null
      }
      summarize={(c) => {
        const out = c.output as { surfaceAreaM2?: number; plywoodSheets?: number };
        return t('common.formworkSavedSummary', { area: formatNumber(out.surfaceAreaM2 ?? 0, locale), sheets: out.plywoodSheets ?? 0 });
      }}>
      <ChipGroup<FormworkUnitSystem>
        value={unit}
        onChange={switchUnit}
        options={[
          { value: 'metric', label: t('common.formworkUnitMetric') },
          { value: 'imperial', label: t('common.formworkUnitImperial') },
        ]}
      />
      <AppCard style={{ gap: spacing.lg }}>
        <SelectField
          label={t('common.formworkTypeLabel')}
          value={type}
          options={FORMWORK_FOUNDATION_TYPES.map((f) => ({ value: f, label: t(typeKey[f]) }))}
          onChange={(v) => v && setType(v)}
        />
        <SelectField
          label={t('common.formworkPanelSizeLabel')}
          value={panelId}
          options={FORMWORK_PANEL_SIZES.map((p) => ({ value: p.id, label: `${p.widthMm} × ${p.lengthMm} mm` }))}
          onChange={(v) => v && setPanelId(v)}
        />
        {FORMWORK_TYPE_FIELDS[type].map((d) => field(d.field, t(`common.${d.labelKey}`), d.kind))}
        {field('wastePercent', t('common.formworkWasteLabel'), 'percent')}
        {field('joistSpacingM', t('common.formworkSpacingLabel'), 'length')}
        <Divider />
        <ResultRow
          label={t('common.formworkContactAreaLabel')}
          value={calc.ok ? `${formatNumber(areaFromSquareMeters(calc.value.contactAreaM2, unit), locale)} ${symbols.area}` : '—'}
          strong
        />
        <ResultRow label={t('common.formworkPlywoodSheets')} value={calc.ok ? String(calc.value.panelCount) : '—'} />
        <ResultRow
          label={t('common.formworkTimberLabel')}
          value={calc.ok ? `${formatNumber(lengthFromMeters(calc.value.timberLengthM, unit), locale)} ${symbols.length}` : '—'}
        />
        <AppText variant="caption">
          {t('common.formworkFormulaLabel')}: {FORMWORK_TYPE_FORMULA[type]}
        </AppText>
      </AppCard>
    </CalculatorShell>
  );
}
