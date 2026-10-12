import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeFormwork,
  collectFormworkFieldErrors,
  panelAreaM2,
  getFormworkPanelSize,
  FORMWORK_PANEL_SIZES,
  FORMWORK_TYPE_FIELDS,
  FORMWORK_FOUNDATION_TYPES,
  DEFAULT_FORMWORK_PANEL_ID,
  type FormworkInput,
  FEET_PER_METER,
  metersToFeet,
  feetToMeters,
  squareMetersToSquareFeet,
  squareFeetToSquareMeters,
  lengthToMeters,
  lengthFromMeters,
  areaFromSquareMeters,
  FORMWORK_UNIT_SYMBOLS,
} from "../../src/lib/calculators/formwork";
import { CalculationError } from "../../src/lib/calculators/validation";

/**
 * Expected values come from the client's reference calculator
 * (https://pinmy.co/fr/formwork-calculator/), read in a real browser with the
 * same query parameters. Each case notes the reference reading it reproduces.
 */

const CLIENT_EXAMPLE: FormworkInput = {
  type: "pile",
  lengthM: 6, // L
  widthM: 4, // W
  heightM: 0.5, // Hb
  thicknessM: 0.4, // Tb
  wastePercent: 10,
  joistSpacingM: 0.5,
  panelId: "1220x2440",
  plotCount: 4,
};

describe("computeFormwork - the client's example (type=pile)", () => {
  test("reproduces the reference: 18.4 m2, 7 panels, 36.8 m of timber", () => {
    const result = computeFormwork(CLIENT_EXAMPLE);
    // Reference: SURFACE DE COFFRAGE 18.4 m²
    assert.equal(result.contactAreaM2, 18.4);
    // Lnet = 2(6) + 2(4 - 0.8) = 18.4 m
    assert.equal(result.netLengthM, 18.4);
    // Reference: PANNEAUX DE CONTREPLAQUÉ 7
    assert.equal(result.panelCount, 7);
    // Reference: LONGUEUR DE BOIS 36.8 m
    assert.equal(result.timberLengthM, 36.8);
  });

  test("the three figures as the reference displays them", () => {
    const r = computeFormwork(CLIENT_EXAMPLE);
    assert.equal(Number(r.contactAreaM2.toFixed(2)), 18.4);
    assert.equal(r.panelCount, 7);
    assert.equal(Number(r.timberLengthM.toFixed(1)), 36.8);
  });
});

