package com.example.ui.screens.suppliers

import androidx.compose.foundation.background
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.PurchaseOrder
import com.example.data.model.Supplier
import com.example.ui.components.EmptyState
import com.example.ui.components.StatusBadge
import com.example.ui.theme.*

@Composable
fun SuppliersOrdersScreen(
    suppliers: List<Supplier>,
    purchaseOrders: List<PurchaseOrder>
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf("Fournisseurs (${suppliers.size})", "Commandes (${purchaseOrders.size})")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
    ) {
        TabRow(
            selectedTabIndex = selectedTab,
            containerColor = Color.Transparent,
            contentColor = BuildStockNavy
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

        Spacer(modifier = Modifier.height(14.dp))

        if (selectedTab == 0) {
            // Suppliers List
            if (suppliers.isEmpty()) {
                EmptyState(
                    title = "Aucun fournisseur enregistré",
                    message = "Ajoutez des fournisseurs pour gérer vos approvisionnements",
                    icon = Icons.Default.LocalShipping
                )
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    contentPadding = PaddingValues(bottom = 90.dp)
                ) {
                    items(suppliers) { supplier ->
                        SupplierCard(supplier)
                    }
                }
            }
        } else {
            // Purchase Orders List
            if (purchaseOrders.isEmpty()) {
                EmptyState(
                    title = "Aucune commande en cours",
                    message = "Vos bons de commande apparaîtront ici",
                    icon = Icons.Default.ReceiptLong
                )
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    contentPadding = PaddingValues(bottom = 90.dp)
                ) {
                    items(purchaseOrders) { order ->
                        PurchaseOrderCard(order)
                    }
                }
            }
        }
    }
}

@Composable
fun SupplierCard(supplier: Supplier) {
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
                    .background(BuildStockOrange.copy(alpha = 0.15f), RoundedCornerShape(10.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Storefront,
                    contentDescription = null,
                    tint = BuildStockOrange,
                    modifier = Modifier.size(22.dp)
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = supplier.name,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = BuildStockTextPrimary
                )
                if (!supplier.contactPerson.isNullOrBlank()) {
                    Text(
                        text = "Contact: ${supplier.contactPerson}",
                        fontSize = 12.sp,
                        color = BuildStockTextSecondary
                    )
                }
                if (!supplier.phone.isNullOrBlank()) {
                    Text(
                        text = "Tél: ${supplier.phone}",
                        fontSize = 12.sp,
                        color = BuildStockNavy,
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            if (!supplier.phone.isNullOrBlank()) {
                IconButton(onClick = {}) {
                    Icon(
                        imageVector = Icons.Default.Phone,
                        contentDescription = "Appeler",
                        tint = SuccessGreen
                    )
                }
            }
        }
    }
}

@Composable
fun PurchaseOrderCard(order: PurchaseOrder) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(14.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = order.orderNumber,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = BuildStockNavy
                )
                StatusBadge(status = order.status)
            }

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = "Fournisseur: ${order.supplier?.name ?: "Fournisseur standard"}",
                fontSize = 13.sp,
                color = BuildStockTextSecondary
            )

            if (order.totalAmount != null) {
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Montant total :",
                        fontSize = 13.sp,
                        color = BuildStockTextSecondary
                    )
                    Text(
                        text = "${String.format("%,.2f", order.totalAmount)} MAD",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = BuildStockOrange
                    )
                }
            }
        }
    }
}
