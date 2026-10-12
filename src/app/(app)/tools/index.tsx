import { router, Stack } from 'expo-router';

import { Banner } from '@/components/feedback';
import { ListGroup, ListRow, Screen } from '@/components/layout';
import type { IconName } from '@/components/primitives';
import { usePermissions } from '@/hooks/common';
import type { Feature } from '@/lib/access';
import { useI18n } from '@/i18n/I18nProvider';

export default function ToolsHubScreen() {
  const { t } = useI18n();
  const { allows } = usePermissions();
  const isFieldRole = allows('tools');
  // Same list as the website's "new calculation" page: steel is for structural engineers only.
  const tools = (
    [
      { icon: 'cube-outline', label: t('common.concreteCalculator'), href: '/tools/concrete', feature: 'tools' },
      { icon: 'barbell-outline', label: t('common.steelCalculator'), href: '/tools/steel', feature: 'tools.steel' },
      { icon: 'albums-outline', label: t('common.formworkCalculator'), href: '/tools/formwork', feature: 'tools' },
      { icon: 'grid-outline', label: t('common.meshCalculator'), href: '/tools/mesh', feature: 'tools' },
    ] as const satisfies readonly { icon: IconName; label: string; href: '/tools/concrete' | '/tools/steel' | '/tools/formwork' | '/tools/mesh'; feature: Feature }[]
  ).filter((tool) => !isFieldRole || allows(tool.feature));
  return (
    <Screen>
      <Stack.Screen options={{ title: t('common.calculationHubTitle') }} />
      {!isFieldRole ? <Banner tone="warning" message={t('tools.roleRestricted')} /> : null}
      <ListGroup>
        {tools.map((tool) => (
          <ListRow key={tool.href} icon={tool.icon} title={tool.label} onPress={isFieldRole ? () => router.push(tool.href) : undefined} />
        ))}
      </ListGroup>
    </Screen>
  );
}
