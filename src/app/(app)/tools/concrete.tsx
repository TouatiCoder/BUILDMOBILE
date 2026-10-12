import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Banner } from '@/components/feedback';
import { ChipGroup, SelectField, AppInput } from '@/components/fields';
import { AppCard, Divider } from '@/components/primitives';
import { CalculatorShell, ResultRow, useCalcErrorText } from '@/features/tools/CalculatorShell';
import { useI18n } from '@/i18n/I18nProvider';
import {
  CEMENT_DOSAGES,
  collectConcreteVolumeFieldErrors,
  computeConcreteDosage,
  computeConcreteVolume,
  CONCRETE_ELEMENT_FIELDS,
  CONCRETE_ELEMENT_TYPES,
  type CementDosage,
  type ConcreteDimensionField,
  type ConcreteElementType,
} from '@/lib/calculators/concrete';
import { parseNumberInput } from '@/lib/calculators/validation';
import { formatNumber } from '@/lib/format';
import { spacing } from '@/theme/tokens';

const elementKey: Record<ConcreteElementType, string> = {
  dalle: 'common.concreteElementDalle',
  voile: 'common.concreteElementVoile',
  poteau_rectangulaire: 'common.concreteElementPoteauRectangulaire',
  poteau_rond: 'common.concreteElementPoteauRond',
};

/** Mobile port of app/tools/concrete-calculator — same formulas (lib/calculators/concrete.ts) and save payload. */
export default function ConcreteCalculatorScreen() {
  const { t, locale } = useI18n();
  const errorText = useCalcErrorText();
  const [tab, setTab] = useState<'volume' | 'dosage'>('volume');
  const [elementType, setElementType] = useState<ConcreteElementType>('dalle');
  const [values, setValues] = useState<Record<ConcreteDimensionField, string>>({ length: '', width: '', thicknessCm: '', diameterCm: '', heightM: '' });
  const [dosage, setDosage] = useState<CementDosage>(350);
  const [dosageVolume, setDosageVolume] = useState('');
  const [showErrors, setShowErrors] = useState(false);

  const parsed = useMemo(
    () => ({
      length: parseNumberInput(values.length),
      width: parseNumberInput(values.width),
      thicknessCm: parseNumberInput(values.thicknessCm),
      diameterCm: parseNumberInput(values.diameterCm),
      heightM: parseNumberInput(values.heightM),
    }),
    [values],
  );

  const volume = useMemo(() => {
    try {
      return { ok: true as const, value: computeConcreteVolume({ elementType, ...parsed }) };
    } catch {
      return { ok: false as const };
    }
  }, [elementType, parsed]);
  const volumeErrors = useMemo(() => collectConcreteVolumeFieldErrors(elementType, parsed), [elementType, parsed]);

  const dosageResult = useMemo(() => {
    try {
      return { ok: true as const, value: computeConcreteDosage({ dosageKgM3: dosage, volumeM3: parseNumberInput(dosageVolume) }) };
    } catch {
      return { ok: false as const };
    }
  }, [dosage, dosageVolume]);

  const fmt = (n: number) => formatNumber(n, locale, 3);

  return (
    <CalculatorShell
      toolType="concrete"
      title={t('common.concretePageTitle')}
      savedTitle={t('common.concreteSavedTitle')}
      savedMessage={t('common.concreteSavedMessage')}
      emptySaved={t('common.concreteEmptySaved')}
      onInvalid={() => setShowErrors(true)}
      buildPayload={() => {
        if (tab === 'volume') {
          if (!volume.ok) return null;
          return { input: { calcKind: 'volume', elementType, ...parsed }, output: { ...volume.value } };
        }
        if (!dosageResult.ok) return null;
        return { input: { calcKind: 'dosage', dosageKgM3: dosage, volumeM3: parseNumberInput(dosageVolume) }, output: { ...dosageResult.value } };
      }}
      summarize={(c) => {
        const input = c.input as Record<string, unknown>;
        const output = c.output as Record<string, number>;
        if (input.calcKind === 'dosage') {
          return t('common.concreteSavedSummaryDosage', { dosage: String(input.dosageKgM3 ?? ''), cement: fmt(output.cementKg ?? 0) });
        }
        const type = input.elementType as ConcreteElementType | undefined;
        return t('common.concreteSavedSummaryVolume', {
          elementType: type ? t(elementKey[type]) : '',
          surface: fmt(output.surfaceM2 ?? 0),
          volume: fmt(output.volumeM3 ?? 0),
        });
      }}>
      <ChipGroup
        value={tab}
        onChange={(v) => {
          setTab(v);
          setShowErrors(false);
        }}
        options={[
          { value: 'volume', label: t('common.concreteTabVolume') },
          { value: 'dosage', label: t('common.concreteTabDosage') },
        ]}
      />
      {tab === 'volume' ? (
        <AppCard style={{ gap: spacing.lg }}>
          <SelectField
            label={t('common.concreteElementTypeLabel')}
            value={elementType}
            options={CONCRETE_ELEMENT_TYPES.map((e) => ({ value: e, label: t(elementKey[e]) }))}
            onChange={(v) => v && setElementType(v)}
          />
          {CONCRETE_ELEMENT_FIELDS[elementType].map((d) => (
            <AppInput
              key={d.field}
              label={t(`common.${d.labelKey}`)}
              value={values[d.field]}
              onChangeText={(v) => setValues((prev) => ({ ...prev, [d.field]: v }))}
              keyboardType="decimal-pad"
              error={showErrors ? errorText(volumeErrors[d.field]) : undefined}
            />
          ))}
          <Divider />
          <ResultRow label={t('common.concreteSurfaceResultLabel')} value={volume.ok ? `${fmt(volume.value.surfaceM2)} m²` : '—'} />
          <ResultRow label={t('common.concreteVolumeResultLabel')} value={volume.ok ? `${fmt(volume.value.volumeM3)} m³` : '—'} strong />
        </AppCard>
      ) : (
        <AppCard style={{ gap: spacing.lg }}>
          <SelectField
            label={t('common.concreteDosageLabel')}
            value={String(dosage)}
            options={CEMENT_DOSAGES.map((d) => ({ value: String(d), label: t(`common.concreteDosage${d}`) }))}
            onChange={(v) => v && setDosage(Number(v) as CementDosage)}
          />
          <AppInput
            label={t('common.concreteDosageVolumeLabel')}
            value={dosageVolume}
            onChangeText={setDosageVolume}
            keyboardType="decimal-pad"
            error={showErrors && !dosageResult.ok ? t('common.calcErrorRequired') : undefined}
          />
          <Divider />
          {dosageResult.ok ? (
            <View>
              <ResultRow label={t('common.concreteCementResultLabel')} value={`${fmt(dosageResult.value.cementKg)} kg`} strong />
              <ResultRow label="" value={t('common.concreteCementBagsResult', { bags: dosageResult.value.cementBags25kg })} />
              <ResultRow label={t('common.concreteSandResultLabel')} value={`${fmt(dosageResult.value.sandKg)} kg`} />
              <ResultRow label={t('common.concreteGravelResultLabel')} value={`${fmt(dosageResult.value.gravelKg)} kg`} />
              <ResultRow label={t('common.concreteWaterResultLabel')} value={`${fmt(dosageResult.value.waterL)} L`} />
            </View>
          ) : (
            <ResultRow label={t('common.concreteCementResultLabel')} value="—" />
          )}
          <Banner tone="info" message={t('common.concreteDosageDisclaimer')} />
        </AppCard>
      )}
    </CalculatorShell>
  );
}
