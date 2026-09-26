package com.example.ui.screens.calculators

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.calculator.*
import com.example.data.model.CalculationSaveRequest
import com.example.data.model.Project
import com.example.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalculatorsScreen(
    projects: List<Project>,
    onSaveCalculation: (CalculationSaveRequest) -> Unit
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf("Béton", "Poids HA", "Treillis", "Coffrage")

    Scaffold { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            ScrollableTabRow(
                selectedTabIndex = selectedTab,
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = BuildStockNavy,
                edgePadding = 16.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                tabs.forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index },
                        text = {
                            Text(
                                text = title,
                                fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Normal
                            )
                        }
                    )
                }
            }

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp)
                    .padding(bottom = 70.dp)
            ) {
                when (selectedTab) {
                    0 -> ConcreteCalculatorView(projects, onSaveCalculation)
                    1 -> SteelCalculatorView(projects, onSaveCalculation)
                    2 -> MeshCalculatorView(projects, onSaveCalculation)
                    3 -> FormworkCalculatorView(projects, onSaveCalculation)
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// 1. Concrete Calculator
// ---------------------------------------------------------------------------
@Composable
fun ConcreteCalculatorView(
    projects: List<Project>,
    onSave: (CalculationSaveRequest) -> Unit
) {
    var selectedType by remember { mutableStateOf(ConcreteCalculator.ElementType.DALLE) }
    var lengthStr by remember { mutableStateOf("10.0") }
    var widthStr by remember { mutableStateOf("5.0") }
    var thicknessCmStr by remember { mutableStateOf("20") }
    var diameterCmStr by remember { mutableStateOf("30") }
    var heightMStr by remember { mutableStateOf("3.0") }
    var selectedDosage by remember { mutableIntStateOf(350) }
    var savedSuccess by remember { mutableStateOf(false) }

    val length = lengthStr.toDoubleOrNull() ?: 0.0
    val width = widthStr.toDoubleOrNull() ?: 0.0
    val thicknessCm = thicknessCmStr.toDoubleOrNull() ?: 0.0
    val diameterCm = diameterCmStr.toDoubleOrNull() ?: 0.0
    val heightM = heightMStr.toDoubleOrNull() ?: 0.0

    val volumeResult = ConcreteCalculator.computeVolume(
        type = selectedType,
        lengthM = length,
        widthM = width,
        thicknessCm = thicknessCm,
        diameterCm = diameterCm,
        heightM = heightM
    )

    val dosageResult = ConcreteCalculator.computeDosage(
        volumeM3 = volumeResult.volumeM3,
        dosageKgM3 = selectedDosage
    )

    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("Élément de structure :", fontWeight = FontWeight.Bold, color = BuildStockNavy)

        // Type selection chips
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            ConcreteCalculator.ElementType.values().forEach { type ->
                FilterChip(
                    selected = selectedType == type,
                    onClick = { selectedType = type },
                    label = { Text(type.labelFr, fontSize = 11.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = BuildStockNavy,
                        selectedLabelColor = Color.White
                    )
                )
            }
        }

        // Geometric inputs
        if (selectedType != ConcreteCalculator.ElementType.POTEAU_ROND) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = lengthStr,
                    onValueChange = { lengthStr = it },
                    label = { Text("Longueur (m)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f)
                )
                OutlinedTextField(
                    value = widthStr,
                    onValueChange = { widthStr = it },
                    label = { Text(if (selectedType == ConcreteCalculator.ElementType.VOILE) "Hauteur (m)" else "Largeur (m)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f)
                )
            }
            OutlinedTextField(
                value = thicknessCmStr,
                onValueChange = { thicknessCmStr = it },
                label = { Text("Épaisseur (cm)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth()
            )
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = diameterCmStr,
                    onValueChange = { diameterCmStr = it },
                    label = { Text("Diamètre (cm)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f)
                )
                OutlinedTextField(
                    value = heightMStr,
                    onValueChange = { heightMStr = it },
                    label = { Text("Hauteur (m)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f)
                )
            }
        }

        // Volume Output Card
        Card(
            colors = CardDefaults.cardColors(containerColor = BuildStockNavy),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier.padding(18.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Surface de coffrage", color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp)
                    Text(
                        "${String.format("%.2f", volumeResult.surfaceM2)} m²",
                        color = Color.White,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("Volume de béton", color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp)
                    Text(
                        "${String.format("%.2f", volumeResult.volumeM3)} m³",
                        color = BuildStockOrangeLight,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        // Dosage Section
        Text("Dosage en ciment :", fontWeight = FontWeight.Bold, color = BuildStockNavy)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            listOf(200, 300, 350).forEach { dosage ->
                FilterChip(
                    selected = selectedDosage == dosage,
                    onClick = { selectedDosage = dosage },
                    label = { Text("$dosage kg/m³") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = BuildStockOrange,
                        selectedLabelColor = Color.White
                    )
                )
            }
        }

        // Quantities Breakdown Card
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            shape = RoundedCornerShape(16.dp),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Matériaux nécessaires pour le gâchage :", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                HorizontalDivider(color = BuildStockBorder)

                ResultRow("Ciment", "${String.format("%,.0f", dosageResult.cementKg)} kg", "${String.format("%.1f", dosageResult.cementBags25kg)} sacs de 25 kg")
                ResultRow("Eau", "${String.format("%,.0f", dosageResult.waterL)} L", "Ratio E/C: 0.50")
                ResultRow("Sable", "${String.format("%,.0f", dosageResult.sandKg)} kg", "0.5 m³/m³")
                ResultRow("Gravier", "${String.format("%,.0f", dosageResult.gravelKg)} kg", "0.8 m³/m³")
            }
        }

        // Save Action
        Button(
            onClick = {
                onSave(
                    CalculationSaveRequest(
                        toolType = "concrete",
                        input = mapOf(
                            "elementType" to selectedType.name,
                            "length" to length,
                            "width" to width,
                            "thicknessCm" to thicknessCm,
                            "dosageKgM3" to selectedDosage
                        ),
                        output = mapOf(
                            "surfaceM2" to volumeResult.surfaceM2,
                            "volumeM3" to volumeResult.volumeM3,
                            "cementKg" to dosageResult.cementKg,
                            "cementBags25kg" to dosageResult.cementBags25kg
                        ),
                        notes = "Béton ${selectedType.labelFr} à $selectedDosage kg/m³"
                    )
                )
                savedSuccess = true
            },
            colors = ButtonDefaults.buttonColors(containerColor = BuildStockNavy),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth().height(48.dp)
        ) {
            Icon(Icons.Default.Save, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text(if (savedSuccess) "Calcul sauvegardé !" else "Enregistrer ce calcul")
        }
    }
}

// ---------------------------------------------------------------------------
// 2. Steel Rebar Calculator (Poids HA)
// ---------------------------------------------------------------------------
@Composable
fun SteelCalculatorView(
    projects: List<Project>,
    onSave: (CalculationSaveRequest) -> Unit
) {
    var selectedDiameter by remember { mutableIntStateOf(12) }
    var lengthStr by remember { mutableStateOf("12.0") }
    var quantityStr by remember { mutableStateOf("10") }
    var savedSuccess by remember { mutableStateOf(false) }

    val length = lengthStr.toDoubleOrNull() ?: 0.0
    val quantity = quantityStr.toIntOrNull() ?: 0
    val result = SteelCalculator.computeWeight(selectedDiameter, length, quantity)

    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("Diamètre HA (mm) :", fontWeight = FontWeight.Bold, color = BuildStockNavy)

        // Diameter grid
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            SteelCalculator.DIAMETERS_MM.take(5).forEach { d ->
                FilterChip(
                    selected = selectedDiameter == d,
                    onClick = { selectedDiameter = d },
                    label = { Text("HA$d", fontSize = 12.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = BuildStockNavy,
                        selectedLabelColor = Color.White
                    )
                )
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            SteelCalculator.DIAMETERS_MM.drop(5).forEach { d ->
                FilterChip(
                    selected = selectedDiameter == d,
                    onClick = { selectedDiameter = d },
                    label = { Text("HA$d", fontSize = 12.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = BuildStockNavy,
                        selectedLabelColor = Color.White
                    )
                )
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(
                value = lengthStr,
                onValueChange = { lengthStr = it },
                label = { Text("Longueur par barre (m)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.weight(1f)
            )
            OutlinedTextField(
                value = quantityStr,
                onValueChange = { quantityStr = it },
                label = { Text("Nombre de barres") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.weight(1f)
            )
        }

        Card(
            colors = CardDefaults.cardColors(containerColor = BuildStockNavy),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Poids linéaire unitaire : ${String.format("%.3f", result.unitWeightKgPerM)} kg/m", color = Color.White.copy(alpha = 0.7f), fontSize = 13.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Poids Total Acier", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Text(
                        "${String.format("%.2f", result.totalWeightKg)} kg",
                        color = BuildStockOrangeLight,
                        fontWeight = FontWeight.Bold,
                        fontSize = 24.sp
                    )
                }
            }
        }

        Button(
            onClick = {
                onSave(
                    CalculationSaveRequest(
                        toolType = "steel",
                        input = mapOf("diameterMm" to selectedDiameter, "lengthM" to length, "quantity" to quantity),
                        output = mapOf("unitWeightKgPerM" to result.unitWeightKgPerM, "totalWeightKg" to result.totalWeightKg),
                        notes = "Armatures HA$selectedDiameter: $quantity barres de ${length}m"
                    )
                )
                savedSuccess = true
            },
            colors = ButtonDefaults.buttonColors(containerColor = BuildStockNavy),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth().height(48.dp)
        ) {
            Icon(Icons.Default.Save, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text(if (savedSuccess) "Sauvegardé !" else "Enregistrer ce calcul acier")
        }
    }
}

// ---------------------------------------------------------------------------
// 3. Welded Mesh Calculator (Treillis Soudé)
// ---------------------------------------------------------------------------
@Composable
fun MeshCalculatorView(
    projects: List<Project>,
    onSave: (CalculationSaveRequest) -> Unit
) {
    var selectedMeshIndex by remember { mutableIntStateOf(0) }
    var surfaceStr by remember { mutableStateOf("100.0") }
    var overlapPercent by remember { mutableDoubleStateOf(10.0) }
    var savedSuccess by remember { mutableStateOf(false) }

    val surface = surfaceStr.toDoubleOrNull() ?: 0.0
    val meshType = MeshCalculator.STANDARD_MESHES[selectedMeshIndex]
    val result = MeshCalculator.computeMesh(surface, meshType, overlapPercent)

    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("Type de treillis normalisé :", fontWeight = FontWeight.Bold, color = BuildStockNavy)

        MeshCalculator.STANDARD_MESHES.forEachIndexed { index, m ->
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = if (selectedMeshIndex == index) BuildStockNavy.copy(alpha = 0.08f) else MaterialTheme.colorScheme.surface
                ),
                shape = RoundedCornerShape(12.dp),
                border = if (selectedMeshIndex == index) androidx.compose.foundation.BorderStroke(2.dp, BuildStockNavy) else null,
                onClick = { selectedMeshIndex = index },
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    RadioButton(
                        selected = selectedMeshIndex == index,
                        onClick = { selectedMeshIndex = index }
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(m.name, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Text(
                            "Panneau: ${m.panelLengthM}m × ${m.panelWidthM}m (${String.format("%.2f", m.panelAreaM2)} m²) • Poids: ${m.panelWeightKg} kg",
                            fontSize = 12.sp,
                            color = BuildStockTextSecondary
                        )
                    }
                }
            }
        }

        OutlinedTextField(
            value = surfaceStr,
            onValueChange = { surfaceStr = it },
            label = { Text("Surface au sol / radier (m²)") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth()
        )

        Text("Recouvrement des mailles :", fontSize = 13.sp, fontWeight = FontWeight.Medium)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(0.0 to "Aucun (0%)", 10.0 to "Standard (10%)", 20.0 to "Double (20%)").forEach { (ratio, label) ->
                FilterChip(
                    selected = overlapPercent == ratio,
                    onClick = { overlapPercent = ratio },
                    label = { Text(label, fontSize = 12.sp) }
                )
            }
        }

        Card(
            colors = CardDefaults.cardColors(containerColor = BuildStockNavy),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier.padding(18.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Panneaux nécessaires", color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp)
                    Text("${result.panelsNeeded} unités", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("Poids Total", color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp)
                    Text(
                        "${String.format("%.1f", result.totalWeightKg)} kg",
                        color = BuildStockOrangeLight,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        Button(
            onClick = {
                onSave(
                    CalculationSaveRequest(
                        toolType = "mesh",
                        input = mapOf("meshType" to meshType.name, "surfaceM2" to surface, "overlapPercent" to overlapPercent),
                        output = mapOf("panelsNeeded" to result.panelsNeeded, "totalWeightKg" to result.totalWeightKg),
                        notes = "Treillis ${meshType.name}: ${result.panelsNeeded} panneaux"
                    )
                )
                savedSuccess = true
            },
            colors = ButtonDefaults.buttonColors(containerColor = BuildStockNavy),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth().height(48.dp)
        ) {
            Icon(Icons.Default.Save, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text(if (savedSuccess) "Sauvegardé !" else "Enregistrer ce calcul treillis")
        }
    }
}

// ---------------------------------------------------------------------------
// 4. Formwork Calculator (Coffrage)
// ---------------------------------------------------------------------------
@Composable
fun FormworkCalculatorView(
    projects: List<Project>,
    onSave: (CalculationSaveRequest) -> Unit
) {
    var selectedType by remember { mutableStateOf(FormworkCalculator.FormworkType.SLAB) }
    var lengthStr by remember { mutableStateOf("10.0") }
    var widthStr by remember { mutableStateOf("5.0") }
    var heightStr by remember { mutableStateOf("0.5") }
    var thicknessStr by remember { mutableStateOf("0.2") }
    var columnCountStr by remember { mutableStateOf("4") }
    var savedSuccess by remember { mutableStateOf(false) }

    val length = lengthStr.toDoubleOrNull() ?: 0.0
    val width = widthStr.toDoubleOrNull() ?: 0.0
    val height = heightStr.toDoubleOrNull() ?: 0.0
    val thickness = thicknessStr.toDoubleOrNull() ?: 0.0
    val columnCount = columnCountStr.toIntOrNull() ?: 1

    val result = FormworkCalculator.computeFormwork(
        type = selectedType,
        lengthM = length,
        widthM = width,
        heightM = height,
        thicknessM = thickness,
        columnCount = columnCount
    )

    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("Type d'ouvrage de coffrage :", fontWeight = FontWeight.Bold, color = BuildStockNavy)

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            FormworkCalculator.FormworkType.values().forEach { type ->
                FilterChip(
                    selected = selectedType == type,
                    onClick = { selectedType = type },
                    label = { Text(type.labelFr, fontSize = 11.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = BuildStockNavy,
                        selectedLabelColor = Color.White
                    )
                )
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(
                value = lengthStr,
                onValueChange = { lengthStr = it },
                label = { Text("Longueur (m)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.weight(1f)
            )
            OutlinedTextField(
                value = widthStr,
                onValueChange = { widthStr = it },
                label = { Text("Largeur (m)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.weight(1f)
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(
                value = heightStr,
                onValueChange = { heightStr = it },
                label = { Text("Hauteur (m)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.weight(1f)
            )
            if (selectedType == FormworkCalculator.FormworkType.COLUMN) {
                OutlinedTextField(
                    value = columnCountStr,
                    onValueChange = { columnCountStr = it },
                    label = { Text("Nombre de plots") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f)
                )
            } else if (selectedType == FormworkCalculator.FormworkType.STRIP || selectedType == FormworkCalculator.FormworkType.PILE) {
                OutlinedTextField(
                    value = thicknessStr,
                    onValueChange = { thicknessStr = it },
                    label = { Text("Épaisseur Tb (m)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f)
                )
            }
        }

        Card(
            colors = CardDefaults.cardColors(containerColor = BuildStockNavy),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text("Surface de contact", color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp)
                        Text("${String.format("%.2f", result.contactAreaM2)} m²", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("Panneaux Contreplaqué", color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp)
                        Text("${result.panelsCount} unités", color = BuildStockOrangeLight, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    }
                }
                HorizontalDivider(color = Color.White.copy(alpha = 0.15f))
                Text("Longueur de bois (bastaings / chevrons) : ${String.format("%.1f", result.timberLengthM)} m linéaire", color = Color.White, fontSize = 13.sp)
            }
        }

        Button(
            onClick = {
                onSave(
                    CalculationSaveRequest(
                        toolType = "formwork",
                        input = mapOf("type" to selectedType.name, "length" to length, "width" to width, "height" to height),
                        output = mapOf("contactAreaM2" to result.contactAreaM2, "panelsCount" to result.panelsCount, "timberLengthM" to result.timberLengthM),
                        notes = "Coffrage ${selectedType.labelFr}: ${result.panelsCount} panneaux"
                    )
                )
                savedSuccess = true
            },
            colors = ButtonDefaults.buttonColors(containerColor = BuildStockNavy),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth().height(48.dp)
        ) {
            Icon(Icons.Default.Save, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text(if (savedSuccess) "Sauvegardé !" else "Enregistrer ce calcul coffrage")
        }
    }
}

@Composable
fun ResultRow(label: String, value: String, detail: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(label, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = BuildStockTextPrimary)
            Text(detail, fontSize = 11.sp, color = BuildStockTextSecondary)
        }
        Text(value, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = BuildStockNavy)
    }
}
