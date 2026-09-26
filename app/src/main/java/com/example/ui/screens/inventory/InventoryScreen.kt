package com.example.ui.screens.inventory

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
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
import com.example.data.model.InventoryItem
import com.example.data.model.MaterialItem
import com.example.data.model.StockMovementRequest
import com.example.data.model.Warehouse
import com.example.ui.components.EmptyState
import com.example.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InventoryScreen(
    inventory: List<InventoryItem>,
    materials: List<MaterialItem>,
    warehouses: List<Warehouse>,
    isLoading: Boolean,
    onCreateMovement: (StockMovementRequest) -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }
    var onlyLowStock by remember { mutableStateOf(false) }
    var showMovementDialog by remember { mutableStateOf(false) }

    val filteredList = inventory.filter { item ->
        val name = item.material?.name ?: ""
        val category = item.material?.category ?: ""
        val matchesSearch = searchQuery.isBlank() ||
                name.contains(searchQuery, ignoreCase = true) ||
                category.contains(searchQuery, ignoreCase = true)

        val isLow = (item.minThreshold ?: 0.0) > 0 && item.quantity <= (item.minThreshold ?: 0.0)
        val matchesLow = !onlyLowStock || isLow

        matchesSearch && matchesLow
    }

    if (showMovementDialog) {
        CreateMovementDialog(
            materials = materials,
            warehouses = warehouses,
            onDismiss = { showMovementDialog = false },
            onSubmit = { request ->
                onCreateMovement(request)
                showMovementDialog = false
            }
        )
    }

    Scaffold(
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showMovementDialog = true },
                containerColor = BuildStockOrange,
                contentColor = MaterialTheme.colorScheme.onPrimary,
                icon = { Icon(Icons.Default.SwapHoriz, contentDescription = null) },
                text = { Text("Mouvement Stock") },
                modifier = Modifier
                    .padding(bottom = 60.dp)
                    .testTag("new_movement_fab")
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp)
        ) {
            Spacer(modifier = Modifier.height(12.dp))

            // Search Bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Rechercher un matériau, ciment, acier...") },
                leadingIcon = { Icon(imageVector = Icons.Default.Search, contentDescription = null) },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("inventory_search_input")
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Filter Chips
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = !onlyLowStock,
                    onClick = { onlyLowStock = false },
                    label = { Text("Tous (${inventory.size})") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = BuildStockNavy,
                        selectedLabelColor = MaterialTheme.colorScheme.onPrimary
                    )
                )
                val lowCount = inventory.count { (it.minThreshold ?: 0.0) > 0 && it.quantity <= (it.minThreshold ?: 0.0) }
                FilterChip(
                    selected = onlyLowStock,
                    onClick = { onlyLowStock = true },
                    label = { Text("Stock Faible ($lowCount)") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = DangerRed,
                        selectedLabelColor = MaterialTheme.colorScheme.onPrimary
                    )
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (filteredList.isEmpty() && !isLoading) {
                EmptyState(
                    title = "Aucun article d'inventaire",
                    message = "Enregistrez une entrée de stock avec le bouton ci-dessous",
                    icon = Icons.Default.Inventory2
                )
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    contentPadding = PaddingValues(bottom = 120.dp)
                ) {
                    items(filteredList) { item ->
                        InventoryCard(item)
                    }
                }
            }
        }
    }
}

@Composable
fun InventoryCard(item: InventoryItem) {
    val materialName = item.material?.name ?: "Matériau #${item.materialId.take(6)}"
    val unit = item.material?.unit ?: "u"
    val unitPrice = item.material?.unitPrice ?: 0.0
    val minThreshold = item.minThreshold ?: 0.0
    val isCritical = minThreshold > 0 && item.quantity <= minThreshold

    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(14.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .background(
                        if (isCritical) DangerRed.copy(alpha = 0.15f) else BuildStockBlue.copy(alpha = 0.15f),
                        RoundedCornerShape(10.dp)
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (isCritical) Icons.Default.Warning else Icons.Default.Layers,
                    contentDescription = null,
                    tint = if (isCritical) DangerRed else BuildStockBlue,
                    modifier = Modifier.size(22.dp)
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = materialName,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = BuildStockTextPrimary
                )
                Text(
                    text = "${item.material?.category ?: "Général"} • Dépôt: ${item.warehouse?.name ?: "Principal"}",
                    fontSize = 12.sp,
                    color = BuildStockTextSecondary
                )
                if (unitPrice > 0) {
                    Text(
                        text = "${String.format("%,.2f", unitPrice)} MAD / $unit",
                        fontSize = 12.sp,
                        color = BuildStockNavy,
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "${item.quantity} $unit",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (isCritical) DangerRed else BuildStockTextPrimary
                )
                if (minThreshold > 0) {
                    Text(
                        text = "Seuil min: $minThreshold",
                        fontSize = 11.sp,
                        color = if (isCritical) DangerRed else BuildStockTextSecondary
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateMovementDialog(
    materials: List<MaterialItem>,
    warehouses: List<Warehouse>,
    onDismiss: () -> Unit,
    onSubmit: (StockMovementRequest) -> Unit
) {
    var movementType by remember { mutableStateOf("IN") }
    var selectedMaterialId by remember { mutableStateOf(materials.firstOrNull()?.id ?: "") }
    var quantityStr by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Nouveau Mouvement de Stock") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                // Type selector
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    listOf("IN" to "Entrée", "OUT" to "Sortie", "TRANSFER" to "Transfert").forEach { (type, label) ->
                        FilterChip(
                            selected = movementType == type,
                            onClick = { movementType = type },
                            label = { Text(label, fontSize = 12.sp) },
                            modifier = Modifier.weight(1f),
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = BuildStockNavy,
                                selectedLabelColor = MaterialTheme.colorScheme.onPrimary
                            )
                        )
                    }
                }

                // Material selector
                if (materials.isNotEmpty()) {
                    Text("Matériau:", fontSize = 12.sp, color = BuildStockTextSecondary)
                    var expanded by remember { mutableStateOf(false) }
                    val currentMat = materials.find { it.id == selectedMaterialId } ?: materials.first()

                    ExposedDropdownMenuBox(
                        expanded = expanded,
                        onExpandedChange = { expanded = it }
                    ) {
                        OutlinedTextField(
                            value = currentMat.name,
                            onValueChange = {},
                            readOnly = true,
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                            modifier = Modifier
                                .menuAnchor()
                                .fillMaxWidth()
                        )
                        ExposedDropdownMenu(
                            expanded = expanded,
                            onDismissRequest = { expanded = false }
                        ) {
                            materials.forEach { mat ->
                                DropdownMenuItem(
                                    text = { Text(mat.name) },
                                    onClick = {
                                        selectedMaterialId = mat.id
                                        expanded = false
                                    }
                                )
                            }
                        }
                    }
                }

                OutlinedTextField(
                    value = quantityStr,
                    onValueChange = { quantityStr = it },
                    label = { Text("Quantité *") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Motif / Référence BL") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val qty = quantityStr.toDoubleOrNull() ?: 0.0
                    if (qty > 0 && selectedMaterialId.isNotBlank()) {
                        onSubmit(
                            StockMovementRequest(
                                materialId = selectedMaterialId,
                                movementType = movementType,
                                quantity = qty,
                                description = description.trim().ifEmpty { null }
                            )
                        )
                    }
                },
                enabled = (quantityStr.toDoubleOrNull() ?: 0.0) > 0,
                colors = ButtonDefaults.buttonColors(containerColor = BuildStockNavy)
            ) {
                Text("Valider le mouvement")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Annuler") }
        }
    )
}