describe("computeFormwork - formula per foundation type", () => {
  test("dalle monolithique: A = 2(L + W) x H (reference: 6 m2 for 6 x 4 x 0.3)", () => {
    const r = computeFormwork({ ...CLIENT_EXAMPLE, type: "slab", heightM: 0.3, thicknessM: null });
    assert.equal(r.contactAreaM2, 6);
    assert.equal(r.netLengthM, null);
    // Reference note for this case: "Commander ≈ 3 panneaux"
    assert.equal(r.panelCount, 3);
    // Reference: LONGUEUR DE BOIS 12 m
    assert.equal(r.timberLengthM, 12);
  });

  test("plot: A = 2(Acol + Bcol) x H x N (reference defaults 0.4/0.4/0.3, N=4 -> 1.92 m2, 1 panel, 3.8 m)", () => {
    const r = computeFormwork({
      ...CLIENT_EXAMPLE,
      type: "column",
      widthM: 0.4, // Largeur du plot (Acol)
      lengthM: 0.4, // Longueur du plot (Bcol)
      heightM: 0.3, // Hauteur du plot
      plotCount: 4, // Nombre de plots
      thicknessM: null,
    });
    // Reference: SURFACE DE COFFRAGE 1.92 m2
    assert.equal(Number(r.contactAreaM2.toFixed(10)), 1.92);
    assert.equal(r.netLengthM, null);
    // Reference: PANNEAUX 1, LONGUEUR DE BOIS 3.8 m
    assert.equal(r.panelCount, 1);
    assert.equal(Number(r.timberLengthM.toFixed(1)), 3.8);
  });

  test("plot: the area scales with the number of plots", () => {
    const one = computeFormwork({
      ...CLIENT_EXAMPLE, type: "column", widthM: 0.4, lengthM: 0.4, heightM: 0.3, plotCount: 1, thicknessM: null,
    });
    const four = computeFormwork({
      ...CLIENT_EXAMPLE, type: "column", widthM: 0.4, lengthM: 0.4, heightM: 0.3, plotCount: 4, thicknessM: null,
    });
    assert.equal(Number(one.contactAreaM2.toFixed(10)), 0.48);
    assert.equal(Number(four.contactAreaM2.toFixed(10)), 1.92);
    assert.equal(Number((one.contactAreaM2 * 4).toFixed(10)), Number(four.contactAreaM2.toFixed(10)));
  });

  test("plot: the number of plots must be a whole number and is required", () => {
    assert.throws(
      () => computeFormwork({ ...CLIENT_EXAMPLE, type: "column", widthM: 0.4, lengthM: 0.4, heightM: 0.3, plotCount: 2.5 }),
      (err: unknown) => err instanceof CalculationError && err.code === "not-integer" && err.field === "plotCount",
    );
    assert.throws(
      () => computeFormwork({ ...CLIENT_EXAMPLE, type: "column", widthM: 0.4, lengthM: 0.4, heightM: 0.3, plotCount: null }),
      (err: unknown) => err instanceof CalculationError && err.code === "required" && err.field === "plotCount",
    );
  });

  test("plot never uses the dalle formula: 2(L + W) x H would give 0.48, not 1.92", () => {
    const plot = computeFormwork({
      ...CLIENT_EXAMPLE, type: "column", widthM: 0.4, lengthM: 0.4, heightM: 0.3, plotCount: 4, thicknessM: null,
    });
    const slab = computeFormwork({
      ...CLIENT_EXAMPLE, type: "slab", widthM: 0.4, lengthM: 0.4, heightM: 0.3, thicknessM: null,
    });
    assert.equal(Number(slab.contactAreaM2.toFixed(10)), 0.48);
    assert.notEqual(Number(plot.contactAreaM2.toFixed(10)), Number(slab.contactAreaM2.toFixed(10)));
  });

  test("semelle filante: Lnet = 2L + 2(W - 2T), A = 2 x Lnet x H (reference: 29.44 m2, 11 panels, 58.9 m)", () => {
    const r = computeFormwork({ ...CLIENT_EXAMPLE, type: "strip", heightM: 0.8, thicknessM: 0.4 });
    assert.equal(r.netLengthM, 18.4);
    // 2 x 18.4 x 0.8 is 29.439999999999998 in IEEE 754; the reference shows 29.44.
    assert.equal(Number(r.contactAreaM2.toFixed(2)), 29.44);
    assert.equal(r.panelCount, 11);
    assert.equal(Number(r.timberLengthM.toFixed(1)), 58.9);
  });

  test("semelle filante with the reference defaults 6/4/0.3/0.4 (reference: 11.04 m2, 5 panels, 22.1 m)", () => {
    const r = computeFormwork({ ...CLIENT_EXAMPLE, type: "strip", heightM: 0.3, thicknessM: 0.4 });
    assert.equal(r.netLengthM, 18.4);
    assert.equal(Number(r.contactAreaM2.toFixed(10)), 11.04);
    assert.equal(r.panelCount, 5);
    assert.equal(Number(r.timberLengthM.toFixed(1)), 22.1);
  });

  test("pieu + longrine with Hb = 0.8 (reference: 29.44 m2, 11 panels, 58.9 m)", () => {
    const r = computeFormwork({ ...CLIENT_EXAMPLE, heightM: 0.8 });
    assert.equal(Number(r.contactAreaM2.toFixed(2)), 29.44);
    assert.equal(r.panelCount, 11);
    assert.equal(Number(r.timberLengthM.toFixed(1)), 58.9);
  });
});

describe("computeFormwork - waste applies to the panel count only", () => {
  test("waste 0 / 10 / 50 leave the area and the timber untouched", () => {
    for (const wastePercent of [0, 10, 50]) {
      const r = computeFormwork({ ...CLIENT_EXAMPLE, wastePercent });
      assert.equal(r.contactAreaM2, 18.4, `area must not depend on waste (${wastePercent}%)`);
      assert.equal(r.timberLengthM, 36.8, `timber must not depend on waste (${wastePercent}%)`);
    }
  });

  test("panel count follows the waste (reference: 10% -> 7 panels, 50% -> 10 panels)", () => {
    assert.equal(computeFormwork({ ...CLIENT_EXAMPLE, wastePercent: 0 }).panelCount, 7);
    assert.equal(computeFormwork({ ...CLIENT_EXAMPLE, wastePercent: 10 }).panelCount, 7);
    assert.equal(computeFormwork({ ...CLIENT_EXAMPLE, wastePercent: 50 }).panelCount, 10);
  });
});

