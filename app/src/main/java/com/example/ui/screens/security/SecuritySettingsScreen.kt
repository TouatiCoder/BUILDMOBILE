package com.example.ui.screens.security

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.security.BiometricAuthManager
import com.example.ui.theme.*

@Composable
fun SecuritySettingsScreen(
    biometricStatus: BiometricAuthManager.BiometricStatus,
    isBiometricEnabledLocally: Boolean,
    currentSecurityMethod: String, // password_only | biometric_password | biometric_only
    isUpdating: Boolean,
    onToggleLocalBiometrics: (Boolean) -> Unit,
    onChangeSecurityMethod: (String) -> Unit,
    onTestBiometricPrompt: () -> Unit
) {
    var selectedMethod by remember(currentSecurityMethod) { mutableStateOf(currentSecurityMethod) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Biometric Status Header
        Card(
            colors = CardDefaults.cardColors(containerColor = BuildStockNavy),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(18.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column {
                        Text(
                            text = "Sécurité & Biométrie",
                            color = Color.White,
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Protection renforcée de votre session mobile",
                            color = Color.White.copy(alpha = 0.7f),
                            fontSize = 13.sp
                        )
                    }

                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .background(BuildStockOrange.copy(alpha = 0.2f), RoundedCornerShape(12.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Fingerprint,
                            contentDescription = null,
                            tint = BuildStockOrangeLight,
                            modifier = Modifier.size(28.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
                HorizontalDivider(color = Color.White.copy(alpha = 0.15f))
                Spacer(modifier = Modifier.height(12.dp))

                val statusLabel = when (biometricStatus) {
                    BiometricAuthManager.BiometricStatus.AVAILABLE -> "Capteur biométrique prêt (Face / Empreinte)"
                    BiometricAuthManager.BiometricStatus.NOT_ENROLLED -> "Aucune empreinte configurée sur l'appareil"
                    BiometricAuthManager.BiometricStatus.NO_HARDWARE -> "Pas de capteur biométrique détecté"
                    BiometricAuthManager.BiometricStatus.HW_UNAVAILABLE -> "Capteur temporairement indisponible"
                }

                val statusColor = if (biometricStatus == BiometricAuthManager.BiometricStatus.AVAILABLE) SuccessGreen else SafetyAmber

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = if (biometricStatus == BiometricAuthManager.BiometricStatus.AVAILABLE) Icons.Default.CheckCircle else Icons.Default.Warning,
                        contentDescription = null,
                        tint = statusColor,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = statusLabel,
                        color = Color.White,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }

        // Local Biometric Unlock Toggle Card
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
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Déverrouillage Biométrique Local",
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = BuildStockTextPrimary
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Déverrouillez BuildStock instantanément à l'ouverture de l'application",
                            fontSize = 12.sp,
                            color = BuildStockTextSecondary
                        )
                    }

                    Switch(
                        checked = isBiometricEnabledLocally,
                        onCheckedChange = { onToggleLocalBiometrics(it) },
                        enabled = biometricStatus == BiometricAuthManager.BiometricStatus.AVAILABLE,
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = SuccessGreen
                        ),
                        modifier = Modifier.testTag("toggle_biometric_switch")
                    )
                }

                if (isBiometricEnabledLocally) {
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedButton(
                        onClick = onTestBiometricPrompt,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.VerifiedUser, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Tester le capteur biométrique")
                    }
                }
            }
        }

        // Server Security Method Card (Synchronized with /api/auth/security-method)
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            shape = RoundedCornerShape(16.dp),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = "Politique d'Authentification Serveur",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = BuildStockNavy
                )
                Text(
                    text = "Sélectionnez la méthode autorisée par le backend pour ce compte :",
                    fontSize = 12.sp,
                    color = BuildStockTextSecondary
                )

                HorizontalDivider(color = BuildStockBorder)

                // Option 1: Password only
                SecurityOptionItem(
                    title = "Mot de passe uniquement",
                    description = "Connexion standard avec identifiant et mot de passe",
                    methodKey = "password_only",
                    isSelected = selectedMethod == "password_only",
                    onSelect = {
                        selectedMethod = "password_only"
                        onChangeSecurityMethod("password_only")
                    }
                )

                // Option 2: Biometric + Password
                SecurityOptionItem(
                    title = "Biométrie + Mot de passe",
                    description = "Connexion flexible par empreinte/Face ID ou mot de passe",
                    methodKey = "biometric_password",
                    isSelected = selectedMethod == "biometric_password",
                    onSelect = {
                        selectedMethod = "biometric_password"
                        onChangeSecurityMethod("biometric_password")
                    }
                )

                // Option 3: Biometric only
                SecurityOptionItem(
                    title = "Biométrie uniquement",
                    description = "Mot de passe bloqué côté serveur. Biométrie obligatoire.",
                    methodKey = "biometric_only",
                    isSelected = selectedMethod == "biometric_only",
                    onSelect = {
                        selectedMethod = "biometric_only"
                        onChangeSecurityMethod("biometric_only")
                    }
                )

                if (isUpdating) {
                    LinearProgressIndicator(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 8.dp),
                        color = BuildStockOrange
                    )
                }
            }
        }

        // Technical Notice / Security Architecture
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(modifier = Modifier.padding(14.dp)) {
                Icon(
                    imageVector = Icons.Default.Security,
                    contentDescription = null,
                    tint = BuildStockNavy,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = "Architecture Cryptographique",
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.sp,
                        color = BuildStockNavy
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Les jetons de session sont protégés dans le Keystore sécurisé de l'appareil. Le déverrouillage biométrique native ne transmet jamais vos données biométriques sur le réseau et s'interface avec l'API WebAuthn / JWT de BuildStock.",
                        fontSize = 11.sp,
                        color = BuildStockTextSecondary,
                        lineHeight = 16.sp
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(40.dp))
    }
}

@Composable
fun SecurityOptionItem(
    title: String,
    description: String,
    methodKey: String,
    isSelected: Boolean,
    onSelect: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) BuildStockNavy.copy(alpha = 0.08f) else Color.Transparent
        ),
        shape = RoundedCornerShape(10.dp),
        border = if (isSelected) androidx.compose.foundation.BorderStroke(1.5.dp, BuildStockNavy) else null,
        onClick = onSelect,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            RadioButton(
                selected = isSelected,
                onClick = onSelect,
                colors = RadioButtonDefaults.colors(selectedColor = BuildStockNavy)
            )
            Spacer(modifier = Modifier.width(10.dp))
            Column {
                Text(title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = BuildStockTextPrimary)
                Text(description, fontSize = 11.sp, color = BuildStockTextSecondary)
            }
        }
    }
}
