package com.example.ui.screens.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.Project
import com.example.data.model.StockMovement
import com.example.data.model.User
import com.example.ui.components.MetricCard
import com.example.ui.components.StatusBadge
import com.example.ui.theme.*

@Composable
fun DashboardScreen(
    user: User?,
    projects: List<Project>,
    stockMovements: List<StockMovement>,
    lowStockCount: Int,
    onNavigateToProjects: () -> Unit,
    onNavigateToInventory: () -> Unit,
    onNavigateToCalculators: () -> Unit,
    onNavigateToChecklists: () -> Unit,
    onNewMovementClick: () -> Unit
) {
    val activeProjectsCount = projects.count { it.status.lowercase() in listOf("active", "in_progress") }
    val totalBudget = projects.mapNotNull { it.totalBudget }.sum()

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 80.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Welcome Header Banner
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = BuildStockNavy),
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("dashboard_header_card")
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column {
                            Text(
                                text = "Bonjour, ${user?.firstName ?: "Collaborateur"}",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            val roleLabel = when (user?.role) {
                                "admin" -> "Administrateur"
                                "site_manager" -> "Chef de Chantier"
                                "structural_engineer" -> "Ingénieur Structure"
                                else -> "Utilisateur"
                            }
                            Text(
                                text = roleLabel,
                                fontSize = 13.sp,
                                color = BuildStockOrangeLight,
                                fontWeight = FontWeight.Medium
                            )
                        }

                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .background(BuildStockOrange.copy(alpha = 0.2f), RoundedCornerShape(12.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Construction,
                                contentDescription = null,
                                tint = BuildStockOrangeLight
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                    HorizontalDivider(color = Color.White.copy(alpha = 0.1f))
                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text("Budget Projets", fontSize = 12.sp, color = Color.White.copy(alpha = 0.7f))
                            Text(
                                "${String.format("%,.0f", totalBudget)} MAD",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("Statut Compte", fontSize = 12.sp, color = Color.White.copy(alpha = 0.7f))
                            Text(
                                if (user?.isPlatformAdmin == true) "Admin Plateforme" else "Entreprise Active",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = SuccessGreen
                            )
                        }
                    }
                }
            }
        }

        // Metrics Grid (2x2)
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    MetricCard(
                        title = "Projets Actifs",
                        value = "$activeProjectsCount",
                        subtitle = "sur ${projects.size} au total",
                        icon = Icons.Default.Folder,
                        accentColor = BuildStockBlue,
                        modifier = Modifier
                            .weight(1f)
                            .clickable { onNavigateToProjects() }
                            .testTag("metric_active_projects")
                    )
                    MetricCard(
                        title = "Stock Critique",
                        value = "$lowStockCount",
                        subtitle = if (lowStockCount > 0) "Action requise" else "Niveaux optimaux",
                        icon = Icons.Default.Warning,
                        accentColor = if (lowStockCount > 0) DangerRed else SuccessGreen,
                        modifier = Modifier
                            .weight(1f)
                            .clickable { onNavigateToInventory() }
                            .testTag("metric_stock_alerts")
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    MetricCard(
                        title = "Mouvements",
                        value = "${stockMovements.size}",
                        subtitle = "Entrées / Sorties",
                        icon = Icons.Default.SwapHoriz,
                        accentColor = BuildStockOrange,
                        modifier = Modifier
                            .weight(1f)
                            .clickable { onNavigateToInventory() }
                    )
                    MetricCard(
                        title = "Outils BTP",
                        value = "4 modules",
                        subtitle = "Béton, Acier, Coffrage",
                        icon = Icons.Default.Calculate,
                        accentColor = BuildStockNavyLight,
                        modifier = Modifier
                            .weight(1f)
                            .clickable { onNavigateToCalculators() }
                    )
                }
            }
        }

        // Quick Actions Row
        item {
            Text(
                text = "Accès Rapide",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = BuildStockNavy
            )
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                QuickActionButton(
                    icon = Icons.Default.AddBox,
                    label = "Mouvement",
                    onClick = onNewMovementClick,
                    modifier = Modifier.weight(1f)
                )
                QuickActionButton(
                    icon = Icons.Default.Calculate,
                    label = "Calculateur",
                    onClick = onNavigateToCalculators,
                    modifier = Modifier.weight(1f)
                )
                QuickActionButton(
                    icon = Icons.Default.Checklist,
                    label = "Checklists",
                    onClick = onNavigateToChecklists,
                    modifier = Modifier.weight(1f)
                )
                QuickActionButton(
                    icon = Icons.Default.Apartment,
                    label = "Projets",
                    onClick = onNavigateToProjects,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        // Recent Movements Header
        item {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = "Derniers Mouvements de Stock",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = BuildStockNavy
                )
                TextButton(onClick = onNavigateToInventory) {
                    Text("Voir tout", color = BuildStockOrange)
                }
            }
        }

        // Movements List
        if (stockMovements.isEmpty()) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "Aucun mouvement de stock enregistré.",
                        color = BuildStockTextSecondary,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(16.dp)
                    )
                }
            }
        } else {
            items(stockMovements.take(5)) { movement ->
                StockMovementCard(movement)
            }
        }
    }
}

@Composable
fun QuickActionButton(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = modifier.clickable { onClick() }
    ) {
        Column(
            modifier = Modifier
                .padding(vertical = 12.dp, horizontal = 4.dp)
                .fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = BuildStockOrange,
                modifier = Modifier.size(22.dp)
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = label,
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                color = BuildStockNavy,
                maxLines = 1
            )
        }
    }
}

@Composable
fun StockMovementCard(movement: StockMovement) {
    val isIn = movement.movementType.uppercase() == "IN"
    val isTransfer = movement.movementType.uppercase() == "TRANSFER"
    val (typeColor, typeLabel, icon) = when {
        isIn -> Triple(SuccessGreen, "Entrée", Icons.Default.ArrowDownward)
        isTransfer -> Triple(BuildStockBlue, "Transfert", Icons.Default.SwapHoriz)
        else -> Triple(DangerRed, "Sortie", Icons.Default.ArrowUpward)
    }

    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .background(typeColor.copy(alpha = 0.15f), RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = typeColor,
                    modifier = Modifier.size(20.dp)
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = movement.material?.name ?: "Matériau #${movement.materialId.take(6)}",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    color = BuildStockTextPrimary
                )
                Text(
                    text = movement.description ?: typeLabel,
                    fontSize = 12.sp,
                    color = BuildStockTextSecondary
                )
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "${if (isIn) "+" else "-"}${movement.quantity} ${movement.material?.unit ?: "u"}",
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = typeColor
                )
                Text(
                    text = typeLabel,
                    fontSize = 11.sp,
                    color = BuildStockTextSecondary
                )
            }
        }
    }
}
