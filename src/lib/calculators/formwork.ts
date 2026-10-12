/**
 * Formwork calculator: contact area, plywood panels and timber length for the
 * four foundation types of the client's reference calculator.
 *
 * Reference (supplied by the client, inspected in a real browser on 2026-09-26):
 * https://pinmy.co/fr/formwork-calculator/
 *
 * Every formula below is the one the reference prints on screen for the
 * selected foundation type, and each was checked against the reference's own
 * output by varying one parameter at a time:
 *
 *   type             reference formula line
 *   ---------------- ---------------------------------------------------------
 *   slab (dalle)     A = 2(L + W) × H
 *   strip (semelle)  Lnet = 2L + 2(W − 2T),  A = 2 × Lnet × H
 *   column (plot)    A = 2(Acol + Bcol) × H × N        (N = nombre de plots)
 *   pile (pieu)      Lnet = 2L + 2(W − 2Tb), A = 2 × Lnet × Hb
 *
 *   panels = ceil(A × (1 + waste/100) / panel area)   (waste changes only this)
 *   timber = A / joist spacing                        (spacing 0.5 -> 0.25
 *                                                      doubled it: 36.8 -> 73.6)
 *
 * The reference applies the formulas literally: with W − 2T negative it does
 * NOT clamp (L=6, W=0.5, Tb=0.4, Hb=0.5 -> 11.4 m², not 12 m²), so neither do we.
 *
 * The type tokens are the ones the reference itself puts in the URL when each
 * type is selected: slab / strip / column / pile. "Plot" is `column`, and it is
 * the only type with a piece count and its own A/B/H labels - it is NOT a copy
 * of the dalle.
 */

import {
  CalculationError,
  requireNonNegative,
  requireNonNegativeInteger,
  requirePositive,
  type CalculationErrorCode,
} from "./validation";

/**
 * Unit system of the inputs the user types. The calculation itself always runs
 * in metres (see computeFormwork): the UI converts what the user enters into
 * metres, and converts the results back for display, so the geometry is
 * identical whichever system is selected.
 */
export type FormworkUnitSystem = "metric" | "imperial";

export const FORMWORK_UNIT_SYSTEMS: FormworkUnitSystem[] = ["metric", "imperial"];

/** Exact conversion requested by the client: 1 metre = 3.280839895 feet. */
export const FEET_PER_METER = 3.280839895;

export function metersToFeet(meters: number): number {
  return meters * FEET_PER_METER;
}

export function feetToMeters(feet: number): number {
  return feet / FEET_PER_METER;
}

export function squareMetersToSquareFeet(squareMeters: number): number {
  return squareMeters * FEET_PER_METER * FEET_PER_METER;
}

export function squareFeetToSquareMeters(squareFeet: number): number {
  return squareFeet / (FEET_PER_METER * FEET_PER_METER);
}

/** A length the user typed, expressed in metres for the calculation. */
export function lengthToMeters(value: number, unit: FormworkUnitSystem): number {
  return unit === "imperial" ? feetToMeters(value) : value;
}

/** A length in metres, expressed in the unit the user is working in. */
export function lengthFromMeters(meters: number, unit: FormworkUnitSystem): number {
  return unit === "imperial" ? metersToFeet(meters) : meters;
}

/** An area in m², expressed in the unit the user is working in. */
export function areaFromSquareMeters(squareMeters: number, unit: FormworkUnitSystem): number {
  return unit === "imperial" ? squareMetersToSquareFeet(squareMeters) : squareMeters;
}

/** Symbols shown next to the values; identical in all three locales. */
export const FORMWORK_UNIT_SYMBOLS: Record<FormworkUnitSystem, { length: string; area: string }> = {
  metric: { length: "m", area: "m²" },
  imperial: { length: "ft", area: "ft²" },
};

export type FormworkFoundationType = "slab" | "strip" | "column" | "pile";

export const FORMWORK_FOUNDATION_TYPES: FormworkFoundationType[] = ["slab", "strip", "column", "pile"];

/** Panel sizes offered by the reference, in millimetres. */
export interface FormworkPanelSize {
  id: string;
  widthMm: number;
  lengthMm: number;
}

