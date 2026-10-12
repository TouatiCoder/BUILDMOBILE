import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { useErrorMessage } from '@/components/feedback';
import { useToast } from '@/components/toast';
import { useI18n } from '@/i18n/I18nProvider';
import { canAccess, type Feature } from '@/lib/access';
import { hasPermission, type Permission, type UserRole } from '@/lib/permissions';

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role as UserRole | undefined;
  return {
    role,
    can: (permission: Permission) => (role ? hasPermission(role, permission) : false),
    /** Screen/feature access as on the website (see lib/access.ts). */
    allows: (feature: Feature) => canAccess(role, feature),
    isAdmin: role === 'admin',
    /** Server-side rule for /api/checklists and /api/tools (admin is excluded there). */
    isFieldRole: role === 'site_manager' || role === 'structural_engineer',
  };
}

/** Native confirmation dialog for destructive actions. */
export function useConfirm() {
  const { t } = useI18n();
  return useCallback(
    (options: { title?: string; message: string; confirmLabel?: string; destructive?: boolean }) =>
      new Promise<boolean>((resolve) => {
        Alert.alert(
          options.title ?? t('common.deleteConfirmTitle'),
          options.message,
          [
            { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
            {
              text: options.confirmLabel ?? t('common.delete'),
              style: options.destructive === false ? 'default' : 'destructive',
              onPress: () => resolve(true),
            },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        );
      }),
    [t],
  );
}

/**
 * Mutation wrapper: success feedback only after the server confirmed, error
 * feedback with the server's message, and invalidation of affected queries.
 */
export function useApiMutation<TVars, TResult = unknown>(options: {
  mutationFn: (vars: TVars) => Promise<TResult>;
  invalidate?: QueryKey[];
  successMessage?: string;
  onSuccess?: (result: TResult, vars: TVars) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const describe = useErrorMessage();
  return useMutation<TResult, unknown, TVars>({
    mutationFn: options.mutationFn,
    onSuccess: (result, vars) => {
      // Refetch in the background: the write is already confirmed by the server.
      for (const queryKey of options.invalidate ?? []) void queryClient.invalidateQueries({ queryKey });
      if (options.successMessage) toast.show('success', options.successMessage);
      options.onSuccess?.(result, vars);
    },
    onError: (error) => toast.show('error', describe(error)),
  });
}
