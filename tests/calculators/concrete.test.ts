import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeConcreteVolume,
  computeConcreteDosage,
  cementBagsFromKg,
  collectConcreteVolumeFieldErrors,
  CEMENT_BAG_KG,
  CONCRETE_ELEMENT_FIELDS,
  CONCRETE_ELEMENT_TYPES,
} from "../../src/lib/calculators/concrete";
import { CalculationError } from "../../src/lib/calculators/validation";

describe("computeConcreteVolume", () => {
  test("normal rectangular slab (dalle) matches the worked example", () => {
    // Longueur 10 m, Largeur 5 m, Épaisseur 20 cm -> Surface 50 m2, Volume 10 m3
    const result = computeConcreteVolume({
      elementType: "dalle",
      length: 10,
      width: 5,
      thicknessCm: 20,
    });
    assert.equal(result.surfaceM2, 50);
    assert.equal(result.volumeM3, 10);
  });

  test("wall (voile): Surface = Longueur x Hauteur, Volume applies the epaisseur", () => {
    // Client semantics: a voile is Longueur (m) x Hauteur (m) x Epaisseur (cm),
    // the second metre input is the HEIGHT of the wall, not its width.
    const result = computeConcreteVolume({
      elementType: "voile",
      length: 4, // Longueur 4 m
      width: 2.5, // Hauteur 2.5 m
      thicknessCm: 15, // Epaisseur 15 cm
    });
    assert.equal(result.surfaceM2, 10);
    assert.equal(result.volumeM3, 1.5);
  });

  test("rectangular column: Surface = Hauteur x Longueur (client worked example)", () => {
    // Client screenshot: Hauteur 1 m, Longueur 3 m, Largeur 200 cm
    // -> Surface = 1 x 3 = 3 m2, Volume = 3 x 2 = 6 m3.
    const result = computeConcreteVolume({
      elementType: "poteau_rectangulaire",
      length: 1, // Hauteur (m)
      width: 3, // Longueur (m)
      thicknessCm: 200, // Largeur (cm) -> 2 m
    });
    assert.equal(result.surfaceM2, 3);
    assert.equal(result.volumeM3, 6);
    assert.equal(result.surfaceM2.toFixed(2), "3.00");
    assert.equal(result.volumeM3.toFixed(2), "6.00");
  });

  test("rectangular column: surface never uses the centimetre dimension (Largeur)", () => {
    // Hauteur 2 m, Longueur 4 m, Largeur 30 cm -> Surface must stay 8 m2
    // (Hauteur x Longueur), not 2 x 0.3 or 4 x 0.3.
    const result = computeConcreteVolume({
      elementType: "poteau_rectangulaire",
      length: 2,
      width: 4,
      thicknessCm: 30,
    });
    assert.equal(result.surfaceM2, 8);
    assert.ok(Math.abs(result.volumeM3 - 2.4) < 1e-9);
  });

  test("round column (poteau rond) uses circular geometry, not the rectangular formula", () => {
    const result = computeConcreteVolume({
      elementType: "poteau_rond",
      diameterCm: 40,
      heightM: 3,
    });
    const expectedSurface = Math.PI * 0.2 * 0.2; // r = 0.2 m
    const expectedVolume = expectedSurface * 3;
    assert.ok(Math.abs(result.surfaceM2 - expectedSurface) < 1e-9);
    assert.ok(Math.abs(result.volumeM3 - expectedVolume) < 1e-9);
    // Sanity check it did NOT fall back to length*width rectangular geometry.
    assert.notEqual(result.surfaceM2, 40 * 3);
  });

  test("zero values are handled safely (no throw, zero result)", () => {
    const dalle = computeConcreteVolume({ elementType: "dalle", length: 0, width: 0, thicknessCm: 0 });
    assert.equal(dalle.surfaceM2, 0);
    assert.equal(dalle.volumeM3, 0);

    const round = computeConcreteVolume({ elementType: "poteau_rond", diameterCm: 0, heightM: 0 });
    assert.equal(round.surfaceM2, 0);
    assert.equal(round.volumeM3, 0);
  });

  test("negative values are rejected", () => {
    assert.throws(
      () => computeConcreteVolume({ elementType: "dalle", length: -1, width: 5, thicknessCm: 20 }),
      (err: unknown) => err instanceof CalculationError && err.code === "negative",
    );
    assert.throws(
      () => computeConcreteVolume({ elementType: "poteau_rond", diameterCm: -10, heightM: 2 }),
      (err: unknown) => err instanceof CalculationError && err.code === "negative",
    );
  });

  test("missing values are rejected as required, not coerced to 0/NaN", () => {
    assert.throws(
      () => computeConcreteVolume({ elementType: "dalle", length: null, width: 5, thicknessCm: 20 }),
      (err: unknown) => err instanceof CalculationError && err.code === "required",
    );
  });

  test("infinite / NaN inputs are rejected instead of producing NaN or Infinity results", () => {
    assert.throws(
      () => computeConcreteVolume({ elementType: "voile", length: Number.NaN, width: 2, thicknessCm: 20 }),
      (err: unknown) => err instanceof CalculationError && err.code === "invalid",
    );
    assert.throws(
      () =>
        computeConcreteVolume({
          elementType: "poteau_rectangulaire",
          length: 1,
          width: Number.POSITIVE_INFINITY,
          thicknessCm: 200,
        }),
      (err: unknown) => err instanceof CalculationError && err.code === "invalid",
    );
    assert.throws(
      () => computeConcreteVolume({ elementType: "poteau_rond", diameterCm: 40, heightM: Number.NaN }),
      (err: unknown) => err instanceof CalculationError && err.code === "invalid",
    );
  });

  test("decimal values are handled at full precision", () => {
    const result = computeConcreteVolume({
      elementType: "dalle",
      length: 3.5,
      width: 2.25,
      thicknessCm: 12.5,
    });
    assert.ok(Math.abs(result.surfaceM2 - 7.875) < 1e-9);
    assert.ok(Math.abs(result.volumeM3 - 0.984375) < 1e-9);
  });
});