describe("computeFormwork - panel size", () => {
  test("areas come from the millimetre dimensions", () => {
    assert.equal(panelAreaM2({ id: "1220x2440", widthMm: 1220, lengthMm: 2440 }), 2.9768);
    assert.equal(panelAreaM2({ id: "1500x3000", widthMm: 1500, lengthMm: 3000 }), 4.5);
    assert.equal(panelAreaM2({ id: "1220x1220", widthMm: 1220, lengthMm: 1220 }), 1.4884);
  });

  test("the client's example on each panel size (reference: 7, 5 and 14 panels)", () => {
    assert.equal(computeFormwork({ ...CLIENT_EXAMPLE, panelId: "1220x2440" }).panelCount, 7);
    assert.equal(computeFormwork({ ...CLIENT_EXAMPLE, panelId: "1500x3000" }).panelCount, 5);
    assert.equal(computeFormwork({ ...CLIENT_EXAMPLE, panelId: "1220x1220" }).panelCount, 14);
  });

  test("an unknown panel id is rejected", () => {
    assert.throws(
      () => computeFormwork({ ...CLIENT_EXAMPLE, panelId: "nope" }),
      (err: unknown) => err instanceof CalculationError && err.field === "panelId",
    );
  });

  test("the default panel is one of the offered sizes", () => {
    assert.ok(getFormworkPanelSize(DEFAULT_FORMWORK_PANEL_ID));
    assert.equal(FORMWORK_PANEL_SIZES.length, 3);
  });
});

describe("computeFormwork - joist spacing", () => {
  test("timber = area / spacing (reference: spacing 0.25 -> 73.6 m)", () => {
    assert.equal(computeFormwork({ ...CLIENT_EXAMPLE, joistSpacingM: 0.25 }).timberLengthM, 73.6);
    assert.equal(computeFormwork({ ...CLIENT_EXAMPLE, joistSpacingM: 0.5 }).timberLengthM, 36.8);
  });

  test("spacing never changes the area or the panel count", () => {
    const tight = computeFormwork({ ...CLIENT_EXAMPLE, joistSpacingM: 0.25 });
    const loose = computeFormwork({ ...CLIENT_EXAMPLE, joistSpacingM: 0.5 });
    assert.equal(tight.contactAreaM2, loose.contactAreaM2);
    assert.equal(tight.panelCount, loose.panelCount);
  });

  test("a spacing of zero is rejected instead of dividing by zero", () => {
    assert.throws(
      () => computeFormwork({ ...CLIENT_EXAMPLE, joistSpacingM: 0 }),
      (err: unknown) => err instanceof CalculationError && err.field === "joistSpacingM",
    );
    const r = computeFormwork({ ...CLIENT_EXAMPLE, joistSpacingM: 0.1 });
    assert.ok(Number.isFinite(r.timberLengthM));
  });
});

describe("computeFormwork - edge cases checked against the reference", () => {
  test("W - 2T negative is applied literally, not clamped (reference: 11.4 m2 for W = 0.5)", () => {
    const r = computeFormwork({ ...CLIENT_EXAMPLE, widthM: 0.5 });
    // Lnet = 12 + 2(0.5 - 0.8) = 11.4  ->  A = 2 x 11.4 x 0.5 = 11.4
    assert.equal(Number(r.netLengthM!.toFixed(10)), 11.4);
    assert.equal(Number(r.contactAreaM2.toFixed(10)), 11.4);
    assert.equal(r.panelCount, 5);
    assert.equal(Number(r.timberLengthM.toFixed(1)), 22.8);
  });

  test("zero dimensions give a zero result rather than an error", () => {
    const r = computeFormwork({ ...CLIENT_EXAMPLE, lengthM: 0, widthM: 0, heightM: 0, thicknessM: 0 });
    assert.equal(r.contactAreaM2, 0);
    assert.equal(r.panelCount, 0);
    assert.equal(r.timberLengthM, 0);
  });

  test("negative, missing and non-finite inputs are rejected", () => {
    assert.throws(
      () => computeFormwork({ ...CLIENT_EXAMPLE, lengthM: -1 }),
      (err: unknown) => err instanceof CalculationError && err.code === "negative",
    );
    assert.throws(
      () => computeFormwork({ ...CLIENT_EXAMPLE, heightM: null }),
      (err: unknown) => err instanceof CalculationError && err.code === "required",
    );
    assert.throws(
      () => computeFormwork({ ...CLIENT_EXAMPLE, wastePercent: Number.NaN }),
      (err: unknown) => err instanceof CalculationError && err.code === "invalid",
    );
  });
});