export const FORMWORK_PANEL_SIZES: FormworkPanelSize[] = [
  { id: "1220x2440", widthMm: 1220, lengthMm: 2440 },
  { id: "1500x3000", widthMm: 1500, lengthMm: 3000 },
  { id: "1220x1220", widthMm: 1220, lengthMm: 1220 },
];

export const DEFAULT_FORMWORK_PANEL_ID = "1220x2440";

export function getFormworkPanelSize(id: string): FormworkPanelSize | undefined {
  return FORMWORK_PANEL_SIZES.find((panel) => panel.id === id);
}

/** Panel area in m², from its millimetre dimensions (1220 × 2440 -> 2.9768 m²). */
export function panelAreaM2(panel: FormworkPanelSize): number {
  return (panel.widthMm / 1000) * (panel.lengthMm / 1000);
}

/** Input slot a UI field writes to. */
export type FormworkDimensionField = "lengthM" | "widthM" | "heightM" | "thicknessM" | "plotCount";

export interface FormworkFieldDescriptor {
  field: FormworkDimensionField;
  /** Key in the `common` message namespace. */
  labelKey: string;
  /**
   * "length" fields carry the active unit (m / ft) and are converted with it;
   * "count" is a number of pieces - unitless, never converted, whole numbers only.
   */
  kind: "length" | "count";
}

/**
 * Inputs per foundation type, in the reference's order and with its wording:
 * a dalle/plot asks Longueur / Largeur / Épaisseur, a semelle filante asks
 * Longueur extérieure / Largeur extérieure / Hauteur totale / Épaisseur de la
 * semelle, a pieu + longrine asks the four dimensions of the longrine.
 */
export const FORMWORK_TYPE_FIELDS: Record<FormworkFoundationType, FormworkFieldDescriptor[]> = {
  slab: [
    { field: "lengthM", labelKey: "formworkLengthLabel", kind: "length" },
    { field: "widthM", labelKey: "formworkWidthLabel", kind: "length" },
    { field: "heightM", labelKey: "formworkThicknessLabel", kind: "length" },
  ],
  strip: [
    { field: "lengthM", labelKey: "formworkOuterLengthLabel", kind: "length" },
    { field: "widthM", labelKey: "formworkOuterWidthLabel", kind: "length" },
    { field: "heightM", labelKey: "formworkTotalHeightLabel", kind: "length" },
    { field: "thicknessM", labelKey: "formworkFootingThicknessLabel", kind: "length" },
  ],
  // Plot: the reference asks Largeur / Longueur / Hauteur du plot, then the
  // number of plots - in that order.
  column: [
    { field: "widthM", labelKey: "formworkPlotWidthLabel", kind: "length" },
    { field: "lengthM", labelKey: "formworkPlotLengthLabel", kind: "length" },
    { field: "heightM", labelKey: "formworkPlotHeightLabel", kind: "length" },
    { field: "plotCount", labelKey: "formworkPlotCountLabel", kind: "count" },
  ],
  pile: [
    { field: "lengthM", labelKey: "formworkBeamLengthLabel", kind: "length" },
    { field: "widthM", labelKey: "formworkBeamWidthLabel", kind: "length" },
    { field: "heightM", labelKey: "formworkBeamHeightLabel", kind: "length" },
    { field: "thicknessM", labelKey: "formworkBeamThicknessLabel", kind: "length" },
  ],
};

/** The formula the reference prints for each type, shown under the inputs. */
export const FORMWORK_TYPE_FORMULA: Record<FormworkFoundationType, string> = {
  slab: "A = 2(L + W) × H",
  strip: "Lnet = 2L + 2(W − 2T), A = 2 × Lnet × H",
  column: "A = 2(Acol + Bcol) × H × N",
  pile: "Lnet = 2L + 2(W − 2Tb), A = 2 × Lnet × Hb",
};

