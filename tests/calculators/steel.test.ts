import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeHaWeight, haUnitWeightKgPerM, HA_DIAMETERS_MM, collectHaWeightFieldErrors } from "../../src/lib/calculators/steel";
import { CalculationError } from "../../src/lib/calculators/validation";

describe("haUnitWeightKgPerM", () => {
  test("matches the standard published HA linear-mass table", () => {
    const expected: Record<number, number> = {
      6: 0.222,
      8: 0.395,
      10: 0.617,
      12: 0.888,
      14: 1.209,
      16: 1.58,
      20: 2.468,
      25: 3.856,
      32: 6.318,
      40: 9.872,
    };
    for (const d of HA_DIAMETERS_MM) {
      assert.ok(Math.abs(haUnitWeightKgPerM(d) - expected[d]) < 5e-3, `HA${d} mismatch`);
    }
  });
});

describe("computeHaWeight", () => {
  test("different diameters produce different unit weights for the same length/quantity", () => {
    const ha10 = computeHaWeight({ diameterMm: 10, lengthM: 1, quantity: 1 });
    const ha20 = computeHaWeight({ diameterMm: 20, lengthM: 1, quantity: 1 });
    assert.ok(ha20.unitWeightKgPerM > ha10.unitWeightKgPerM);
    assert.ok(Math.abs(ha10.unitWeightKgPerM - 0.617) < 1e-3);
  });

  test("different lengths scale the total weight linearly", () => {
    const short = computeHaWeight({ diameterMm: 12, lengthM: 2, quantity: 1 });
    const long = computeHaWeight({ diameterMm: 12, lengthM: 6, quantity: 1 });
    assert.ok(Math.abs(long.totalWeightKg - short.totalWeightKg * 3) < 1e-9);
  });

  test("different quantities scale the total weight linearly", () => {
    const one = computeHaWeight({ diameterMm: 12, lengthM: 6, quantity: 1 });
    const ten = computeHaWeight({ diameterMm: 12, lengthM: 6, quantity: 10 });
    assert.ok(Math.abs(ten.totalWeightKg - one.totalWeightKg * 10) < 1e-9);
  });

  test("decimal lengths are handled correctly", () => {
    const result = computeHaWeight({ diameterMm: 16, lengthM: 5.75, quantity: 3 });
    const expectedUnit = 16 * 16 * 0.00617;
    assert.ok(Math.abs(result.totalWeightKg - expectedUnit * 5.75 * 3) < 1e-9);
  });

  test("zero quantity or zero length is handled safely (zero weight, no throw)", () => {
    assert.equal(computeHaWeight({ diameterMm: 12, lengthM: 0, quantity: 5 }).totalWeightKg, 0);
    assert.equal(computeHaWeight({ diameterMm: 12, lengthM: 6, quantity: 0 }).totalWeightKg, 0);
  });

  test("negative values are rejected", () => {
    assert.throws(
      () => computeHaWeight({ diameterMm: -12, lengthM: 6, quantity: 1 }),
      (err: unknown) => err instanceof CalculationError && err.code === "negative",
    );
    assert.throws(
      () => computeHaWeight({ diameterMm: 12, lengthM: -6, quantity: 1 }),
      (err: unknown) => err instanceof CalculationError && err.code === "negative",
    );
    assert.throws(
      () => computeHaWeight({ diameterMm: 12, lengthM: 6, quantity: -1 }),
      (err: unknown) => err instanceof CalculationError && err.code === "negative",
    );
  });

  test("a fractional bar count is rejected (bars are a whole-number quantity)", () => {
    assert.throws(
      () => computeHaWeight({ diameterMm: 12, lengthM: 6, quantity: 2.5 }),
      (err: unknown) => err instanceof CalculationError && err.code === "not-integer",
    );
  });

  test("missing values are rejected as required", () => {
    assert.throws(
      () => computeHaWeight({ diameterMm: null, lengthM: 6, quantity: 1 }),
      (err: unknown) => err instanceof CalculationError && err.code === "required",
    );
  });
});

describe("collectHaWeightFieldErrors (per-input validation messages)", () => {
  test("every required input is reported when empty", () => {
    assert.deepEqual(collectHaWeightFieldErrors({}), {
      diameterMm: "required",
      lengthM: "required",
      quantity: "required",
    });
  });

  test("a filled field clears its own message while the others keep theirs", () => {
    const errors = collectHaWeightFieldErrors({ diameterMm: 12 });
    assert.equal(errors.diameterMm, undefined);
    assert.equal(errors.lengthM, "required");
    assert.equal(errors.quantity, "required");
  });

  test("no message at all once every required input is valid", () => {
    assert.deepEqual(collectHaWeightFieldErrors({ diameterMm: 12, lengthM: 6, quantity: 4 }), {});
  });

  test("each invalid value is flagged on its own field with its own code", () => {
    assert.deepEqual(collectHaWeightFieldErrors({ diameterMm: 12, lengthM: -2, quantity: 4.5 }), {
      lengthM: "negative",
      quantity: "not-integer",
    });
    assert.deepEqual(collectHaWeightFieldErrors({ diameterMm: 12, lengthM: Number.NaN, quantity: 4 }), {
      lengthM: "invalid",
    });
  });

  test("the flagged fields are exactly the ones the calculation would reject", () => {
    const input = { diameterMm: 12, lengthM: 6, quantity: null };
    assert.deepEqual(Object.keys(collectHaWeightFieldErrors(input)), ["quantity"]);
    assert.throws(() => computeHaWeight(input));
    assert.deepEqual(collectHaWeightFieldErrors({ ...input, quantity: 4 }), {});
    assert.ok(computeHaWeight({ ...input, quantity: 4 }).totalWeightKg > 0);
  });
});