describe("collectFormworkFieldErrors", () => {
  test("only the inputs the selected type displays are validated", () => {
    // A dalle has no thickness field, so a missing thickness is not an error.
    const slab = collectFormworkFieldErrors({
      type: "slab", lengthM: 6, widthM: 4, heightM: 0.3, thicknessM: null,
      wastePercent: 10, joistSpacingM: 0.5, panelId: DEFAULT_FORMWORK_PANEL_ID,
    });
    assert.deepEqual(slab, {});

    // A pieu + longrine does ask for it.
    const pile = collectFormworkFieldErrors({ ...CLIENT_EXAMPLE, thicknessM: null });
    assert.deepEqual(pile, { thicknessM: "required" });
  });

  test("every required input is reported when the form is empty", () => {
    const errors = collectFormworkFieldErrors({
      type: "pile", lengthM: null, widthM: null, heightM: null, thicknessM: null,
      wastePercent: null, joistSpacingM: null, panelId: DEFAULT_FORMWORK_PANEL_ID,
    });
    assert.deepEqual(errors, {
      lengthM: "required", widthM: "required", heightM: "required", thicknessM: "required",
      wastePercent: "required", joistSpacingM: "required",
    });
  });

  test("an empty Plot form reports its own four inputs, including the count", () => {
    const errors = collectFormworkFieldErrors({
      type: "column", lengthM: null, widthM: null, heightM: null, plotCount: null,
      wastePercent: null, joistSpacingM: null, panelId: DEFAULT_FORMWORK_PANEL_ID,
    });
    assert.deepEqual(errors, {
      widthM: "required", lengthM: "required", heightM: "required", plotCount: "required",
      wastePercent: "required", joistSpacingM: "required",
    });
    // no thickness is asked for on a Plot
    assert.equal("thicknessM" in errors, false);
  });

  test("a fractional number of plots is flagged on its own field", () => {
    const errors = collectFormworkFieldErrors({
      type: "column", widthM: 0.4, lengthM: 0.4, heightM: 0.3, plotCount: 2.5,
      wastePercent: 10, joistSpacingM: 0.5, panelId: DEFAULT_FORMWORK_PANEL_ID,
    });
    assert.deepEqual(errors, { plotCount: "not-integer" });
  });

  test("a filled field clears its own message while the others keep theirs", () => {
    const errors = collectFormworkFieldErrors({ ...CLIENT_EXAMPLE, widthM: null, heightM: null });
    assert.equal(errors.lengthM, undefined);
    assert.equal(errors.widthM, "required");
    assert.equal(errors.heightM, "required");
  });

  test("the flagged fields are exactly the ones the calculation rejects", () => {
    const input = { ...CLIENT_EXAMPLE, joistSpacingM: 0 };
    assert.deepEqual(Object.keys(collectFormworkFieldErrors(input)), ["joistSpacingM"]);
    assert.throws(() => computeFormwork(input));
    assert.deepEqual(collectFormworkFieldErrors(CLIENT_EXAMPLE), {});
  });
});

