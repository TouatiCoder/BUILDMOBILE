package com.example.ui.screens.notifications

import androidx.compose.foundation.background
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.AppNotification
import com.example.ui.components.EmptyState
import com.example.ui.theme.*

@Composable
fun NotificationsScreen(
    notifications: List<AppNotification>,
    onMarkAllRead: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Notifications Récentes",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = BuildStockNavy
            )
            if (notifications.any { !it.isRead }) {
                TextButton(onClick = onMarkAllRead) {
                    Text("Tout marquer comme lu", color = BuildStockOrange)
                }
            }
        }

        if (notifications.isEmpty()) {
            EmptyState(
                title = "Aucune notification",
                message = "Vous êtes à jour dans vos alertes de chantier",
                icon = Icons.Default.NotificationsNone
            )
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                contentPadding = PaddingValues(bottom = 90.dp)
            ) {
                items(notifications) { notif ->
                    NotificationCard(notif)
                }
            }
        }
    }
}

@Composable
fun NotificationCard(notif: AppNotification) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = if (notif.isRead) MaterialTheme.colorScheme.surface else BuildStockOrange.copy(alpha = 0.05f)
        ),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.Top
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .background(
                        if (notif.isRead) BuildStockNavy.copy(alpha = 0.1f) else BuildStockOrange.copy(alpha = 0.2f),
                        RoundedCornerShape(8.dp)
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = when {
                        notif.type.contains("stock", ignoreCase = true) -> Icons.Default.Warning
                        notif.type.contains("login", ignoreCase = true) -> Icons.Default.Security
                        else -> Icons.Default.Notifications
                    },
                    contentDescription = null,
                    tint = if (notif.isRead) BuildStockNavy else BuildStockOrange,
                    modifier = Modifier.size(20.dp)
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = notif.title,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = BuildStockTextPrimary
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = notif.message,
                    fontSize = 12.sp,
                    color = BuildStockTextSecondary
                )
            }

            if (!notif.isRead) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .background(BuildStockOrange, RoundedCornerShape(4.dp))
                )
            }
        }
    }
}
