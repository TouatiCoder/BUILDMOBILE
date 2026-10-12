import { router, Stack } from 'expo-router';

import { projectsApi } from '@/api/endpoints';
import { ProjectForm } from '@/features/projects/ProjectForm';
import { useApiMutation } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';

export default function NewProjectScreen() {
  const { t } = useI18n();
  const create = useApiMutation({
    mutationFn: projectsApi.create,
    invalidate: [['projects']],
    successMessage: t('project.newProject'),
    onSuccess: (project) => router.replace({ pathname: '/projects/[id]', params: { id: project.id } }),
  });
  return (
    <>
      <Stack.Screen options={{ title: t('project.newProject') }} />
      <ProjectForm submitLabel={t('common.create')} submitting={create.isPending} onSubmit={(input) => create.mutate(input)} />
    </>
  );
}