describe("FORMWORK_TYPE_FIELDS", () => {
  test("every type declares the inputs the reference shows for it", () => {
    assert.deepEqual(FORMWORK_TYPE_FIELDS.slab.map((f) => f.field), ["lengthM", "widthM", "heightM"]);
    assert.deepEqual(FORMWORK_TYPE_FIELDS.column.map((f) => f.field), ["widthM", "lengthM", "heightM", "plotCount"]);
    assert.deepEqual(FORMWORK_TYPE_FIELDS.strip.map((f) => f.field), ["lengthM", "widthM", "heightM", "thicknessM"]);
    assert.deepEqual(FORMWORK_TYPE_FIELDS.pile.map((f) => f.field), ["lengthM", "widthM", "heightM", "thicknessM"]);
  });

  test("the Plot labels are the reference own labels, not the dalle ones", () => {
    assert.deepEqual(FORMWORK_TYPE_FIELDS.column.map((f) => f.labelKey), [
      "formworkPlotWidthLabel",
      "formworkPlotLengthLabel",
      "formworkPlotHeightLabel",
      "formworkPlotCountLabel",
    ]);
    // "Hauteur du plot", never "Epaisseur"
    assert.ok(!FORMWORK_TYPE_FIELDS.column.some((f) => f.labelKey === "formworkThicknessLabel"));
    // the count is the only unitless field in the calculator
    assert.deepEqual(FORMWORK_TYPE_FIELDS.column.map((f) => f.kind), ["length", "length", "length", "count"]);
  });

  test("semelle filante keeps its own labels, not the Plot ones", () => {
    assert.deepEqual(FORMWORK_TYPE_FIELDS.strip.map((f) => f.labelKey), [
      "formworkOuterLengthLabel",
      "formworkOuterWidthLabel",
      "formworkTotalHeightLabel",
      "formworkFootingThicknessLabel",
    ]);
    assert.ok(FORMWORK_TYPE_FIELDS.strip.every((f) => f.kind === "length"));
  });

  test("only the Lnet types ask for a thickness", () => {
    for (const type of FORMWORK_FOUNDATION_TYPES) {
      const asksThickness = FORMWORK_TYPE_FIELDS[type].some((f) => f.field === "thicknessM");
      assert.equal(asksThickness, type === "strip" || type === "pile", `${type}`);
    }
  });
});

describe("metric <-> imperial conversion", () => {
  test("uses the exact factor the client asked for: 1 m = 3.280839895 ft", () => {
    assert.equal(FEET_PER_METER, 3.280839895);
    assert.equal(metersToFeet(1), 3.280839895);
    // 6 * 3.280839895 is 19.685039370000002 in IEEE 754.
    assert.equal(Number(metersToFeet(6).toFixed(9)), 19.68503937);
    assert.equal(Number(feetToMeters(3.280839895).toFixed(12)), 1);
  });

  test("areas convert with the square of the factor", () => {
    assert.equal(squareMetersToSquareFeet(1), 3.280839895 * 3.280839895);
    assert.equal(Number(squareMetersToSquareFeet(18.4).toFixed(2)), 198.06);
    assert.equal(Number(squareFeetToSquareMeters(squareMetersToSquareFeet(18.4)).toFixed(10)), 18.4);
  });

  test("a value round-trips through both directions without drift", () => {
    for (const meters of [0.4, 0.5, 4, 6, 12.345]) {
      assert.equal(Number(feetToMeters(metersToFeet(meters)).toFixed(10)), meters);
      assert.equal(Number(squareFeetToSquareMeters(squareMetersToSquareFeet(meters)).toFixed(10)), meters);
    }
  });

  test("the metric helpers are pass-through, so metric behaviour is untouched", () => {
    assert.equal(lengthToMeters(6, "metric"), 6);
    assert.equal(lengthFromMeters(6, "metric"), 6);
    assert.equal(areaFromSquareMeters(18.4, "metric"), 18.4);
    assert.equal(FORMWORK_UNIT_SYMBOLS.metric.length, "m");
    assert.equal(FORMWORK_UNIT_SYMBOLS.metric.area, "m²");
    assert.equal(FORMWORK_UNIT_SYMBOLS.imperial.length, "ft");
    assert.equal(FORMWORK_UNIT_SYMBOLS.imperial.area, "ft²");
  });

  test("imperial input is converted to metres before the calculation", () => {
    assert.equal(Number(lengthToMeters(19.68503937, "imperial").toFixed(10)), 6);
    assert.equal(Number(lengthFromMeters(6, "imperial").toFixed(8)), 19.68503937);
  });
});

