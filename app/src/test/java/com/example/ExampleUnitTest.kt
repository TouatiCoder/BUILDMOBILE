package com.example

import com.example.data.calculator.ConcreteCalculator
import com.example.data.calculator.FormworkCalculator
import com.example.data.calculator.MeshCalculator
import com.example.data.calculator.SteelCalculator
import org.junit.Assert.*
import org.junit.Test

class ExampleUnitTest {

    @Test
    fun testConcreteVolumeAndDosage() {
        // Dalle: 10m x 5m x 20cm -> Surface = 50 m², Volume = 50 * 0.20 = 10 m³
        val volumeRes = ConcreteCalculator.computeVolume(
            type = ConcreteCalculator.ElementType.DALLE,
            lengthM = 10.0,
            widthM = 5.0,
            thicknessCm = 20.0
        )
        assertEquals(50.0, volumeRes.surfaceM2, 0.001)
        assertEquals(10.0, volumeRes.volumeM3, 0.001)

        // Dosage 350 kg/m³ for 10 m³ -> 3500 kg cement -> 140 bags of 25kg
        // Water = 3500 * 0.5 = 1750 L
        // Sand = 10 * 800 = 8000 kg
        // Gravel = 10 * 1200 = 12000 kg
        val dosageRes = ConcreteCalculator.computeDosage(volumeM3 = 10.0, dosageKgM3 = 350)
        assertEquals(3500.0, dosageRes.cementKg, 0.001)
        assertEquals(140.0, dosageRes.cementBags25kg, 0.001)
        assertEquals(1750.0, dosageRes.waterL, 0.001)
        assertEquals(8000.0, dosageRes.sandKg, 0.001)
        assertEquals(12000.0, dosageRes.gravelKg, 0.001)
    }

    @Test
    fun testRoundColumnConcreteVolume() {
        // Poteau rond: diameter 40 cm -> radius = 0.20m -> area = pi * 0.20^2 = 0.12566m², height 3m -> 0.37699m³
        val roundRes = ConcreteCalculator.computeVolume(
            type = ConcreteCalculator.ElementType.POTEAU_ROND,
            diameterCm = 40.0,
            heightM = 3.0
        )
        val expectedArea = Math.PI * 0.2 * 0.2
        assertEquals(expectedArea, roundRes.surfaceM2, 0.001)
        assertEquals(expectedArea * 3.0, roundRes.volumeM3, 0.001)
    }

    @Test
    fun testSteelWeightFormula() {
        // HA12: 12 * 12 * 0.00617 = 0.88848 kg/m
        // 10 bars of 12m: 0.88848 * 12 * 10 = 106.6176 kg
        val steelRes = SteelCalculator.computeWeight(diameterMm = 12, lengthM = 12.0, quantity = 10)
        assertEquals(0.88848, steelRes.unitWeightKgPerM, 0.0001)
        assertEquals(106.6176, steelRes.totalWeightKg, 0.01)
    }

    @Test
    fun testMeshPanelsCalculation() {
        // PAF C (2.40m x 1.20m = 2.88 m² panel area)
        // 100 m² surface with 10% overlap -> 110 m² required -> ceil(110 / 2.88) = 39 panels
        val meshType = MeshCalculator.STANDARD_MESHES.first()
        val meshRes = MeshCalculator.computeMesh(surfaceM2 = 100.0, meshType = meshType, overlapPercent = 10.0)
        assertEquals(39, meshRes.panelsNeeded)
        assertEquals(39 * 4.10, meshRes.totalWeightKg, 0.01)
    }

    @Test
    fun testFormworkFormula() {
        // Slab (Dalle): 2 * (L + W) * H
        // 10m x 5m, height 0.5m -> 2 * (10 + 5) * 0.5 = 15 m²
        val formworkRes = FormworkCalculator.computeFormwork(
            type = FormworkCalculator.FormworkType.SLAB,
            lengthM = 10.0,
            widthM = 5.0,
            heightM = 0.5,
            panelAreaM2 = 2.976,
            wastePercent = 10.0
        )
        assertEquals(15.0, formworkRes.contactAreaM2, 0.001)
        assertTrue(formworkRes.panelsCount >= 5)
    }
}
