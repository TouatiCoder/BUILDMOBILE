import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';

import { usersApi } from '@/api/endpoints';
import type { Project, ProjectInput } from '@/api/types';
import { DateField, SelectField, AppInput, type Option } from '@/components/fields';
import { Screen } from '@/components/layout';
import { AppButton, AppCard, SectionHeader } from '@/components/primitives';
import { useI18n } from '@/i18n/I18nProvider';
import { parseDecimalInput, toNumberOrNull } from '@/lib/format';
import { PROJECT_STATUSES, PROJECT_TYPES, projectStatusLabel } from '@/lib/labels';
import { spacing } from '@/theme/tokens';

const OTHER = '__other__';

type Values = {
  name: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  projectType: string;
  projectTypeOther: string;
  status: string;
  address: string;
  city: string;
  postalCode: string;
  totalBudget: string;
  startDate: string | null;
  endDate: string | null;
  description: string;
  siteManagerId: string;
  structuralEngineerId: string;
};

function initialValues(project?: Project): Values {
  const type = project?.projectType ?? '';
  const known = PROJECT_TYPES.some((p) => p.value === type);
  return {
    name: project?.name ?? '',
    clientName: project?.clientName ?? '',
    clientEmail: project?.clientEmail ?? '',
    clientPhone: project?.clientPhone ?? '',
    projectType: !type ? '' : known ? type : OTHER,
    projectTypeOther: !type || known ? '' : type,
    status: project?.status === 'in_progress' ? 'active' : (project?.status ?? 'planning'),
    address: project?.address ?? '',
    city: project?.city ?? '',
    postalCode: project?.postalCode ?? '',
    totalBudget: project ? String(toNumberOrNull(project.totalBudget) ?? '') : '',
    startDate: project?.startDate ? project.startDate.slice(0, 10) : null,
    endDate: project?.endDate ? project.endDate.slice(0, 10) : null,
    description: project?.description ?? '',
    siteManagerId: project?.siteManagerId ?? '',
    structuralEngineerId: project?.structuralEngineerId ?? '',
  };
}

/**
 * Same fields and payload as the website's new/edit project pages. Business
 * rules (budget >= 0, end >= start, plan limits) are enforced by the server;
 * the checks here only give earlier feedback.
 */