describe("switching units keeps the physical result identical", () => {
  /** The client's example, typed in feet instead of metres. */
  const IN_FEET = {
    lengthM: metersToFeet(6),
    widthM: metersToFeet(4),
    heightM: metersToFeet(0.5),
    thicknessM: metersToFeet(0.4),
    joistSpacingM: metersToFeet(0.5),
  };

  test("the same geometry entered in feet gives the same metric result", () => {
    const metric = computeFormwork(CLIENT_EXAMPLE);
    const fromImperial = computeFormwork({
      ...CLIENT_EXAMPLE,
      lengthM: lengthToMeters(IN_FEET.lengthM, "imperial"),
      widthM: lengthToMeters(IN_FEET.widthM, "imperial"),
      heightM: lengthToMeters(IN_FEET.heightM, "imperial"),
      thicknessM: lengthToMeters(IN_FEET.thicknessM, "imperial"),
      joistSpacingM: lengthToMeters(IN_FEET.joistSpacingM, "imperial"),
    });

    assert.equal(Number(fromImperial.contactAreaM2.toFixed(9)), Number(metric.contactAreaM2.toFixed(9)));
    assert.equal(fromImperial.panelCount, metric.panelCount);
    assert.equal(Number(fromImperial.timberLengthM.toFixed(9)), Number(metric.timberLengthM.toFixed(9)));
  });

  test("the client's example displayed in imperial: 198.06 ft2, 7 panels, 120.7 ft", () => {
    const r = computeFormwork(CLIENT_EXAMPLE);
    // Same physical quantities, expressed in feet.
    assert.equal(Number(areaFromSquareMeters(r.contactAreaM2, "imperial").toFixed(2)), 198.06);
    assert.equal(r.panelCount, 7);
    assert.equal(Number(lengthFromMeters(r.timberLengthM, "imperial").toFixed(1)), 120.7);
  });

  test("the panel count never depends on the unit the user types in", () => {
    for (const panelId of ["1220x2440", "1500x3000", "1220x1220"]) {
      const metric = computeFormwork({ ...CLIENT_EXAMPLE, panelId });
      const imperial = computeFormwork({
        ...CLIENT_EXAMPLE,
        panelId,
        lengthM: lengthToMeters(IN_FEET.lengthM, "imperial"),
        widthM: lengthToMeters(IN_FEET.widthM, "imperial"),
        heightM: lengthToMeters(IN_FEET.heightM, "imperial"),
        thicknessM: lengthToMeters(IN_FEET.thicknessM, "imperial"),
        joistSpacingM: lengthToMeters(IN_FEET.joistSpacingM, "imperial"),
      });
      assert.equal(imperial.panelCount, metric.panelCount, panelId);
    }
  });

  test("the number of plots is a count and is never converted between units", () => {
    const base = { ...CLIENT_EXAMPLE, type: "column" as const, widthM: 0.4, lengthM: 0.4, heightM: 0.3, plotCount: 4 };
    const metric = computeFormwork(base);
    const imperial = computeFormwork({
      ...base,
      widthM: lengthToMeters(metersToFeet(0.4), "imperial"),
      lengthM: lengthToMeters(metersToFeet(0.4), "imperial"),
      heightM: lengthToMeters(metersToFeet(0.3), "imperial"),
      joistSpacingM: lengthToMeters(metersToFeet(0.5), "imperial"),
      plotCount: 4, // unchanged on purpose
    });
    assert.equal(Number(imperial.contactAreaM2.toFixed(9)), Number(metric.contactAreaM2.toFixed(9)));
    assert.equal(imperial.panelCount, metric.panelCount);
    assert.equal(Number(imperial.timberLengthM.toFixed(9)), Number(metric.timberLengthM.toFixed(9)));
  });

  test("every foundation type survives the round trip", () => {
    for (const type of FORMWORK_FOUNDATION_TYPES) {
      const metric = computeFormwork({ ...CLIENT_EXAMPLE, type });
      const imperial = computeFormwork({
        ...CLIENT_EXAMPLE,
        type,
        lengthM: lengthToMeters(metersToFeet(6), "imperial"),
        widthM: lengthToMeters(metersToFeet(4), "imperial"),
        heightM: lengthToMeters(metersToFeet(0.5), "imperial"),
        thicknessM: lengthToMeters(metersToFeet(0.4), "imperial"),
        joistSpacingM: lengthToMeters(metersToFeet(0.5), "imperial"),
      });
      assert.equal(Number(imperial.contactAreaM2.toFixed(9)), Number(metric.contactAreaM2.toFixed(9)), type);
      assert.equal(imperial.panelCount, metric.panelCount, type);
      assert.equal(Number(imperial.timberLengthM.toFixed(9)), Number(metric.timberLengthM.toFixed(9)), type);
    }
  });
});
