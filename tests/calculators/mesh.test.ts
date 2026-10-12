import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeMeshPanels, MESH_TYPES, getMeshType } from "../../src/lib/calculators/mesh";

describe("MESH_TYPES", () => {
  test("every mesh type resolves and carries a positive panel weight", () => {
    for (const spec of MESH_TYPES) {
      assert.ok(spec.panelWeightKg > 0, `${spec.id} should have a positive panel weight`);
      assert.ok(spec.panelLengthM > 0 && spec.panelWidthM > 0, `${spec.id} should have positive dimensions`);
    }
  });
});

describe("computeMeshPanels", () => {
  test("different mesh types report their own dimensions, mesh size and weight (not hardcoded)", () => {
    const st25c = computeMeshPanels({ meshTypeId: "ST25C", surfaceM2: 14.4, overlap: "none" });
    const paf10 = computeMeshPanels({ meshTypeId: "PAF10", surfaceM2: 14.4, overlap: "none" });

    assert.deepEqual(st25c.meshSpacingMm, [150, 150]);
    assert.deepEqual(paf10.meshSpacingMm, [200, 200]);
    assert.notEqual(st25c.panelLengthM, paf10.panelLengthM);
    assert.notEqual(st25c.totalWeightKg, paf10.totalWeightKg);
  });

  test("panel dimensions and mesh size match the selected type", () => {
    const result = computeMeshPanels({ meshTypeId: "ST20", surfaceM2: 14.4, overlap: "none" });
    assert.equal(result.panelLengthM, 6.0);
    assert.equal(result.panelWidthM, 2.4);
    assert.deepEqual(result.meshSpacingMm, [150, 300]);
  });

  test("different surfaces require proportionally more panels", () => {
    const onePanel = computeMeshPanels({ meshTypeId: "ST25C", surfaceM2: 14.4, overlap: "none" });
    const twoPanels = computeMeshPanels({ meshTypeId: "ST25C", surfaceM2: 14.5, overlap: "none" });
    const fivePanels = computeMeshPanels({ meshTypeId: "ST25C", surfaceM2: 60, overlap: "none" });

    assert.equal(onePanel.panelCount, 1);
    assert.equal(twoPanels.panelCount, 2); // rounds up even for a tiny excess
    assert.equal(fivePanels.panelCount, Math.ceil(60 / 14.4));
    assert.equal(fivePanels.totalWeightKg, fivePanels.panelCount * 57.98);
  });

  test("more overlap never reduces the number of panels required for a fixed surface", () => {
    const none = computeMeshPanels({ meshTypeId: "ST25C", surfaceM2: 13.6, overlap: "none" });
    const one = computeMeshPanels({ meshTypeId: "ST25C", surfaceM2: 13.6, overlap: "1" });
    const two = computeMeshPanels({ meshTypeId: "ST25C", surfaceM2: 13.6, overlap: "2" });

    assert.ok(none.panelCount <= one.panelCount);
    assert.ok(one.panelCount <= two.panelCount);
    assert.equal(none.panelCount, 1);
    assert.equal(one.panelCount, 2);
  });

  test("zero surface requires zero panels and zero weight", () => {
    const result = computeMeshPanels({ meshTypeId: "ST25C", surfaceM2: 0, overlap: "none" });
    assert.equal(result.panelCount, 0);
    assert.equal(result.totalWeightKg, 0);
  });

  test("negative surface is rejected", () => {
    assert.throws(() => computeMeshPanels({ meshTypeId: "ST25C", surfaceM2: -10, overlap: "none" }));
  });

  test("an unknown mesh type is rejected rather than silently falling back", () => {
    assert.equal(getMeshType("NOT-A-TYPE"), undefined);
    assert.throws(() => computeMeshPanels({ meshTypeId: "NOT-A-TYPE", surfaceM2: 10, overlap: "none" }), RangeError);
  });
});
