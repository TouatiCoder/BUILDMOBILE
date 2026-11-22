import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';

import type { InventoryMaterial } from '@/api/types';
import { AppInput, SelectField } from '@/components/fields';
import { AppButton, AppText, StatusBadge } from '@/components/primitives';
import { useI18n } from '@/i18n/I18nProvider';
import { formatCurrency, formatNumber, parseDecimalInput, toNumber } from '@/lib/format';
import { colors, radius, shadows, spacing } from '@/theme/tokens';

/** One article of a purchase order being edited. `materialId` is null until chosen. */
export type OrderLineDraft = {
  key: string;
  materialId: string | null;
  name: string;
  unit: string;
  quantity: string;
  unitPrice: string;
};

let lineCounter = 0;

export function emptyOrderLine(): OrderLineDraft {
  lineCounter += 1;
  return { key: `line-${Date.now()}-${lineCounter}`, materialId: null, name: '', unit: '', quantity: '1', unitPrice: '' };
}

export const orderLineQuantity = (line: OrderLineDraft) => parseDecimalInput(line.quantity) ?? 0;
export const orderLinePrice = (line: OrderLineDraft) => parseDecimalInput(line.unitPrice) ?? 0;
export const orderLineTotal = (line: OrderLineDraft) => {
  const total = orderLineQuantity(line) * orderLinePrice(line);
  return Number.isFinite(total) ? total : 0;
};

/** Returns an error message for the first incomplete article, or undefined when all are valid. */
export function validateOrderLines(lines: OrderLineDraft[], tr: (fr: string, en: string, ar: string) => string) {
  if (lines.length === 0) return tr('Ajoutez au moins un article.', 'Add at least one article.', 'زيد على الأقل سلعة وحدة.');
  for (const [index, line] of lines.entries()) {
    const n = index + 1;
    if (!line.materialId) {
      return tr(`Article ${n} : choisissez un matériau.`, `Article ${n}: choose a material.`, `السلعة ${n}: اختار مادة.`);
    }
    if (!(orderLineQuantity(line) > 0) || !(orderLinePrice(line) > 0)) {
      return tr(
        `Article ${n} (${line.name}) : quantité et prix unitaire doivent être supérieurs à 0.`,
        `Article ${n} (${line.name}): quantity and unit price must be greater than 0.`,
        `السلعة ${n} (${line.name}): الكمية والثمن يجب أن يكونا أكبر من 0.`,
      );
    }
  }
  return undefined;
}

const sanitizeDecimal = (value: string) => value.replace(',', '.').replace(/[^0-9.]/g, '');

/** Round "+" button, as on the website's order form, that adds an empty article. */
export function AddArticleFab({ onPress, disabled, label }: { onPress: () => void; disabled?: boolean; label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          width: 52,
          height: 52,
          borderRadius: radius.pill,
          backgroundColor: colors.brand,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
        shadows.md,
      ]}>
      <Ionicons name="add" size={30} color="#FFFFFF" />
    </Pressable>
  );
}

/**
 * Articles of a purchase order, like the website: "+ Ajouter un article" adds an
 * empty article, the material is chosen inside it among the supplier's
 * materials, and quantity / unit price (prefilled) stay editable.
 */