describe("computeConcreteDosage", () => {
  test("each supported dosage tier for 1 m3", () => {
    for (const dosage of [200, 300, 350] as const) {
      const result = computeConcreteDosage({ dosageKgM3: dosage, volumeM3: 1 });
      assert.equal(result.cementKg, dosage);
      assert.equal(result.waterL, dosage * 0.5);
      assert.equal(result.sandKg, 800);
      assert.equal(result.gravelKg, 1200);
    }
  });

  test("the cement result is also expressed in 25 kg bags (client example)", () => {
    // 350 kg/m3 x 10 m3 = 3500 kg of cement -> 3500 / 25 = 140 bags.
    const result = computeConcreteDosage({ dosageKgM3: 350, volumeM3: 10 });
    assert.equal(result.cementKg, 3500);
    assert.equal(result.cementBags25kg, 140);
    // The kg figures themselves are untouched by the bag reading.
    assert.equal(result.waterL, 1750);
    assert.equal(result.sandKg, 8000);
    assert.equal(result.gravelKg, 12000);
  });

  test("scales linearly with different volumes", () => {
    const result = computeConcreteDosage({ dosageKgM3: 350, volumeM3: 2.5 });
    assert.equal(result.cementKg, 875);
    assert.equal(result.waterL, 437.5);
    assert.equal(result.sandKg, 2000);
    assert.equal(result.gravelKg, 3000);
  });

  test("zero volume is handled safely", () => {
    const result = computeConcreteDosage({ dosageKgM3: 300, volumeM3: 0 });
    assert.equal(result.cementKg, 0);
    assert.equal(result.sandKg, 0);
    assert.equal(result.gravelKg, 0);
    assert.equal(result.waterL, 0);
  });

  test("negative volume is rejected", () => {
    assert.throws(
      () => computeConcreteDosage({ dosageKgM3: 300, volumeM3: -5 }),
      (err: unknown) => err instanceof CalculationError && err.code === "negative",
    );
  });

  test("invalid (missing) volume is rejected", () => {
    assert.throws(
      () => computeConcreteDosage({ dosageKgM3: 300, volumeM3: null }),
      (err: unknown) => err instanceof CalculationError && err.code === "required",
    );
    assert.throws(
      () => computeConcreteDosage({ dosageKgM3: 300, volumeM3: NaN }),
      (err: unknown) => err instanceof CalculationError && err.code === "invalid",
    );
  });
});

describe("CONCRETE_ELEMENT_FIELDS (dynamic input labels)", () => {
  test("every element type declares its inputs", () => {
    for (const type of CONCRETE_ELEMENT_TYPES) {
      assert.ok(CONCRETE_ELEMENT_FIELDS[type].length > 0, `${type} should declare inputs`);
    }
  });

  test("labels follow the client's expected semantics for each element", () => {
    assert.deepEqual(
      CONCRETE_ELEMENT_FIELDS.dalle.map((f) => f.labelKey),
      ["concreteLengthLabel", "concreteWidthLabel", "concreteThicknessLabel"],
    );
    // Voile: Longueur / Hauteur / Epaisseur - never "Largeur".
    assert.deepEqual(
      CONCRETE_ELEMENT_FIELDS.voile.map((f) => f.labelKey),
      ["concreteLengthLabel", "concreteHeightLabel", "concreteThicknessLabel"],
    );
    assert.ok(!CONCRETE_ELEMENT_FIELDS.voile.some((f) => f.labelKey === "concreteWidthLabel"));
    // Poteau rectangulaire: Hauteur / Longueur / Largeur (cm).
    assert.deepEqual(
      CONCRETE_ELEMENT_FIELDS.poteau_rectangulaire.map((f) => f.labelKey),
      ["concreteHeightLabel", "concreteLengthLabel", "concreteColumnWidthCmLabel"],
    );
    // Poteau rond: Hauteur / Diametre only.
    assert.deepEqual(
      CONCRETE_ELEMENT_FIELDS.poteau_rond.map((f) => f.labelKey),
      ["concreteRoundHeightLabel", "concreteDiameterLabel"],
    );
  });

  test("the two dimensions multiplied into Surface are the two first labels shown", () => {
    for (const type of ["dalle", "voile", "poteau_rectangulaire"] as const) {
      const fields = CONCRETE_ELEMENT_FIELDS[type];
      assert.deepEqual(
        fields.map((f) => f.field),
        ["length", "width", "thicknessCm"],
        `${type} should feed the two metre slots first`,
      );
      assert.deepEqual(
        fields.map((f) => f.unit),
        ["m", "m", "cm"],
        `${type} should express its third dimension in cm`,
      );
    }
  });

  test("no element declares extra inputs beyond its geometry", () => {
    assert.equal(CONCRETE_ELEMENT_FIELDS.dalle.length, 3);
    assert.equal(CONCRETE_ELEMENT_FIELDS.voile.length, 3);
    assert.equal(CONCRETE_ELEMENT_FIELDS.poteau_rectangulaire.length, 3);
    assert.equal(CONCRETE_ELEMENT_FIELDS.poteau_rond.length, 2);
  });
});

