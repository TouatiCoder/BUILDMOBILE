import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { projectsApi } from '@/api/endpoints';
import { ErrorState, ListSkeleton } from '@/components/feedback';
import { Screen } from '@/components/layout';
import { ProjectForm } from '@/features/projects/ProjectForm';
import { useApiMutation } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';

export default function EditProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const project = useQuery({ queryKey: ['projects', 'detail', id], queryFn: () => projectsApi.get(id) });
  const update = useApiMutation({
    mutationFn: (input: Parameters<typeof projectsApi.update>[1]) => projectsApi.update(id, input),
    invalidate: [['projects']],
    successMessage: t('project.updatedSuccess'),
    onSuccess: () => router.back(),
  });

  return (
    <>
      <Stack.Screen options={{ title: t('project.editTitle') }} />
      {project.isLoading ? (
        <Screen>
          <ListSkeleton rows={4} />
        </Screen>
      ) : project.isError || !project.data ? (
        <Screen>
          <ErrorState error={project.error} onRetry={() => project.refetch()} />
        </Screen>
      ) : (
        <ProjectForm project={project.data} submitLabel={t('common.save')} submitting={update.isPending} onSubmit={(input) => update.mutate(input)} />
      )}
    </>
  );
}
