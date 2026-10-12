/**
 * Poids HA (high-adherence reinforcement bar weight).
 *
 * Functional reference: https://www.concretedispatch.eu/blog/calculatrice-beton/
 * The reference exposes a diameter dropdown (HA6 … HA40), a length field and a
 * bar-count field, but not its internal weight formula. The formula below is
 * the standard one used throughout the French/European construction industry
 * for high-adherence (HA / B500) reinforcement bars, derived from steel
 * density (7850 kg/m³) and verified against the standard published linear-mass
 * table (HA10 = 0.617 kg/m, HA25 = 3.85-3.86 kg/m, HA40 = 9.86-9.87 kg/m, etc.).
 */

import {
  CalculationError,
  requireNonNegative,
  requireNonNegativeInteger,
  type CalculationErrorCode,
} from "./validation";

/** Standard HA diameters (mm) offered by the reference's dropdown. */
export const HA_DIAMETERS_MM = [6, 8, 10, 12, 14, 16, 20, 25, 32, 40] as const;
export type HaDiameterMm = (typeof HA_DIAMETERS_MM)[number];

/**
 * Standard linear-mass coefficient for reinforcing steel:
 * mass (kg/m) = diameter(mm)² × 0.00617, equivalent to (π/4) × d² × 7850 kg/m³
 * expressed in kg per linear metre. This is the constant published across
 * French/European rebar reference tables (calcul-btp.fr, aciersetplanchers.com, …).
 */
export const REBAR_LINEAR_MASS_COEFFICIENT = 0.00617;

export function haUnitWeightKgPerM(diameterMm: number): number {
  return diameterMm * diameterMm * REBAR_LINEAR_MASS_COEFFICIENT;
}

export interface HaWeightInput {
  /** Diamètre (mm) - selected from HA_DIAMETERS_MM. */
  diameterMm?: number | null;
  /** Longueur (m) per bar. Decimals allowed. */
  lengthM?: number | null;
  /** Nombre de barres. Must be a whole number. */
  quantity?: number | null;
}

export interface HaWeightResult {
  unitWeightKgPerM: number;
  totalWeightKg: number;
}

export type HaWeightField = "diameterMm" | "lengthM" | "quantity";

/**
 * Validation errors per input, so the UI can show each message under the field
 * it belongs to instead of in the results panel. Uses the same rules as
 * {@link computeHaWeight}, so a field flagged here is exactly a field the
 * calculation would reject. The optional inputs (material price, project,
 * notes) are never validated.
 */
export function collectHaWeightFieldErrors(
  input: HaWeightInput,
): Partial<Record<HaWeightField, CalculationErrorCode>> {
  const errors: Partial<Record<HaWeightField, CalculationErrorCode>> = {};

  const check = (field: HaWeightField, validate: () => void) => {
    try {
      validate();
    } catch (err) {
      if (!(err instanceof CalculationError)) throw err;
      errors[field] = err.code;
    }
  };

  check("diameterMm", () => requireNonNegative(input.diameterMm, "diameterMm"));
  check("lengthM", () => requireNonNegative(input.lengthM, "lengthM"));
  check("quantity", () => requireNonNegativeInteger(input.quantity, "quantity"));

  return errors;
}

export function computeHaWeight(input: HaWeightInput): HaWeightResult {
  const diameterMm = requireNonNegative(input.diameterMm, "diameterMm");
  const lengthM = requireNonNegative(input.lengthM, "lengthM");
  const quantity = requireNonNegativeInteger(input.quantity, "quantity");

  const unitWeightKgPerM = haUnitWeightKgPerM(diameterMm);
  const totalWeightKg = unitWeightKgPerM * lengthM * quantity;

  return { unitWeightKgPerM, totalWeightKg };
}
