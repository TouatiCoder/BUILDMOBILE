package com.example.ui.screens.checklists

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.Checklist
import com.example.data.model.ChecklistItem
import com.example.ui.components.EmptyState
import com.example.ui.components.StatusBadge
import com.example.ui.theme.*

@Composable
fun ChecklistsScreen(
    checklists: List<Checklist>,
    onToggleItem: (checklistId: String, itemId: String, isChecked: Boolean) -> Unit
) {
    var selectedType by remember { mutableStateOf("Tous") }
    val typeFilters = listOf("Tous", "Sécurité", "Quotidien", "Qualité", "Équipement")

    val filteredChecklists = checklists.filter { checklist ->
        when (selectedType) {
            "Sécurité" -> checklist.checklistType.lowercase() == "safety"
            "Quotidien" -> checklist.checklistType.lowercase() == "daily"
            "Qualité" -> checklist.checklistType.lowercase() == "quality"
            "Équipement" -> checklist.checklistType.lowercase() == "equipment"
            else -> true
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
    ) {
        Spacer(modifier = Modifier.height(12.dp))

        // Type filter
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            typeFilters.forEach { type ->
                FilterChip(
                    selected = selectedType == type,
                    onClick = { selectedType = type },
                    label = { Text(type, fontSize = 12.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = BuildStockNavy,
                        selectedLabelColor = Color.White
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        if (filteredChecklists.isEmpty()) {
            EmptyState(
                title = "Aucune fiche de contrôle",
                message = "Toutes les vérifications sont à jour sur ce chantier",
                icon = Icons.Default.Checklist
            )
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(14.dp),
                contentPadding = PaddingValues(bottom = 90.dp)
            ) {
                items(filteredChecklists) { checklist ->
                    ChecklistCard(
                        checklist = checklist,
                        onToggle = { itemId, isChecked ->
                            onToggleItem(checklist.id, itemId, isChecked)
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun ChecklistCard(
    checklist: Checklist,
    onToggle: (itemId: String, isChecked: Boolean) -> Unit
) {
    var isExpanded by remember { mutableStateOf(true) }
    val totalItems = checklist.items.size
    val checkedItems = checklist.items.count { it.isChecked }
    val progress = if (totalItems > 0) checkedItems.toFloat() / totalItems else 0f
    val isComplete = totalItems > 0 && checkedItems == totalItems

    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { isExpanded = !isExpanded }
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = checklist.title,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = BuildStockTextPrimary
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = "$checkedItems sur $totalItems vérifiés",
                        fontSize = 12.sp,
                        color = if (isComplete) SuccessGreen else BuildStockTextSecondary
                    )
                }

                StatusBadge(status = if (isComplete) "Terminé" else "En cours")
                IconButton(onClick = { isExpanded = !isExpanded }) {
                    Icon(
                        imageVector = if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        contentDescription = null
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp),
                color = if (isComplete) SuccessGreen else BuildStockOrange,
                trackColor = BuildStockBorder
            )

            if (isExpanded) {
                Spacer(modifier = Modifier.height(12.dp))
                checklist.items.forEach { item ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onToggle(item.id, !item.isChecked) }
                            .padding(vertical = 4.dp)
                    ) {
                        Checkbox(
                            checked = item.isChecked,
                            onCheckedChange = { isChecked -> onToggle(item.id, isChecked) },
                            colors = CheckboxDefaults.colors(
                                checkedColor = SuccessGreen,
                                checkmarkColor = Color.White
                            )
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = item.label,
                            fontSize = 14.sp,
                            color = if (item.isChecked) BuildStockTextSecondary else BuildStockTextPrimary,
                            fontWeight = if (item.isChecked) FontWeight.Normal else FontWeight.Medium
                        )
                    }
                }
            }
        }
    }
}
