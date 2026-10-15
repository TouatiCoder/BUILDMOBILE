import type { Project } from '@/api/types';
import { overBudgetProjects } from '@/features/dashboard/widgets';
import { mobileMessages } from '@/i18n/mobile-messages';
import { translate } from '@/i18n/translate';
import { formatDate, formatDateTime } from '@/lib/format';

const project = (id: string, budget: string, cost: string) =>
  ({ id, name: id, totalBudget: budget, currentCost: cost, status: 'active' }) as unknown as Project;

describe('dates follow the backlog format dd/mm/yyyy', () => {
  it('formats dates identically in every language', () => {
    const d = new Date(2026, 8, 7, 14, 5);
    expect(formatDate(d, 'fr')).toBe('07/09/2026');
    expect(formatDate(d, 'ar')).toBe('07/09/2026');
    expect(formatDateTime(d, 'en')).toBe('07/09/2026 14:05');
    expect(formatDate(null)).toBe('—');
  });
});

describe('admin dashboard: over-budget projects', () => {
  it('shows every project with any budget overrun, worst first', () => {
    const rows = overBudgetProjects([
      project('ok', '100', '100'),
      project('limit', '100', '101'),
      project('over10', '100', '110'),
      project('over50', '100', '150'),
      project('noBudget', '0', '50'),
    ]);
    expect(rows.map((r) => r.id)).toEqual(['over50', 'over10', 'limit']);
  });
});

describe('localization completeness', () => {
  it('defines every mobile string in French, English and Arabic', () => {
    const fr = Object.keys(mobileMessages.fr).sort();
    expect(Object.keys(mobileMessages.en).sort()).toEqual(fr);
    expect(Object.keys(mobileMessages.ar).sort()).toEqual(fr);
  });

  it('uses the requested welcome copy', () => {
    expect(translate('fr', 'welcome.title')).toBe('Bienvenue sur BuildStock Pro');
    expect(translate('ar', 'welcome.continue')).toBe('متابعة');
    expect(translate('en', 'welcome.subtitle')).toBe('Choose your preferred language to continue');
  });
});
