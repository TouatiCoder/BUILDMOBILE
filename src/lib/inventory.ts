import type { InventoryMaterial, InventoryRow } from '@/api/types';

import { toNumber, toNumberOrNull } from './format';

/**
 * Aggregates a material's inventory rows the same way the website does in
 * inventoryService.getAllMaterials: total quantity across warehouses and the
 * highest minimum threshold.
 */
export function aggregateStock(rows: InventoryRow[]) {
  const quantity = rows.reduce((sum, row) => sum + toNumber(row.quantity), 0);
  const minThreshold = rows.length ? Math.max(0, ...rows.map((r) => toNumber(r.minThreshold))) : 0;
  const maxValues = rows.map((r) => toNumberOrNull(r.maxThreshold)).filter((v): v is number => v !== null);
  const maxThreshold = maxValues.length ? Math.max(...maxValues) : null;
  return { quantity, minThreshold, maxThreshold };
}

export function materialValue(material: Pick<InventoryMaterial, 'unitPrice' | 'inventory'>): number {
  return aggregateStock(material.inventory).quantity * toNumber(material.unitPrice);
}
