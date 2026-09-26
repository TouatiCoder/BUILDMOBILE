package com.example.ui.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.SubscriptionDetails
import com.example.data.model.User
import com.example.ui.theme.*

@Composable
fun ProfileSettingsScreen(
    user: User?,
    subscription: SubscriptionDetails,
    serverUrl: String,
    onNavigateToSecurity: () -> Unit,
    onNavigateToSuppliersOrders: () -> Unit,
    onUpdateServerUrl: (String) -> Unit,
    onLogoutClick: () -> Unit
) {
    var showUrlDialog by remember { mutableStateOf(false) }
    var urlInput by remember { mutableStateOf(serverUrl) }

    if (showUrlDialog) {
        AlertDialog(
            onDismissRequest = { showUrlDialog = false },
            title = { Text("URL du Serveur API") },
            text = {
                OutlinedTextField(
                    value = urlInput,
                    onValueChange = { urlInput = it },
                    label = { Text("Adresse du serveur") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        onUpdateServerUrl(urlInput)
                        showUrlDialog = false
                    }
                ) {
                    Text("Enregistrer")
                }
            },
            dismissButton = {
                TextButton(onClick = { showUrlDialog = false }) { Text("Annuler") }
            }
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // User Profile Header Card
        Card(
            colors = CardDefaults.cardColors(containerColor = BuildStockNavy),
            shape = RoundedCornerShape(20.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier.padding(20.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(54.dp)
                        .background(BuildStockOrange, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = (user?.firstName?.take(1) ?: "U").uppercase(),
                        color = Color.White,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.width(16.dp))

                Column {
                    Text(
                        text = user?.fullName ?: "Utilisateur",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        text = user?.email ?: "",
                        fontSize = 13.sp,
                        color = Color.White.copy(alpha = 0.8f)
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    val roleLabel = when (user?.role) {
                        "admin" -> "Administrateur"
                        "site_manager" -> "Chef de Chantier"
                        "structural_engineer" -> "Ingénieur Structure"
                        else -> "Membre de l'équipe"
                    }
                    Text(
                        text = "Rôle: $roleLabel",
                        fontSize = 12.sp,
                        color = BuildStockOrangeLight,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        // Subscription Card
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
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Abonnement BuildStock", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = BuildStockNavy)
                    Surface(
                        color = SuccessGreen.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = subscription.status.uppercase(),
                            color = SuccessGreen,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = "Formule : ${subscription.planCode.replaceFirstChar { it.uppercase() }}",
                    fontSize = 13.sp,
                    color = BuildStockTextPrimary,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = "Accès complet aux modules Projets, Stocks, Calculatrices & Biométrie",
                    fontSize = 12.sp,
                    color = BuildStockTextSecondary
                )
            }
        }

        // Menu Actions
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            shape = RoundedCornerShape(16.dp),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column {
                SettingsMenuItem(
                    icon = Icons.Default.Security,
                    title = "Sécurité & Biométrie",
                    subtitle = "Face ID, empreinte, méthode de connexion",
                    onClick = onNavigateToSecurity,
                    modifier = Modifier.testTag("menu_security_settings")
                )
                HorizontalDivider(color = BuildStockBorder)
                SettingsMenuItem(
                    icon = Icons.Default.LocalShipping,
                    title = "Fournisseurs & Commandes",
                    subtitle = "Annuaire fournisseurs et bons d'achat",
                    onClick = onNavigateToSuppliersOrders
                )
                HorizontalDivider(color = BuildStockBorder)
                SettingsMenuItem(
                    icon = Icons.Default.Dns,
                    title = "Serveur Backend",
                    subtitle = serverUrl,
                    onClick = { showUrlDialog = true }
                )
            }
        }

        // Logout Button
        Button(
            onClick = onLogoutClick,
            colors = ButtonDefaults.buttonColors(containerColor = DangerRed.copy(alpha = 0.1f)),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp)
                .testTag("logout_button")
        ) {
            Icon(imageVector = Icons.Default.Logout, contentDescription = null, tint = DangerRed)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Se déconnecter", color = DangerRed, fontWeight = FontWeight.SemiBold)
        }

        Spacer(modifier = Modifier.height(60.dp))
    }
}

@Composable
fun SettingsMenuItem(
    icon: ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(38.dp)
                .background(BuildStockNavy.copy(alpha = 0.08f), RoundedCornerShape(10.dp)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = BuildStockNavy,
                modifier = Modifier.size(20.dp)
            )
        }

        Spacer(modifier = Modifier.width(14.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = BuildStockTextPrimary)
            Text(subtitle, fontSize = 12.sp, color = BuildStockTextSecondary, maxLines = 1)
        }

        Icon(
            imageVector = Icons.Default.ChevronRight,
            contentDescription = null,
            tint = BuildStockTextSecondary,
            modifier = Modifier.size(20.dp)
        )
    }
}
