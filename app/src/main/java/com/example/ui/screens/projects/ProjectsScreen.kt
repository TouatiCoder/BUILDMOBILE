package com.example.ui.screens.projects

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.Project
import com.example.data.model.ProjectCreateRequest
import com.example.ui.components.EmptyState
import com.example.ui.components.StatusBadge
import com.example.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectsScreen(
    projects: List<Project>,
    isLoading: Boolean,
    onCreateProject: (ProjectCreateRequest) -> Unit,
    onProjectClick: (Project) -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedStatus by remember { mutableStateOf("Tous") }
    var showCreateDialog by remember { mutableStateOf(false) }

    val statusFilters = listOf("Tous", "En cours", "Planification", "Terminé")

    val filteredProjects = projects.filter { project ->
        val matchesSearch = searchQuery.isBlank() ||
                project.name.contains(searchQuery, ignoreCase = true) ||
                (project.clientName?.contains(searchQuery, ignoreCase = true) == true)

        val matchesStatus = when (selectedStatus) {
            "Tous" -> true
            "En cours" -> project.status.lowercase() in listOf("active", "in_progress")
            "Planification" -> project.status.lowercase() in listOf("planning", "pending")
            "Terminé" -> project.status.lowercase() in listOf("completed", "delivered")
            else -> true
        }

        matchesSearch && matchesStatus
    }

    if (showCreateDialog) {
        CreateProjectDialog(
            onDismiss = { showCreateDialog = false },
            onSubmit = { request ->
                onCreateProject(request)
                showCreateDialog = false
            }
        )
    }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showCreateDialog = true },
                containerColor = BuildStockOrange,
                contentColor = MaterialTheme.colorScheme.onPrimary,
                modifier = Modifier
                    .padding(bottom = 60.dp)
                    .testTag("create_project_fab")
            ) {
                Icon(imageVector = Icons.Default.Add, contentDescription = "Nouveau Projet")
            }
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
                placeholder = { Text("Rechercher un projet, un client...") },
                leadingIcon = { Icon(imageVector = Icons.Default.Search, contentDescription = null) },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { searchQuery = "" }) {
                            Icon(imageVector = Icons.Default.Close, contentDescription = "Effacer")
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("project_search_input")
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Status Filter Chips
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                items(statusFilters) { status ->
                    FilterChip(
                        selected = selectedStatus == status,
                        onClick = { selectedStatus = status },
                        label = { Text(status) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = BuildStockNavy,
                            selectedLabelColor = MaterialTheme.colorScheme.onPrimary
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Project List
            if (filteredProjects.isEmpty() && !isLoading) {
                EmptyState(
                    title = "Aucun projet trouvé",
                    message = "Créez votre premier projet de chantier avec le bouton +",
                    icon = Icons.Default.FolderOpen
                )
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    contentPadding = PaddingValues(bottom = 120.dp)
                ) {
                    items(filteredProjects) { project ->
                        ProjectItemCard(
                            project = project,
                            onClick = { onProjectClick(project) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ProjectItemCard(
    project: Project,
    onClick: () -> Unit
) {
    val totalBudget = project.totalBudget ?: 0.0
    val currentCost = project.currentCost ?: 0.0
    val progress = if (totalBudget > 0) (currentCost / totalBudget).toFloat().coerceIn(0f, 1f) else 0f

    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .testTag("project_card_${project.id}")
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = project.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = BuildStockTextPrimary,
                    modifier = Modifier.weight(1f)
                )
                StatusBadge(status = project.status)
            }

            Spacer(modifier = Modifier.height(4.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Person,
                    contentDescription = null,
                    tint = BuildStockTextSecondary,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = project.clientName ?: "Client non spécifié",
                    fontSize = 13.sp,
                    color = BuildStockTextSecondary
                )
                if (!project.city.isNullOrBlank()) {
                    Text(" • ", color = BuildStockTextSecondary)
                    Text(project.city, fontSize = 13.sp, color = BuildStockTextSecondary)
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Budget Progress
            Row(
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = "Coût: ${String.format("%,.0f", currentCost)} MAD",
                    fontSize = 12.sp,
                    color = BuildStockNavy,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = "Budget: ${String.format("%,.0f", totalBudget)} MAD",
                    fontSize = 12.sp,
                    color = BuildStockTextSecondary
                )
            }

            Spacer(modifier = Modifier.height(6.dp))

            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp),
                color = if (progress > 0.9f) DangerRed else BuildStockBlue,
                trackColor = BuildStockBorder
            )
        }
    }
}

@Composable
fun CreateProjectDialog(
    onDismiss: () -> Unit,
    onSubmit: (ProjectCreateRequest) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var clientName by remember { mutableStateOf("") }
    var city by remember { mutableStateOf("") }
    var budgetStr by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Nouveau Projet de Chantier") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Nom du projet *") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = clientName,
                    onValueChange = { clientName = it },
                    label = { Text("Client") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = city,
                    onValueChange = { city = it },
                    label = { Text("Ville / Localisation") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = budgetStr,
                    onValueChange = { budgetStr = it },
                    label = { Text("Budget estimé (MAD)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description") },
                    maxLines = 3,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isNotBlank()) {
                        val budget = budgetStr.toDoubleOrNull()
                        onSubmit(
                            ProjectCreateRequest(
                                name = name.trim(),
                                clientName = clientName.trim().ifEmpty { null },
                                city = city.trim().ifEmpty { null },
                                totalBudget = budget,
                                description = description.trim().ifEmpty { null }
                            )
                        )
                    }
                },
                enabled = name.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = BuildStockNavy)
            ) {
                Text("Créer le projet")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Annuler")
            }
        }
    )
}