export function ProjectForm({
  project,
  submitLabel,
  submitting,
  onSubmit,
}: {
  project?: Project;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (input: ProjectInput) => void;
}) {
  const { t } = useI18n();
  const users = useQuery({ queryKey: ['users', 'project-team-options'], queryFn: () => usersApi.list({ limit: 100 }) });
  const teamOptions: Option[] = (users.data?.users ?? [])
    .filter((user) => user.active)
    .map((user) => ({ value: user.id, label: user.fullName?.trim() || `${user.firstName} ${user.lastName}`.trim() || user.email }));

  const schema = z
    .object({
      name: z.string().trim().min(1, t('project.nameRequiredError')),
      clientEmail: z.string().trim().refine((v) => v === '' || z.string().email().safeParse(v).success, t('auth.forgotPassword.invalidEmail')),
      totalBudget: z.string().refine((v) => {
        const n = parseDecimalInput(v);
        return n === null || (Number.isFinite(n) && n >= 0);
      }, t('common.invalidNumber')),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
    })
    .passthrough()
    .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
      path: ['endDate'],
      message: t('common.invalidDate'),
    });

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) as never, defaultValues: initialValues(project) });

  const typeOptions: Option[] = [
    ...PROJECT_TYPES.map((p) => ({ value: p.value, label: t(p.labelKey) })),
    { value: OTHER, label: t('project.otherType') },
  ];
  const statusOptions: Option[] = PROJECT_STATUSES.map((s) => ({ value: s, label: projectStatusLabel(t, s) }));
  const isOther = useWatch({ control, name: 'projectType' }) === OTHER;

  const submit = handleSubmit((v) => {
    const orNull = (s: string) => (s.trim() === '' ? null : s.trim());
    const projectType = v.projectType === OTHER ? v.projectTypeOther.trim() || t('project.otherType') : orNull(v.projectType);
    onSubmit({
      name: v.name.trim(),
      clientName: orNull(v.clientName),
      clientEmail: orNull(v.clientEmail),
      clientPhone: orNull(v.clientPhone),
      projectType,
      status: v.status,
      address: orNull(v.address),
      city: orNull(v.city),
      postalCode: orNull(v.postalCode),
      totalBudget: parseDecimalInput(v.totalBudget),
      startDate: v.startDate,
      endDate: v.endDate,
      description: orNull(v.description),
      siteManagerId: orNull(v.siteManagerId),
      structuralEngineerId: orNull(v.structuralEngineerId),
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
        {text('name', t('project.projectName'), { required: true })}
        {text('clientName', t('project.clientName'), { placeholder: t('project.clientNameExample') })}
        {text('clientEmail', t('project.clientEmail'), { keyboardType: 'email-address', autoCapitalize: 'none', placeholder: t('project.clientEmailExample') })}
        {text('clientPhone', t('project.clientPhone'), { keyboardType: 'phone-pad', placeholder: t('project.clientPhoneExample') })}
        <Controller
          control={control}
          name="projectType"
          render={({ field }) => (
            <SelectField label={t('project.projectType')} value={field.value || null} options={typeOptions} onChange={(v) => field.onChange(v ?? '')} allowClear placeholder={t('project.notDefined')} />
          )}
        />
        {isOther ? text('projectTypeOther', t('project.specifyType'), { placeholder: t('project.customTypeExample') }) : null}
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <SelectField label={project ? t('project.status') : t('project.initialStatus')} value={field.value} options={statusOptions} onChange={(v) => field.onChange(v ?? 'planning')} />
          )}
        />
      </AppCard>

      <AppCard style={{ gap: spacing.lg }}>
        <SectionHeader title={t('project.projectTeam')} />
        <Controller
          control={control}
          name="siteManagerId"
          render={({ field }) => (
            <SelectField
              label={t('project.siteManager')}
              value={field.value || null}
              options={teamOptions}
              onChange={(value) => field.onChange(value ?? '')}
              placeholder={t('project.notDefined')}
              allowClear
              searchable
              disabled={users.isLoading}
              hint={users.isError ? t('common.loadError') : undefined}
            />
          )}
        />
        <Controller
          control={control}
          name="structuralEngineerId"
          render={({ field }) => (
            <SelectField
              label={t('project.engineer')}
              value={field.value || null}
              options={teamOptions}
              onChange={(value) => field.onChange(value ?? '')}
              placeholder={t('project.notDefined')}
              allowClear
              searchable
              disabled={users.isLoading}
              hint={users.isError ? t('common.loadError') : undefined}
            />
          )}
        />
      </AppCard>

      <AppCard style={{ gap: spacing.lg }}>
        <SectionHeader title={t('project.location')} />
        {text('address', t('common.address'), { placeholder: t('project.addressExample') })}
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>{text('city', t('common.city'), { placeholder: t('project.cityExample') })}</View>
          <View style={{ flex: 1 }}>{text('postalCode', t('project.postalCode'), { keyboardType: 'number-pad' })}</View>
        </View>
      </AppCard>

      <AppCard style={{ gap: spacing.lg }}>
        <SectionHeader title={t('project.budgetSchedule')} />
        {text('totalBudget', t('project.budgetTotalMad'), { keyboardType: 'decimal-pad', placeholder: t('project.budgetExample') })}
        <Controller
          control={control}
          name="startDate"
          render={({ field }) => <DateField label={t('project.startDate')} value={field.value} onChange={field.onChange} />}
        />
        <Controller
          control={control}
          name="endDate"
          render={({ field }) => <DateField label={t('project.plannedEndDate')} value={field.value} onChange={field.onChange} error={errors.endDate?.message} />}
        />
        {text('description', t('project.projectDescriptionLabel'), { multiline: true })}
      </AppCard>
    </Screen>
  );
}
