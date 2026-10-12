/**
 * Concrete calculators: volume (dalle / voile / poteau rectangulaire / poteau rond)
 * and dosage (ciment / sable / gravier / eau).
 *
 * Functional reference: https://www.concretedispatch.eu/blog/calculatrice-beton/
 * The reference exposes the fields and dropdown options below, but its actual
 * arithmetic runs client-side in JavaScript that is not present in the page's
 * static markup, so it could not be extracted even after two dedicated fetch
 * passes. Every formula here is therefore either:
 *   (a) exact geometry (volume calculators), or
 *   (b) explicitly documented as a standard/estimated ratio (dosage calculator).
 */

import { CalculationError, requireNonNegative, type CalculationErrorCode } from "./validation";

// ---------------------------------------------------------------------------
// Volume de béton
// ---------------------------------------------------------------------------

export type ConcreteElementType = "dalle" | "voile" | "poteau_rectangulaire" | "poteau_rond";

export const CONCRETE_ELEMENT_TYPES: ConcreteElementType[] = [
  "dalle",
  "voile",
  "poteau_rectangulaire",
  "poteau_rond",
];

/**
 * Generic dimension slots. The three rectangular elements (dalle, voile,
 * poteau rectangulaire) all share the same parallelepiped arithmetic, so the
 * slots are intentionally generic and each element type decides what they mean
 * to the user through {@link CONCRETE_ELEMENT_FIELDS}:
 *
 *   element               | length (m) | width (m) | thicknessCm (cm)
 *   ----------------------|------------|-----------|-----------------
 *   dalle                 | Longueur   | Largeur   | Épaisseur
 *   voile                 | Longueur   | Hauteur   | Épaisseur
 *   poteau rectangulaire  | Hauteur    | Longueur  | Largeur
 *
 * Surface is always the product of the two metre slots, so it matches the two
 * first labels shown to the user (e.g. Hauteur × Longueur for a rectangular
 * column), and Volume applies the third (centimetre) slot.
 */
export interface ConcreteVolumeInput {
  elementType: ConcreteElementType;
  /** First metre dimension: Longueur (dalle, voile) / Hauteur (poteau rectangulaire) */
  length?: number | null;
  /** Second metre dimension: Largeur (dalle) / Hauteur (voile) / Longueur (poteau rectangulaire) */
  width?: number | null;
  /** Third dimension in cm: Épaisseur (dalle, voile) / Largeur (poteau rectangulaire) */
  thicknessCm?: number | null;
  /** Diamètre (cm) - poteau rond */
  diameterCm?: number | null;
  /** Hauteur (m) - poteau rond */
  heightM?: number | null;
}

/** Input slot a UI field writes to. */
export type ConcreteDimensionField = "length" | "width" | "thicknessCm" | "diameterCm" | "heightM";

export interface ConcreteFieldDescriptor {
  field: ConcreteDimensionField;
  /** Key in the `common` message namespace; the translated label carries its unit. */
  labelKey: string;
  unit: "m" | "cm";
}

/**
 * The inputs to display for each element type, in order, with the translation
 * key of the label. Single source of truth shared by the UI and the tests so a
 * label can never drift from the geometry it feeds (client feedback: a voile
 * must ask for "Hauteur", not "Largeur", and a poteau rectangulaire must ask
 * for Hauteur / Longueur / Largeur).
 */
export const CONCRETE_ELEMENT_FIELDS: Record<ConcreteElementType, ConcreteFieldDescriptor[]> = {
  dalle: [
    { field: "length", labelKey: "concreteLengthLabel", unit: "m" },
    { field: "width", labelKey: "concreteWidthLabel", unit: "m" },
    { field: "thicknessCm", labelKey: "concreteThicknessLabel", unit: "cm" },
  ],
  voile: [
    { field: "length", labelKey: "concreteLengthLabel", unit: "m" },
    { field: "width", labelKey: "concreteHeightLabel", unit: "m" },
    { field: "thicknessCm", labelKey: "concreteThicknessLabel", unit: "cm" },
  ],
  poteau_rectangulaire: [
    { field: "length", labelKey: "concreteHeightLabel", unit: "m" },
    { field: "width", labelKey: "concreteLengthLabel", unit: "m" },
    { field: "thicknessCm", labelKey: "concreteColumnWidthCmLabel", unit: "cm" },
  ],
  poteau_rond: [
    { field: "heightM", labelKey: "concreteRoundHeightLabel", unit: "m" },
    { field: "diameterCm", labelKey: "concreteDiameterLabel", unit: "cm" },
  ],
};

/**
 * Validation errors per input, for the element currently selected, so the UI can
 * show the message under the field it belongs to instead of in the results
 * panel. Only the fields that element actually requires are validated - the
 * inputs it does not display (and the optional project/notes) are never
 * reported as missing.
 *
 * Uses the same rules as the calculation itself (see requireNonNegative), so a
 * field flagged here is exactly a field computeConcreteVolume would reject.
 */
export function collectConcreteVolumeFieldErrors(
  elementType: ConcreteElementType,
  values: Partial<Record<ConcreteDimensionField, number | null>>,
): Partial<Record<ConcreteDimensionField, CalculationErrorCode>> {
  const errors: Partial<Record<ConcreteDimensionField, CalculationErrorCode>> = {};

  for (const descriptor of CONCRETE_ELEMENT_FIELDS[elementType]) {
    try {
      requireNonNegative(values[descriptor.field] ?? null, descriptor.field);
    } catch (err) {
      if (!(err instanceof CalculationError)) throw err;
      errors[descriptor.field] = err.code;
    }
  }

  return errors;
}

