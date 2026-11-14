import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { suppliersApi } from '@/api/endpoints';
import type { InventoryMaterial } from '@/api/types';

/**
 * Suppliers are soft-deleted on the backend (isActive=false) and
 * GET /api/suppliers only returns active ones, but GET /api/inventory/materials
 * still returns the deleted supplier on its materials. This hook hides those
 * stale associations. While the supplier list is loading, materials are left
 * untouched.
 */
export function useActiveSuppliers() {
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list });
  const activeIds = useMemo(
    () => (suppliers.data ? new Set(suppliers.data.filter((s) => s.isActive !== false).map((s) => s.id)) : null),
    [suppliers.data],
  );

  const withActiveSupplier = useCallback(
    <T extends Pick<InventoryMaterial, 'supplierId' | 'supplier'>>(material: T): T => {
      if (!activeIds) return material;
      const id = material.supplier?.id || material.supplierId;
      if (!id || activeIds.has(id)) return material;
      return { ...material, supplierId: null, supplier: null };
    },
    [activeIds],
  );

  return { suppliers, activeIds, withActiveSupplier };
}
