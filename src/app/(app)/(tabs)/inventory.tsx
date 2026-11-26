import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ApiError } from '@/api/client';
import { inventoryApi, materialsApi } from '@/api/endpoints';
import type { InventoryMaterial } from '@/api/types';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback';
import { ChipGroup, SearchInput, SelectField, type Option } from '@/components/fields';
import { StatCard, StatGrid } from '@/components/layout';
import { AppText, StatusBadge, IconTile, type IconName } from '@/components/primitives';
import { useConfirm, usePermissions } from '@/hooks/common';
import { useActiveSuppliers } from '@/hooks/useActiveSuppliers';
import { useToast } from '@/components/toast';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useI18n } from '@/i18n/I18nProvider';
import { formatCurrency, formatNumber, toNumber } from '@/lib/format';
import { aggregateStock } from '@/lib/inventory';
import { stockState, stockStateLabel, stockStateTone } from '@/lib/labels';
import { colors, radius, spacing } from '@/theme/tokens';

type StockFilter = 'all' | 'low' | 'critical';

export default function InventoryScreen() {
  const { t, locale } = useI18n();
  const { can } = usePermissions();
  const isFocused = useIsFocused();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StockFilter>('all');
  const [category, setCategory] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  // 3 action tiles per row on regular phones, 2 on narrow ones / large fonts.
  const { width, fontScale } = useWindowDimensions();
  const actionBasis = width < 380 || fontScale > 1.15 ? '45%' : '30%';
  const confirm = useConfirm();
  const toast = useToast();
  const tr = (fr: string, en: string, ar: string) => (locale === 'ar' ? ar : locale === 'en' ? en : fr);
  const debounced = useDebouncedValue(search);

  // Scanned code: open the material carrying it, or offer to create one with it.
  const handleScanned = async (code: string) => {
    setScanning(false);
    try {
      const found = await materialsApi.byCode(code);
      router.push({ pathname: '/materials/[id]', params: { id: found.id } });
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) {
        toast.show('error', error instanceof Error ? error.message : tr('Erreur réseau', 'Network error', 'خطأ في الشبكة'));
        return;
      }
      if (!can('manage_inventory')) {
        toast.show('error', tr(`Aucun matériau avec le code ${code}.`, `No material has the code ${code}.`, `ما كاين حتى مادة بالكود ${code}.`));
        return;
      }
      const create = await confirm({
        title: tr('Code inconnu', 'Unknown code', 'كود غير معروف'),
        message: tr(
          `Aucun matériau n'a le code ${code}. Créer un nouveau matériau avec ce code ?`,
          `No material has the code ${code}. Create a new material with this code?`,
          `ما كاين حتى مادة بالكود ${code}. نزيدو مادة جديدة بهاد الكود؟`,
        ),
        confirmLabel: tr('Créer', 'Create', 'زيد'),
        destructive: false,
      });
      if (create) router.push({ pathname: '/materials/new', params: { barcode: code } });
    }
  };

  const filters = useQuery({
    queryKey: ['inventory', 'filters'],
    queryFn: inventoryApi.filters,
    staleTime: 60_000,
  });
  // Load the complete per-material inventory once and apply search/status filters
  // locally. This keeps the visible list, badges, and counts consistent even
  // when an older API deployment returns warehouse-level rather than material-level stats.
  const materials = useQuery({
    queryKey: ['inventory', 'materials', 'all'],
    queryFn: () => inventoryApi.materials({}),
    refetchInterval: isFocused ? 30_000 : false,
    refetchIntervalInBackground: false,
  });

  // The inventory API can include repeated material rows on some deployments.
  // Deduplicate by stable material ID before deriving counts, stock totals, and list rows.
  const { withActiveSupplier } = useActiveSuppliers();
  const uniqueMaterials = useMemo(() => {
    const seen = new Set<string>();
    return (materials.data ?? []).filter((material) => {
      if (seen.has(material.id)) return false;
      seen.add(material.id);
      return true;
    }).map(withActiveSupplier);
  }, [materials.data, withActiveSupplier]);

  const filteredMaterials = useMemo(() => {
    const term = debounced.trim().toLocaleLowerCase();
    return uniqueMaterials.filter((material) => {
      const matchesSearch = !term || [
        material.name,
        material.category ?? '',
        material.supplier?.name ?? '',
        material.description ?? '',
        material.barcode ?? '',
      ].some((value) => value.toLocaleLowerCase().includes(term));
      if (!matchesSearch) return false;
      if (category && material.category !== category) return false;
      const stock = aggregateStock(material.inventory);
      const state = stockState(stock.quantity, stock.minThreshold, stock.maxThreshold);
      if (filter === 'low' && state !== 'low') return false;
      if (filter === 'critical' && state !== 'critical') return false;
      return true;
    });
  }, [uniqueMaterials, debounced, filter, category]);

  const inventoryStats = useMemo(() => {
    const rows = uniqueMaterials;
    let totalValue = 0;
    let lowStockCount = 0;
    let criticalStockCount = 0;
    for (const material of rows) {
      const stock = aggregateStock(material.inventory);
      totalValue += stock.quantity * toNumber(material.unitPrice);
      const state = stockState(stock.quantity, stock.minThreshold, stock.maxThreshold);
      if (state === 'low') lowStockCount += 1;
      if (state === 'critical') criticalStockCount += 1;
    }
    return { totalMaterials: rows.length, totalValue, lowStockCount, criticalStockCount };
  }, [uniqueMaterials]);

  useFocusEffect(
    useCallback(() => {
      void materials.refetch();
    }, [materials]),
  );

  const categoryOptions: Option[] = useMemo(
    () => (filters.data?.categories ?? []).map((c) => ({ value: c, label: c })),
    [filters.data],
  );

  const actions: { icon: IconName; label: string; onPress: () => void; show: boolean }[] = [
    { icon: 'scan-outline', label: tr('Scanner', 'Scan', 'سكاني'), onPress: () => setScanning(true), show: true },
    { icon: 'add-circle-outline', label: t('inventory.stockEntry'), onPress: () => router.push({ pathname: '/inventory/operation', params: { mode: 'entry' } }), show: can('manage_inventory') },
    { icon: 'swap-horizontal-outline', label: t('inventory.stockTransfer'), onPress: () => router.push({ pathname: '/inventory/operation', params: { mode: 'transfer' } }), show: can('manage_inventory') },
    { icon: 'cube-outline', label: t('inventory.newMaterial'), onPress: () => router.push('/materials/new'), show: can('manage_inventory') },
    { icon: 'time-outline', label: t('inventory.stockMovements'), onPress: () => router.push('/inventory/movements'), show: true },
    { icon: 'business-outline', label: t('common.warehouses'), onPress: () => router.push('/warehouses'), show: true },
  ];

  const header = (
    <View style={{ gap: spacing.lg }}>
      {materials.data ? (
        <StatGrid>
          <StatCard icon="cash-outline" tone="brand" label={t('inventory.statsValue')} value={formatCurrency(inventoryStats.totalValue, locale)} />
          <StatCard icon="layers-outline" tone="info" label={t('inventory.statsTotalMaterials')} value={String(inventoryStats.totalMaterials)} />
          <StatCard
            icon="trending-down-outline"
            tone={inventoryStats.lowStockCount > 0 ? 'warning' : 'success'}
            label={t('inventory.lowStock')}
            value={String(inventoryStats.lowStockCount)}
            onPress={() => setFilter('low')}
          />
          <StatCard
            icon="alert-circle-outline"
            tone={inventoryStats.criticalStockCount > 0 ? 'danger' : 'success'}
            label={t('inventory.outOfStock')}
            value={String(inventoryStats.criticalStockCount)}
            onPress={() => setFilter('critical')}
          />
        </StatGrid>
      ) : null}
      {/* Grid (not a sideways scroll) so every action, e.g. "Nouveau matériau", stays visible. */}
      <View style={styles.actionGrid}>
        {actions
          .filter((a) => a.show)
          .map((a) => (
            <Pressable key={a.label} accessibilityRole="button" onPress={a.onPress} style={({ pressed }) => [styles.action, { flexBasis: actionBasis }, pressed && { opacity: 0.8 }]}>
              <IconTile icon={a.icon} size={36} />
              <AppText variant="small" style={{ fontWeight: '600', color: colors.text }} numberOfLines={2}>
                {a.label}
              </AppText>
            </Pressable>
          ))}
      </View>
      <SearchInput value={search} onChangeText={setSearch} />
      <ChipGroup<StockFilter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: t('inventory.allMaterials') },
          { value: 'low', label: t('inventory.lowStock') },
          { value: 'critical', label: t('inventory.outOfStock') },
        ]}
      />
      {categoryOptions.length > 0 ? (
        <SelectField
          label={t('inventory.category')}
          value={category}
          options={categoryOptions}
          onChange={setCategory}
          allowClear
          placeholder={t('project.allTypes')}
        />
      ) : null}
    </View>
  );

  return (
    <>
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      data={filteredMaterials}
      keyExtractor={(m) => m.id}
      ListHeaderComponent={header}
      renderItem={({ item }) => <MaterialRow material={item} />}
      refreshing={false}
      onRefresh={() => {
        void materials.refetch();
      }}
      ListEmptyComponent={
        materials.isLoading ? (
          <ListSkeleton rows={4} />
        ) : materials.isError ? (
          <ErrorState error={materials.error} onRetry={() => materials.refetch()} />
        ) : (
          <EmptyState icon="cube-outline" title={t('inventory.noMaterialsFound')} />
        )
      }
    />
    {scanning ? (
      <BarcodeScanner
        title={tr('Scanner un matériau', 'Scan a material', 'سكاني مادة')}
        onClose={() => setScanning(false)}
        onScanned={(code) => void handleScanned(code)}
      />
    ) : null}
    </>
  );
}


function MaterialRow({ material }: { material: InventoryMaterial }) {
  const { t, locale } = useI18n();
  const s = aggregateStock(material.inventory);
  const state = stockState(s.quantity, s.minThreshold, s.maxThreshold);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${material.name}, ${formatNumber(s.quantity, locale)} ${material.unit}, ${stockStateLabel(t, state)}`}
      onPress={() => router.push({ pathname: '/materials/[id]', params: { id: material.id } })}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
      <View style={{ flex: 1, gap: 4 }}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {material.name}
        </AppText>
        <AppText variant="caption">
          {[material.category ?? t('inventory.uncategorized'), material.supplier?.name].filter(Boolean).join(' · ')}
        </AppText>
        <StatusBadge label={stockStateLabel(t, state)} tone={stockStateTone(state)} />
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <AppText variant="title">
          {formatNumber(s.quantity, locale)} <AppText variant="small">{material.unit}</AppText>
        </AppText>
        <AppText variant="caption">
          {t('common.minLabel')} {formatNumber(s.minThreshold, locale)}
        </AppText>
        <AppText variant="caption">{formatCurrency(toNumber(material.unitPrice), locale)}</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 760, alignSelf: 'center' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: {
    flexGrow: 1,
    flexBasis: '30%',
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
