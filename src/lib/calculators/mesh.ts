/**
 * Treillis soudé (welded mesh) calculator.
 *
 * Functional reference: https://www.concretedispatch.eu/blog/calculatrice-beton/
 * The reference exposes a mesh-type dropdown, a surface field and an overlap
 * ("recouvrement": aucun / 1 maille / 2 maille) field, and reports the number
 * of panels, panel dimensions, total weight and mesh size - but, like the rest
 * of the site, computes everything client-side without exposing its internal
 * panel/weight table in the static page.
 *
 * The specifications below come from published French welded-mesh standards
 * (ADETS/AFNOR NF A35-016 panel format, manufacturer datasheets such as
 * Point.P, Chausson, CODIP, Houdard, Queguiner, Balitrand). Two kinds of
 * figures are used:
 *  - "published": the panel weight is stated directly by manufacturers and
 *    cross-checked against at least one independent source.
 *  - "derived": only the wire diameter(s) and mesh spacing are published, so
 *    the panel weight is computed with the same standard rebar linear-mass
 *    formula used for the Poids HA calculator. This derivation was validated
 *    against every "published" entry below (all within ~1% of the
 *    manufacturer-stated weight), which is why it is trusted for the
 *    remaining types.
 *
 * Some mesh names shown by the reference (e.g. antifissuration variants named
 * "RPAF"/"VPAF") could not be matched to a documented product spec and are
 * intentionally left out rather than guessed - see the project report.
 */

import { requireNonNegative } from "./validation";
import { REBAR_LINEAR_MASS_COEFFICIENT } from "./steel";

export type MeshCategory = "structural" | "antifissuration";
export type MeshSourceConfidence = "published" | "derived";

export interface MeshTypeSpec {
  id: string;
  category: MeshCategory;
  /** Maille (mm): [smaller spacing, larger spacing]. Equal for square meshes. */
  meshSpacingMm: [number, number];
  panelLengthM: number;
  panelWidthM: number;
  /** Total weight (kg) of one full standard panel. */
  panelWeightKg: number;
  sourceConfidence: MeshSourceConfidence;
}

function linearMassKgPerM(diameterMm: number): number {
  return diameterMm * diameterMm * REBAR_LINEAR_MASS_COEFFICIENT;
}

/** Weight (kg/m²) of a mesh from its two wire diameters and two spacings (mm). */
function meshWeightPerM2(spacingAMm: number, diameterAMm: number, spacingBMm: number, diameterBMm: number): number {
  return (1000 / spacingBMm) * linearMassKgPerM(diameterAMm) + (1000 / spacingAMm) * linearMassKgPerM(diameterBMm);
}

function panel(
  id: string,
  category: MeshCategory,
  spacing: [number, number],
  panelLengthM: number,
  panelWidthM: number,
  panelWeightKg: number,
  sourceConfidence: MeshSourceConfidence,
): MeshTypeSpec {
  return { id, category, meshSpacingMm: spacing, panelLengthM, panelWidthM, panelWeightKg, sourceConfidence };
}

const area = (l: number, w: number) => l * w;

export const MESH_TYPES: MeshTypeSpec[] = [
  // Structural welded mesh ("treillis de structure")
  panel("ST10", "structural", [200, 200], 4.8, 2.4, area(4.8, 2.4) * meshWeightPerM2(200, 5.5, 200, 5.5), "derived"),
  panel("ST15", "structural", [200, 200], 4.0, 2.4, area(4.0, 2.4) * meshWeightPerM2(200, 6, 200, 6), "derived"),
  panel("ST20", "structural", [150, 300], 6.0, 2.4, 35.81, "published"),
  panel("ST25", "structural", [150, 300], 6.0, 2.4, 43.49, "published"),
  panel("ST25C", "structural", [150, 150], 6.0, 2.4, 57.98, "published"),
  panel("ST35", "structural", [100, 300], 6.0, 2.4, area(6.0, 2.4) * meshWeightPerM2(300, 7, 100, 7), "derived"),
  panel("ST50", "structural", [100, 300], 6.0, 2.4, 75.88, "published"),
  panel("ST50C", "structural", [100, 100], 6.0, 2.4, area(6.0, 2.4) * meshWeightPerM2(100, 8, 100, 8), "derived"),
  panel("ST60", "structural", [100, 250], 6.0, 2.4, area(6.0, 2.4) * meshWeightPerM2(250, 9, 100, 9), "derived"),
  panel("ST65C", "structural", [100, 100], 6.0, 2.4, area(6.0, 2.4) * meshWeightPerM2(100, 9, 100, 9), "derived"),
  // Antifissuration mesh ("panneaux antifissuration")
  panel("PAF10", "antifissuration", [200, 200], 4.2, 2.4, 18.85, "published"),
  panel("PAFC", "antifissuration", [200, 200], 3.6, 2.4, 10.8, "published"),
  panel("PAFR", "antifissuration", [200, 300], 3.6, 2.4, 9.0, "published"),
];

export function getMeshType(id: string): MeshTypeSpec | undefined {
  return MESH_TYPES.find((m) => m.id === id);
}

export type MeshOverlap = "none" | "1" | "2";

export interface MeshPanelsInput {
  meshTypeId: string;
  /** Surface (m²) to cover. */
  surfaceM2?: number | null;
  /** Recouvrement: aucun / 1 maille / 2 maille. */
  overlap: MeshOverlap;
}

export interface MeshPanelsResult {
  panelCount: number;
  panelLengthM: number;
  panelWidthM: number;
  meshSpacingMm: [number, number];
  totalWeightKg: number;
}

const OVERLAP_MESH_COUNT: Record<MeshOverlap, number> = { none: 0, "1": 1, "2": 2 };

export function computeMeshPanels(input: MeshPanelsInput): MeshPanelsResult {
  const spec = getMeshType(input.meshTypeId);
  if (!spec) {
    throw new RangeError(`Unknown mesh type: ${input.meshTypeId}`);
  }

  const surfaceM2 = requireNonNegative(input.surfaceM2, "surfaceM2");

  // Overlap is expressed in number of mesh squares; use the smaller of the two
  // spacings (always listed first) as "1 maille", which matches how suppliers
  // quote overlap for both square and rectangular meshes.
  const overlapCount = OVERLAP_MESH_COUNT[input.overlap];
  const overlapM = (overlapCount * spec.meshSpacingMm[0]) / 1000;

  // Panels are assumed to be laid in parallel strips along their length, each
  // subsequent strip overlapping the previous one along its width. This is a
  // standard simplified estimation method for a basic calculator; an exact
  // layout for an irregular slab should still be confirmed by a structural
  // engineer or site drawing.
  const effectiveWidthM = spec.panelWidthM - overlapM;
  if (effectiveWidthM <= 0) {
    throw new RangeError("Overlap is larger than the panel width for this mesh type.");
  }

  const netCoveragePerPanelM2 = spec.panelLengthM * effectiveWidthM;
  // Subtract a tiny epsilon before rounding up so floating-point noise (e.g.
  // 6 * 2.4 landing on 14.399999999999999 instead of 14.4) never pushes an
  // exact-fit surface into requiring one extra panel.
  const panelCount = surfaceM2 === 0 ? 0 : Math.ceil(surfaceM2 / netCoveragePerPanelM2 - 1e-9);
  const totalWeightKg = panelCount * spec.panelWeightKg;

  return {
    panelCount,
    panelLengthM: spec.panelLengthM,
    panelWidthM: spec.panelWidthM,
    meshSpacingMm: spec.meshSpacingMm,
    totalWeightKg,
  };
}
