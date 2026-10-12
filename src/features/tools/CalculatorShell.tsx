import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { toolsApi } from '@/api/endpoints';
import type { ToolCalculation, ToolType } from '@/api/types';
import { Banner, ErrorState, ListSkeleton } from '@/components/feedback';
import { SelectField, AppInput } from '@/components/fields';
import { ListGroup, ListRow, Screen } from '@/components/layout';
import { AppText, AppButton, AppCard, SectionHeader } from '@/components/primitives';
import { useApiMutation, usePermissions } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';
import type { CalculationErrorCode } from '@/lib/calculators/validation';
import { formatDateTime } from '@/lib/format';
import { spacing } from '@/theme/tokens';

/** Error code → message key, same mapping as the website calculators. */
export function useCalcErrorText() {
  const { t } = useI18n();
  return (code: CalculationErrorCode | undefined): string | undefined => {
    if (!code) return undefined;
    const keys: Record<CalculationErrorCode, string> = {
      required: 'common.calcErrorRequired',
      invalid: 'common.calcErrorInvalid',
      negative: 'common.calcErrorNegative',
      'not-integer': 'common.calcErrorNotInteger',
      range: 'common.calcErrorGeneric',
    };
    return t(keys[code]);
  };
}

export type SavePayload = { input: Record<string, unknown>; output: Record<string, unknown> };

/**
 * Shared frame of the four calculators: optional project link ("company"
 * scope, as the website), notes, save through POST /api/tools/calculations, and
 * the user's saved calculations for this tool.
 */
export function CalculatorShell({
  toolType,
  title,
  children,
  buildPayload,
  onInvalid,
  summarize,
  savedTitle,
  savedMessage,
  emptySaved,
}: {
  toolType: ToolType;
  title: string;
  children: ReactNode;
  /** Returns the payload when inputs are valid, or null. */
  buildPayload: () => SavePayload | null;
  onInvalid: () => void;
  summarize: (calc: ToolCalculation) => string;
  savedTitle: string;
  savedMessage: string;
  emptySaved: string;
}) {
  const { t, locale } = useI18n();
  const { allows } = usePermissions();
  // Website: steel calculator is structural-engineer only; the others are for site managers and engineers.
  const allowed = allows(toolType === 'steel' ? 'tools.steel' : 'tools');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const projects = useQuery({ queryKey: ['tools', 'projects'], queryFn: toolsApi.projects, enabled: allowed });
  const saved = useQuery({ queryKey: ['tools', 'calculations', toolType], queryFn: () => toolsApi.calculations(toolType), enabled: allowed });
  const save = useApiMutation({
    mutationFn: toolsApi.save,
    invalidate: [['tools', 'calculations']],
    successMessage: savedMessage,
    onSuccess: () => setNotes(''),
  });

  if (!allowed) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <Banner tone="warning" message={t('tools.roleRestricted')} />
      </Screen>
    );
  }

  const onSave = () => {
    const payload = buildPayload();
    if (!payload) {
      onInvalid();
      return;
    }
    save.mutate({ toolType, projectId, notes: notes.trim() || null, ...payload });
  };

  return (
    <Screen keyboard>
      <Stack.Screen options={{ title }} />
      {children}
      <AppCard style={{ gap: spacing.lg }}>
        <SelectField
          label={t('common.concreteProjectPlaceholder')}
          value={projectId}
          options={(projects.data?.items ?? []).map((p) => ({ value: p.id, label: p.status ? `${p.name} (${p.status})` : p.name }))}
          onChange={setProjectId}
          allowClear
          placeholder={projects.data?.items.length ? t('common.concreteNoProject') : t('common.toolsNoProjectsAvailable')}
          searchable
        />
        <AppInput label={t('common.concreteNotesPlaceholder')} value={notes} onChangeText={setNotes} multiline />
        <AppButton title={t('common.steelSaveButton')} icon="save-outline" onPress={onSave} loading={save.isPending} />
      </AppCard>
      <View>
        <SectionHeader title={savedTitle} />
        {saved.isLoading ? (
          <ListSkeleton rows={2} />
        ) : saved.isError ? (
          <ErrorState error={saved.error} onRetry={() => saved.refetch()} />
        ) : (saved.data?.items ?? []).length === 0 ? (
          <AppText variant="small">{emptySaved}</AppText>
        ) : (
          <ListGroup>
            {(saved.data?.items ?? []).map((c) => (
              <ListRow
                key={c.id}
                icon="document-text-outline"
                title={summarize(c)}
                subtitle={[c.project?.name, c.notes, formatDateTime(c.createdAt, locale)].filter(Boolean).join(' · ')}
              />
            ))}
          </ListGroup>
        )}
      </View>
    </Screen>
  );
}

export function ResultRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 6 }}>
      <AppText variant="small" style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText variant={strong ? 'title' : 'bodyStrong'}>{value}</AppText>
    </View>
  );
}