describe("cementBagsFromKg", () => {
  test("a 25 kg bag is the reference unit", () => {
    assert.equal(CEMENT_BAG_KG, 25);
  });

  test("the client's example: 3500 kg of cement reads as 140 bags", () => {
    assert.equal(cementBagsFromKg(3500), 140);
    assert.equal(cementBagsFromKg(25), 1);
    assert.equal(cementBagsFromKg(350), 14);
  });

  test("the division is exact - no rounding rule is applied", () => {
    assert.equal(cementBagsFromKg(3510), 140.4);
    assert.equal(cementBagsFromKg(26), 1.04);
    assert.equal(cementBagsFromKg(10), 0.4);
  });

  test("zero cement means zero bags", () => {
    assert.equal(cementBagsFromKg(0), 0);
    assert.equal(computeConcreteDosage({ dosageKgM3: 300, volumeM3: 0 }).cementBags25kg, 0);
  });

  test("the bag count always follows the calculated cement mass", () => {
    for (const dosage of [200, 300, 350] as const) {
      for (const volumeM3 of [0.5, 1, 2.5, 7.3]) {
        const result = computeConcreteDosage({ dosageKgM3: dosage, volumeM3 });
        assert.equal(result.cementBags25kg, result.cementKg / 25);
      }
    }
  });
});

describe("collectConcreteVolumeFieldErrors (per-input validation messages)", () => {
  test("every required input of the selected element is reported when empty", () => {
    assert.deepEqual(collectConcreteVolumeFieldErrors("poteau_rectangulaire", {}), {
      length: "required",
      width: "required",
      thicknessCm: "required",
    });
    assert.deepEqual(collectConcreteVolumeFieldErrors("voile", {}), {
      length: "required",
      width: "required",
      thicknessCm: "required",
    });
    assert.deepEqual(collectConcreteVolumeFieldErrors("poteau_rond", {}), {
      heightM: "required",
      diameterCm: "required",
    });
  });

  test("only the inputs the selected element displays are validated", () => {
    // A dalle never asks for a diameter, so a missing diameter is not an error.
    const errors = collectConcreteVolumeFieldErrors("dalle", { length: 3, width: 2, thicknessCm: 20 });
    assert.deepEqual(errors, {});

    // A poteau rond never asks for length/width/thickness.
    const roundErrors = collectConcreteVolumeFieldErrors("poteau_rond", { heightM: 3, diameterCm: 40 });
    assert.deepEqual(roundErrors, {});
    assert.equal("length" in roundErrors, false);
    assert.equal("thicknessCm" in roundErrors, false);
  });

  test("a filled field clears its own message while the others keep theirs", () => {
    const errors = collectConcreteVolumeFieldErrors("poteau_rectangulaire", { length: 1 });
    assert.equal(errors.length, undefined);
    assert.equal(errors.width, "required");
    assert.equal(errors.thicknessCm, "required");
  });

  test("zero is accepted, negative and non-finite values are flagged on their own field", () => {
    assert.deepEqual(collectConcreteVolumeFieldErrors("dalle", { length: 0, width: 0, thicknessCm: 0 }), {});
    assert.deepEqual(
      collectConcreteVolumeFieldErrors("dalle", { length: -1, width: 2, thicknessCm: Number.NaN }),
      { length: "negative", thicknessCm: "invalid" },
    );
  });

  test("the flagged fields are exactly the ones the calculation would reject", () => {
    const values = { length: 2, width: null, thicknessCm: 20 };
    const errors = collectConcreteVolumeFieldErrors("voile", values);
    assert.deepEqual(Object.keys(errors), ["width"]);
    assert.throws(() => computeConcreteVolume({ elementType: "voile", ...values }));
    // ...and no error at all once that field is filled.
    assert.deepEqual(collectConcreteVolumeFieldErrors("voile", { ...values, width: 2.5 }), {});
    assert.equal(computeConcreteVolume({ elementType: "voile", ...values, width: 2.5 }).volumeM3, 1);
  });
});