export function OrderLinesEditor({
  lines,
  onChange,
  supplierMaterials,
  editable = true,
}: {
  lines: OrderLineDraft[];
  onChange: (lines: OrderLineDraft[]) => void;
  supplierMaterials: InventoryMaterial[];
  editable?: boolean;
}) {
  const { t, locale } = useI18n();
  const tr = (fr: string, en: string, ar: string) => (locale === 'ar' ? ar : locale === 'en' ? en : fr);

  const update = (key: string, patch: Partial<OrderLineDraft>) =>
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const chooseMaterial = (key: string, materialId: string | null) => {
    const material = supplierMaterials.find((m) => m.id === materialId);
    if (!material) return;
    update(key, {
      materialId: material.id,
      name: material.name,
      unit: material.unit,
      unitPrice: String(toNumber(material.unitPrice) || ''),
    });
  };

  const stockRows = (material: InventoryMaterial) => {
    const byWarehouse = new Map<string, { name: string; quantity: number }>();
    for (const row of material.inventory) {
      const key = row.warehouseId ?? '__none__';
      const entry = byWarehouse.get(key) ?? { name: row.warehouse?.name ?? t('inventory.noWarehouse'), quantity: 0 };
      entry.quantity += toNumber(row.quantity);
      byWarehouse.set(key, entry);
    }
    return [...byWarehouse.values()].filter((row) => row.quantity !== 0);
  };

  const canAdd = editable && supplierMaterials.some((m) => !lines.some((line) => line.materialId === m.id));
  const total = lines.reduce((sum, line) => sum + orderLineTotal(line), 0);

  return (
    <View style={{ gap: spacing.md }}>
      {lines.map((line, index) => {
        const material = supplierMaterials.find((m) => m.id === line.materialId);
        const takenElsewhere = new Set(lines.filter((other) => other.key !== line.key).map((other) => other.materialId));
        const options = supplierMaterials
          .filter((m) => !takenElsewhere.has(m.id))
          .map((m) => ({ value: m.id, label: m.name, description: `${formatCurrency(toNumber(m.unitPrice), locale)} / ${m.unit || '—'}` }));
        // A line of an existing order whose material is no longer linked to the supplier stays selectable.
        if (line.materialId && !options.some((o) => o.value === line.materialId)) {
          options.unshift({ value: line.materialId, label: line.name, description: line.unit || '—' });
        }
        const rows = material ? stockRows(material) : [];
        const stock = rows.reduce((sum, row) => sum + row.quantity, 0);
        const min = material?.inventory.length ? Math.max(0, ...material.inventory.map((r) => toNumber(r.minThreshold))) : 0;
        const unit = line.unit;

        return (
          <View
            key={line.key}
            style={{ gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
              <AppText variant="bodyStrong">{`${tr('Article', 'Article', 'السلعة')} ${index + 1}`}</AppText>
              {editable ? (
                <AppButton
                  title={tr('Retirer', 'Remove', 'حذف')}
                  variant="ghost"
                  size="sm"
                  icon="trash-outline"
                  onPress={() => onChange(lines.filter((item) => item.key !== line.key))}
                />
              ) : null}
            </View>
            <SelectField
              label={tr('Matériau', 'Material', 'المادة')}
              required
              value={line.materialId}
              options={options}
              onChange={(value) => chooseMaterial(line.key, value)}
              placeholder={tr('Sélectionner un matériau', 'Select a material', 'اختار مادة')}
              searchable
              disabled={!editable}
            />
            {line.materialId ? (
              <>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <AppInput
                      label={`${tr('Quantité', 'Quantity', 'الكمية')}${unit ? ` (${unit})` : ''}`}
                      value={line.quantity}
                      onChangeText={(value) => update(line.key, { quantity: sanitizeDecimal(value) })}
                      keyboardType="decimal-pad"
                      editable={editable}
                      required
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppInput
                      label={`${tr('Prix unitaire', 'Unit price', 'ثمن الوحدة')} (MAD)`}
                      value={line.unitPrice}
                      onChangeText={(value) => update(line.key, { unitPrice: sanitizeDecimal(value) })}
                      keyboardType="decimal-pad"
                      editable={editable}
                      required
                    />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                  <AppText variant="small">{tr('Total ligne', 'Line total', 'مجموع السطر')}</AppText>
                  <AppText variant="bodyStrong">{formatCurrency(orderLineTotal(line), locale)}</AppText>
                </View>
                {material ? (
                  <View style={{ gap: 2 }}>
                    <AppText variant="caption">{tr('Stock actuel', 'Current stock', 'المخزون الحالي')}</AppText>
                    {rows.map((row) => (
                      <View key={row.name} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                        <AppText variant="small">{row.name}</AppText>
                        <AppText variant="small">{`${formatNumber(row.quantity, locale)} ${unit}`.trim()}</AppText>
                      </View>
                    ))}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                      <AppText variant="small">Total</AppText>
                      <AppText variant="small">{`${formatNumber(stock, locale)} ${unit}`.trim()}</AppText>
                    </View>
                    {min > 0 && stock <= min ? (
                      <View style={{ alignItems: 'flex-start', marginTop: spacing.xs }}>
                        <StatusBadge label={tr('Sous le seuil minimum', 'Below minimum threshold', 'تحت الحد الأدنى')} tone="warning" />
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        );
      })}

      {editable ? (
        <AppButton
          title={tr('Ajouter un article', 'Add an article', 'زيد سلعة')}
          icon="add-circle-outline"
          variant="secondary"
          onPress={() => onChange([...lines, emptyOrderLine()])}
          disabled={!canAdd}
        />
      ) : null}
      {editable && supplierMaterials.length > 0 && !canAdd ? (
        <AppText variant="caption">
          {tr(
            'Tous les matériaux de ce fournisseur sont déjà dans la commande.',
            "All of this supplier's materials are already in the order.",
            'جميع مواد هذا المورد موجودة في الطلب.',
          )}
        </AppText>
      ) : null}

      {lines.length > 0 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
          <AppText variant="title">{t('costs.total')}</AppText>
          <AppText variant="title">{formatCurrency(total, locale)}</AppText>
        </View>
      ) : null}
    </View>
  );
}