export interface FormworkInput {
  type: FormworkFoundationType;
  /** Longueur (m) */
  lengthM?: number | null;
  /** Largeur (m) */
  widthM?: number | null;
  /** Épaisseur (dalle/plot) or Hauteur (semelle/longrine), in m */
  heightM?: number | null;
  /** Épaisseur de la semelle / de la longrine (m) - strip and pile only */
  thicknessM?: number | null;
  /** Nombre de plots - column only, a whole number of pieces */
  plotCount?: number | null;
  /** Marge de chute (%) - applied to the panel count only */
  wastePercent?: number | null;
  /** Espacement des solives (m) - must be > 0, the timber length divides by it */
  joistSpacingM?: number | null;
  /** Id from FORMWORK_PANEL_SIZES */
  panelId: string;
}

export interface FormworkResult {
  /** Surface de coffrage (m²) - geometric contact area, before waste. */
  contactAreaM2: number;
  /** Panneaux de contreplaqué, waste included, rounded up to whole panels. */
  panelCount: number;
  /** Longueur de bois (m). */
  timberLengthM: number;
  /** Developed length used by the strip/pile formulas (Lnet), for display. */
  netLengthM: number | null;
}

/** Does this foundation type use the Lnet formula (and therefore a thickness)? */
export function usesNetLength(type: FormworkFoundationType): boolean {
  return type === "strip" || type === "pile";
}

export function computeFormwork(input: FormworkInput): FormworkResult {
  const panel = getFormworkPanelSize(input.panelId);
  if (!panel) throw new CalculationError("invalid", "panelId");

  const lengthM = requireNonNegative(input.lengthM, "lengthM");
  const widthM = requireNonNegative(input.widthM, "widthM");
  const heightM = requireNonNegative(input.heightM, "heightM");
  const wastePercent = requireNonNegative(input.wastePercent, "wastePercent");
  // The timber length divides by the spacing, so zero is not a usable value.
  const joistSpacingM = requirePositive(input.joistSpacingM, "joistSpacingM");

  let contactAreaM2: number;
  let netLengthM: number | null = null;

  if (usesNetLength(input.type)) {
    const thicknessM = requireNonNegative(input.thicknessM, "thicknessM");
    // Lnet = 2L + 2(W − 2T), applied literally like the reference does.
    netLengthM = 2 * lengthM + 2 * (widthM - 2 * thicknessM);
    contactAreaM2 = 2 * netLengthM * heightM;
  } else if (input.type === "column") {
    // A = 2(Acol + Bcol) × H × N - the four faces of each plot, times the count.
    const plotCount = requireNonNegativeInteger(input.plotCount, "plotCount");
    contactAreaM2 = 2 * (widthM + lengthM) * heightM * plotCount;
  } else {
    contactAreaM2 = 2 * (lengthM + widthM) * heightM;
  }

  const areaWithWasteM2 = contactAreaM2 * (1 + wastePercent / 100);
  const panelCount = Math.ceil(areaWithWasteM2 / panelAreaM2(panel));
  const timberLengthM = contactAreaM2 / joistSpacingM;

  return { contactAreaM2, panelCount, timberLengthM, netLengthM };
}

/**
 * Validation errors per input, for the selected foundation type, so the UI can
 * show each message under the field it belongs to. Only the fields that type
 * displays are validated.
 */
export function collectFormworkFieldErrors(
  input: FormworkInput,
): Partial<Record<FormworkDimensionField | "wastePercent" | "joistSpacingM", CalculationErrorCode>> {
  const errors: Partial<Record<FormworkDimensionField | "wastePercent" | "joistSpacingM", CalculationErrorCode>> = {};


  const check = (field: keyof typeof errors, validate: () => void) => {
    try {
      validate();
    } catch (err) {
      if (!(err instanceof CalculationError)) throw err;
      errors[field] = err.code;
    }
  };

  for (const descriptor of FORMWORK_TYPE_FIELDS[input.type]) {
    check(descriptor.field, () =>
      descriptor.kind === "count"
        ? requireNonNegativeInteger(input[descriptor.field], descriptor.field)
        : requireNonNegative(input[descriptor.field], descriptor.field),
    );
  }
  check("wastePercent", () => requireNonNegative(input.wastePercent, "wastePercent"));
  check("joistSpacingM", () => requirePositive(input.joistSpacingM, "joistSpacingM"));

  return errors;
}
