import { useMemo, useState } from 'react';

import { SelectField, AppInput } from '@/components/fields';
import { AppCard, Divider } from '@/components/primitives';
import { CalculatorShell, ResultRow } from '@/features/tools/CalculatorShell';
import { useI18n } from '@/i18n/I18nProvider';
import { computeMeshPanels, getMeshType, MESH_TYPES, type MeshOverlap } from '@/lib/calculators/mesh';
import { parseNumberInput } from '@/lib/calculators/validation';
import { formatNumber } from '@/lib/format';
import { spacing } from '@/theme/tokens';

const OVERLAPS: MeshOverlap[] = ['none', '1', '2'];
const overlapKey: Record<MeshOverlap, string> = { none: 'common.meshOverlapNone', '1': 'common.meshOverlap1', '2': 'common.meshOverlap2' };

/** Mobile port of app/tools/mesh-calculator (welded mesh panels). */
export default function MeshCalculatorScreen() {
  const { t, locale } = useI18n();
  const [meshTypeId, setMeshTypeId] = useState(MESH_TYPES[2]?.id ?? MESH_TYPES[0].id);
  const [surface, setSurface] = useState('');
  const [overlap, setOverlap] = useState<MeshOverlap>('none');
  const [showErrors, setShowErrors] = useState(false);

  const calc = useMemo(() => {
    try {
      return { ok: true as const, value: computeMeshPanels({ meshTypeId, surfaceM2: parseNumberInput(surface), overlap }) };
    } catch {
      return { ok: false as const };
    }
  }, [meshTypeId, surface, overlap]);

  const groupLabel = (category: string) => (category === 'structural' ? t('common.meshGroupStructural') : t('common.meshGroupAntifissuration'));

  return (
    <CalculatorShell
      toolType="mesh"
      title={t('common.meshPageTitle')}
      savedTitle={t('common.meshSavedTitle')}
      savedMessage={t('common.meshSavedMessage')}
      emptySaved={t('common.concreteEmptySaved')}
      onInvalid={() => setShowErrors(true)}
      buildPayload={() =>
        calc.ok ? { input: { meshTypeId, surfaceM2: parseNumberInput(surface) || 0, overlap }, output: { ...calc.value } } : null
      }
      summarize={(c) => {
        const input = c.input as { meshTypeId?: string };
        const out = c.output as { panelCount?: number; totalWeightKg?: number };
        return t('common.meshSavedSummary', {
          meshType: input.meshTypeId ?? '',
          count: out.panelCount ?? 0,
          weight: formatNumber(out.totalWeightKg ?? 0, locale),
        });
      }}>
      <AppCard style={{ gap: spacing.lg }}>
        <SelectField
          label={t('common.meshTypeLabel')}
          value={meshTypeId}
          options={MESH_TYPES.map((m) => ({
            value: m.id,
            label: m.id,
            description: `${groupLabel(m.category)} · ${m.meshSpacingMm.join('×')} mm · ${m.panelLengthM}×${m.panelWidthM} m`,
          }))}
          onChange={(v) => v && setMeshTypeId(v)}
        />
        <AppInput
          label={t('common.meshSurfaceLabel')}
          value={surface}
          onChangeText={setSurface}
          keyboardType="decimal-pad"
          error={showErrors && !calc.ok ? t('common.calcErrorRequired') : undefined}
        />
        <SelectField
          label={t('common.meshOverlapLabel')}
          value={overlap}
          options={OVERLAPS.map((o) => ({ value: o, label: t(overlapKey[o]) }))}
          onChange={(v) => v && setOverlap(v)}
        />
        <Divider />
        <ResultRow label={t('common.meshPanelCountLabel')} value={calc.ok ? String(calc.value.panelCount) : '—'} strong />
        <ResultRow
          label={t('common.meshPanelDimensionLabel')}
          value={calc.ok ? `${calc.value.panelLengthM} × ${calc.value.panelWidthM} m` : `${getMeshType(meshTypeId)?.panelLengthM ?? '—'} m`}
        />
        <ResultRow label={t('common.meshSizeLabel')} value={calc.ok ? `${calc.value.meshSpacingMm.join(' × ')} mm` : '—'} />
        <ResultRow label={t('common.meshTotalWeightLabel')} value={calc.ok ? `${formatNumber(calc.value.totalWeightKg, locale)} kg` : '—'} />
      </AppCard>
    </CalculatorShell>
  );
}
