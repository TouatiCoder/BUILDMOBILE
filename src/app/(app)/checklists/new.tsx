import { useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { checklistsApi, toolsApi } from '@/api/endpoints';
import type { ChecklistType } from '@/api/types';
import { SelectField, AppInput } from '@/components/fields';
import { Screen } from '@/components/layout';
import { AppButton, AppCard, IconButton, SectionHeader } from '@/components/primitives';
import { useApiMutation } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';
import { CHECKLIST_TYPES } from '@/lib/labels';
import { colors, spacing } from '@/theme/tokens';

export default function NewChecklistScreen() {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ChecklistType>('general');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [items, setItems] = useState<string[]>(['']);
  const [titleError, setTitleError] = useState<string>();

  // Same company-scoped project list the website uses for its dropdown.
  const projects = useQuery({ queryKey: ['tools', 'projects'], queryFn: toolsApi.projects });
  const create = useApiMutation({
    mutationFn: checklistsApi.create,
    invalidate: [['checklists']],
    successMessage: t('common.success'),
    onSuccess: (res) => router.replace({ pathname: '/checklists/[id]', params: { id: res.item.id } }),
  });

  const submit = () => {
    if (!title.trim()) {
      setTitleError(t('common.required'));
      return;
    }
    setTitleError(undefined);
    create.mutate({ title: title.trim(), checklistType: type, projectId, items: items.map((i) => i.trim()).filter(Boolean) });
  };

  return (
    <Screen keyboard footer={<AppButton title={t('common.checklistsCreateButton')} onPress={submit} loading={create.isPending} />}>
      <Stack.Screen options={{ title: t('common.checklistsFormTitle') }} />
      <AppCard style={{ gap: spacing.lg }}>
        <AppInput label={t('common.checklistsTitlePlaceholder')} required value={title} onChangeText={setTitle} error={titleError} />
        <SelectField
          label={t('checklists.type')}
          value={type}
          options={CHECKLIST_TYPES.map((c) => ({ value: c, label: t(`common.checklistsType_${c}`) }))}
          onChange={(v) => v && setType(v)}
        />
        <SelectField
          label={t('common.checklistsProjectPlaceholder')}
          value={projectId}
          options={(projects.data?.items ?? []).map((p) => ({ value: p.id, label: p.name }))}
          onChange={setProjectId}
          allowClear
          placeholder={projects.data?.items.length ? t('common.checklistsNoProject') : t('common.checklistsNoProjectsAvailable')}
          searchable
        />
      </AppCard>
      <AppCard style={{ gap: spacing.md }}>
        <SectionHeader title={t('common.checklistsItemsLabel')} />
        {items.map((value, index) => (
          <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <View style={{ flex: 1 }}>
              <AppInput
                value={value}
                onChangeText={(v) => setItems((prev) => prev.map((x, i) => (i === index ? v : x)))}
                placeholder={`${index + 1}.`}
                returnKeyType="next"
                onSubmitEditing={() => setItems((prev) => [...prev, ''])}
              />
            </View>
            {items.length > 1 ? (
              <IconButton
                icon="remove-circle-outline"
                color={colors.danger}
                accessibilityLabel={t('common.checklistsRemoveItem')}
                onPress={() => setItems((prev) => prev.filter((_, i) => i !== index))}
              />
            ) : null}
          </View>
        ))}
        <AppButton title={t('common.checklistsAddItem')} variant="ghost" onPress={() => setItems((prev) => [...prev, ''])} />
      </AppCard>
    </Screen>
  );
}
