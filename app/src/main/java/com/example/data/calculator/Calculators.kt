package com.example.data.calculator

import kotlin.math.PI
import kotlin.math.ceil

object ConcreteCalculator {
    enum class ElementType(val labelFr: String) {
        DALLE("Dalle"),
        VOILE("Voile"),
        POTEAU_RECTANGULAIRE("Poteau Rectangulaire"),
        POTEAU_ROND("Poteau Rond")
    }

    data class VolumeResult(
        val surfaceM2: Double,
        val volumeM3: Double
    )

    data class DosageResult(
        val cementKg: Double,
        val cementBags25kg: Double,
        val sandKg: Double,
        val gravelKg: Double,
        val waterL: Double
    )

    fun computeVolume(
        type: ElementType,
        lengthM: Double = 0.0,
        widthM: Double = 0.0,
        thicknessCm: Double = 0.0,
        diameterCm: Double = 0.0,
        heightM: Double = 0.0
    ): VolumeResult {
        return when (type) {
            ElementType.DALLE, ElementType.VOILE, ElementType.POTEAU_RECTANGULAIRE -> {
                val surface = lengthM * widthM
                val volume = surface * (thicknessCm / 100.0)
                VolumeResult(surfaceM2 = surface, volumeM3 = volume)
            }
            ElementType.POTEAU_ROND -> {
                val radiusM = (diameterCm / 100.0) / 2.0
                val surface = PI * radiusM * radiusM
                val volume = surface * heightM
                VolumeResult(surfaceM2 = surface, volumeM3 = volume)
            }
        }
    }

    fun computeDosage(volumeM3: Double, dosageKgM3: Int): DosageResult {
        val cementKg = dosageKgM3 * volumeM3
        val cementBags = cementKg / 25.0
        val waterL = cementKg * 0.5
        val sandKg = volumeM3 * 800.0 // 0.5 m³ * 1600 kg/m³
        val gravelKg = volumeM3 * 1200.0 // 0.8 m³ * 1500 kg/m³
        return DosageResult(
            cementKg = cementKg,
            cementBags25kg = cementBags,
            sandKg = sandKg,
            gravelKg = gravelKg,
            waterL = waterL
        )
    }
}

object SteelCalculator {
    val DIAMETERS_MM = listOf(6, 8, 10, 12, 14, 16, 20, 25, 32, 40)
    const val REBAR_LINEAR_MASS_COEFFICIENT = 0.00617

    data class SteelResult(
        val unitWeightKgPerM: Double,
        val totalWeightKg: Double
    )

    fun computeWeight(diameterMm: Int, lengthM: Double, quantity: Int): SteelResult {
        val unitWeight = diameterMm * diameterMm * REBAR_LINEAR_MASS_COEFFICIENT
        val totalWeight = unitWeight * lengthM * quantity
        return SteelResult(
            unitWeightKgPerM = unitWeight,
            totalWeightKg = totalWeight
        )
    }
}

object MeshCalculator {
    data class MeshType(
        val name: String,
        val panelLengthM: Double,
        val panelWidthM: Double,
        val panelWeightKg: Double
    ) {
        val panelAreaM2: Double get() = panelLengthM * panelWidthM
    }

    val STANDARD_MESHES = listOf(
        MeshType("PAF C (Anti-fissuration)", 2.40, 1.20, 4.10),
        MeshType("ST 10 (Structure)", 4.80, 2.40, 17.50),
        MeshType("ST 25 (Structure)", 6.00, 2.40, 36.80),
        MeshType("ST 25 C (Dallage)", 6.00, 2.40, 41.20),
        MeshType("ST 50 (Gros œuvre)", 6.00, 2.40, 72.50)
    )

    data class MeshResult(
        val panelsNeeded: Int,
        val totalWeightKg: Double,
        val effectiveSurfaceM2: Double
    )

    fun computeMesh(
        surfaceM2: Double,
        meshType: MeshType,
        overlapPercent: Double = 10.0
    ): MeshResult {
        val requiredSurface = surfaceM2 * (1.0 + (overlapPercent / 100.0))
        val panels = ceil(requiredSurface / meshType.panelAreaM2).toInt().coerceAtLeast(1)
        val totalWeight = panels * meshType.panelWeightKg
        return MeshResult(
            panelsNeeded = panels,
            totalWeightKg = totalWeight,
            effectiveSurfaceM2 = requiredSurface
        )
    }
}

object FormworkCalculator {
    enum class FormworkType(val labelFr: String) {
        SLAB("Dalle"),
        STRIP("Semelle filante"),
        COLUMN("Plot de fondation"),
        PILE("Pieu de fondation")
    }

    data class FormworkResult(
        val contactAreaM2: Double,
        val panelsCount: Int,
        val timberLengthM: Double
    )

    fun computeFormwork(
        type: FormworkType,
        lengthM: Double = 0.0,
        widthM: Double = 0.0,
        heightM: Double = 0.0,
        thicknessM: Double = 0.0,
        columnCount: Int = 1,
        panelAreaM2: Double = 2.976, // Standard 2.44m x 1.22m plywood
        wastePercent: Double = 10.0,
        joistSpacingM: Double = 0.5
    ): FormworkResult {
        val area = when (type) {
            FormworkType.SLAB -> 2.0 * (lengthM + widthM) * heightM
            FormworkType.STRIP -> {
                val lNet = 2.0 * lengthM + 2.0 * (widthM - 2.0 * thicknessM)
                2.0 * lNet * heightM
            }
            FormworkType.COLUMN -> 2.0 * (lengthM + widthM) * heightM * columnCount
            FormworkType.PILE -> {
                val lNet = 2.0 * lengthM + 2.0 * (widthM - 2.0 * thicknessM)
                2.0 * lNet * heightM
            }
        }.coerceAtLeast(0.0)

        val panels = ceil(area * (1.0 + wastePercent / 100.0) / panelAreaM2).toInt()
        val timber = if (joistSpacingM > 0) area / joistSpacingM else 0.0

        return FormworkResult(
            contactAreaM2 = area,
            panelsCount = panels,
            timberLengthM = timber
        )
    }
}
