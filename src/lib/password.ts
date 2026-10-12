/** Password rules enforced by POST /api/register (livreee/app/api/register/route.ts). */
export const PASSWORD_RULES = [
  { key: 'common.passwordRequirementMinLength', test: (p: string) => p.length >= 8 },
  { key: 'common.passwordRequirementUppercase', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'common.passwordRequirementNumber', test: (p: string) => /[0-9]/.test(p) },
] as const;

export function passwordMeetsRules(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}