export interface ConcreteVolumeResult {
  surfaceM2: number;
  volumeM3: number;
}

const CM_TO_M = 1 / 100;

/**
 * Rectangular geometry shared by dalle, voile and poteau rectangulaire.
 *
 * Surface = first metre dimension × second metre dimension, i.e. exactly the
 * two first labels the user sees for the selected element:
 *   - dalle: Longueur × Largeur
 *   - voile: Longueur × Hauteur
 *   - poteau rectangulaire: Hauteur × Longueur
 *
 * Volume = Surface × third dimension, converted from cm to m (Épaisseur for a
 * dalle/voile, Largeur for a poteau rectangulaire).
 */
function computeRectangularVolume(input: ConcreteVolumeInput): ConcreteVolumeResult {
  const length = requireNonNegative(input.length, "length");
  const width = requireNonNegative(input.width, "width");
  const thicknessM = requireNonNegative(input.thicknessCm, "thicknessCm") * CM_TO_M;

  const surfaceM2 = length * width;
  const volumeM3 = surfaceM2 * thicknessM;
  return { surfaceM2, volumeM3 };
}

/**
 * Poteau rond (round column): circular cross-section, never the rectangular
 * formula. Surface = π·r², Volume = Surface × Hauteur.
 */
function computeRoundColumnVolume(input: ConcreteVolumeInput): ConcreteVolumeResult {
  const diameterM = requireNonNegative(input.diameterCm, "diameterCm") * CM_TO_M;
  const heightM = requireNonNegative(input.heightM, "heightM");

  const radiusM = diameterM / 2;
  const surfaceM2 = Math.PI * radiusM * radiusM;
  const volumeM3 = surfaceM2 * heightM;
  return { surfaceM2, volumeM3 };
}

export function computeConcreteVolume(input: ConcreteVolumeInput): ConcreteVolumeResult {
  if (input.elementType === "poteau_rond") {
    return computeRoundColumnVolume(input);
  }
  return computeRectangularVolume(input);
}

// ---------------------------------------------------------------------------
// Dosage du béton
// ---------------------------------------------------------------------------

/** The three dosage tiers exposed by the reference, in kg of cement per m³ of concrete. */
export type CementDosage = 200 | 300 | 350;

export const CEMENT_DOSAGES: CementDosage[] = [200, 300, 350];

export interface ConcreteDosageInput {
  /** Dosage de ciment (kg/m³) - one of the reference's three tiers. */
  dosageKgM3: CementDosage;
  /** Volume (m³) of concrete to produce. */
  volumeM3?: number | null;
}

export interface ConcreteDosageResult {
  cementKg: number;
  sandKg: number;
  gravelKg: number;
  waterL: number;
  /** Practical reading of {@link ConcreteDosageResult.cementKg} in 25 kg bags. */
  cementBags25kg: number;
}

/** Cement is sold in 25 kg bags. */
export const CEMENT_BAG_KG = 25;

/**
 * Reads a cement mass as a number of 25 kg bags: bags = cementKg / 25.
 * e.g. 3500 kg -> 140 bags.
 *
 * Deliberately a plain division: no rounding rule is applied here, because none
 * was specified. The exact value is returned and the UI formats it with the
 * usual number formatting.
 */
export function cementBagsFromKg(cementKg: number): number {
  return cementKg / CEMENT_BAG_KG;
}

/**
 * Standard water/cement ratio for structural concrete (E/C ≈ 0.50). This is a
 * widely published baseline (not something invented for this task) and is
 * corroborated by three independent published dosage tables that each land on
 * exactly 0.50: 125 L / 250 kg, 150 L / 300 kg, 175 L / 350 kg cement.
 */
const WATER_CEMENT_RATIO = 0.5;

/**
 * Sand and gravel are estimated from the volumetric coefficients already used
 * by BuildStock's previous concrete calculator (0.5 m³ of sand and 0.8 m³ of
 * gravel per m³ of concrete), converted to mass with standard dry bulk
 * densities for construction aggregates (sand ≈ 1600 kg/m³, gravel ≈ 1500
 * kg/m³).
 *
 * LIMITATION (documented per project requirements rather than invented):
 * concretedispatch.eu computes sand/gravel/water client-side and does not
 * expose its internal ratios in the page's static content, and these
 * coefficients are not currently tier-specific (they do not vary between the
 * 200/300/350 kg/m³ dosages). If exact per-tier aggregate ratios are required,
 * the client should supply the reference table so it can be encoded exactly.
 */
const SAND_M3_PER_M3_CONCRETE = 0.5;
const GRAVEL_M3_PER_M3_CONCRETE = 0.8;
const SAND_DENSITY_KG_M3 = 1600;
const GRAVEL_DENSITY_KG_M3 = 1500;

export function computeConcreteDosage(input: ConcreteDosageInput): ConcreteDosageResult {
  const volumeM3 = requireNonNegative(input.volumeM3, "volumeM3");

  const cementKg = input.dosageKgM3 * volumeM3;
  const waterL = cementKg * WATER_CEMENT_RATIO;
  const sandKg = volumeM3 * SAND_M3_PER_M3_CONCRETE * SAND_DENSITY_KG_M3;
  const gravelKg = volumeM3 * GRAVEL_M3_PER_M3_CONCRETE * GRAVEL_DENSITY_KG_M3;

  return { cementKg, sandKg, gravelKg, waterL, cementBags25kg: cementBagsFromKg(cementKg) };
}
