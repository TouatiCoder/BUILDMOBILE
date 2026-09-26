package com.example.data.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class User(
    val id: String,
    val email: String,
    val firstName: String? = null,
    val lastName: String? = null,
    val role: String = "user",
    val companyId: String,
    val isPlatformAdmin: Boolean = false,
    val authMethod: String = "password_only", // password_only | biometric_only | biometric_password
    val phone: String? = null,
    val lastLoginAt: String? = null,
    val subscriptionStatus: String? = null,
    val subscriptionTrialEndsAt: String? = null
) {
    val fullName: String
        get() = "${firstName ?: ""} ${lastName ?: ""}".trim().ifEmpty { email }
}

@JsonClass(generateAdapter = true)
data class LoginRequest(
    val email: String,
    val password: String
)

@JsonClass(generateAdapter = true)
data class LoginResponse(
    val success: Boolean = false,
    val user: User? = null,
    val error: String? = null,
    val code: String? = null,
    val previousLoginAt: String? = null,
    val subscriptionStatus: String? = null,
    val subscriptionTrialEndsAt: String? = null
)

@JsonClass(generateAdapter = true)
data class AuthMeResponse(
    val user: User? = null,
    val error: String? = null
)

@JsonClass(generateAdapter = true)
data class SecurityMethodResponse(
    val authMethod: String = "password_only",
    val hasBiometric: Boolean = false,
    val success: Boolean? = null,
    val error: String? = null
)

@JsonClass(generateAdapter = true)
data class SecurityMethodUpdateRequest(
    val authMethod: String // password_only | biometric_only | biometric_password
)

@JsonClass(generateAdapter = true)
data class Project(
    val id: String,
    val name: String,
    val description: String? = null,
    val clientName: String? = null,
    val clientEmail: String? = null,
    val clientPhone: String? = null,
    val address: String? = null,
    val city: String? = null,
    val postalCode: String? = null,
    val projectType: String? = null,
    val status: String = "planning", // planning | active | in_progress | completed | on_hold
    val startDate: String? = null,
    val endDate: String? = null,
    val totalBudget: Double? = null,
    val currentCost: Double? = null,
    val companyId: String? = null,
    val createdAt: String? = null
)

@JsonClass(generateAdapter = true)
data class ProjectsResponse(
    val projects: List<Project> = emptyList(),
    val totalProjects: Int = 0
)

@JsonClass(generateAdapter = true)
data class ProjectCreateRequest(
    val name: String,
    val description: String? = null,
    val clientName: String? = null,
    val clientPhone: String? = null,
    val city: String? = null,
    val status: String = "planning",
    val totalBudget: Double? = null
)

@JsonClass(generateAdapter = true)
data class MaterialItem(
    val id: String,
    val name: String,
    val description: String? = null,
    val unit: String = "u",
    val unitPrice: Double? = null,
    val category: String? = null,
    val supplierId: String? = null,
    val companyId: String? = null,
    val createdAt: String? = null
)

@JsonClass(generateAdapter = true)
data class InventoryItem(
    val id: String,
    val quantity: Double = 0.0,
    val minThreshold: Double? = 0.0,
    val maxThreshold: Double? = null,
    val materialId: String,
    val warehouseId: String? = null,
    val material: MaterialItem? = null,
    val warehouse: Warehouse? = null
)

@JsonClass(generateAdapter = true)
data class Warehouse(
    val id: String,
    val name: String,
    val location: String? = null,
    val capacity: Double? = null,
    val isMain: Boolean = false,
    val isActive: Boolean = true
)

@JsonClass(generateAdapter = true)
data class Supplier(
    val id: String,
    val name: String,
    val contactPerson: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val address: String? = null,
    val isActive: Boolean = true
)

@JsonClass(generateAdapter = true)
data class StockMovement(
    val id: String,
    val projectId: String? = null,
    val materialId: String,
    val movementType: String, // IN | OUT | TRANSFER
    val quantity: Double,
    val description: String? = null,
    val movementDate: String? = null,
    val material: MaterialItem? = null,
    val sourceWarehouseId: String? = null,
    val destinationWarehouseId: String? = null
)

@JsonClass(generateAdapter = true)
data class StockMovementRequest(
    val materialId: String,
    val movementType: String, // IN | OUT | TRANSFER
    val quantity: Double,
    val description: String? = null,
    val projectId: String? = null,
    val sourceWarehouseId: String? = null,
    val destinationWarehouseId: String? = null
)

@JsonClass(generateAdapter = true)
data class PurchaseOrderItem(
    val id: String? = null,
    val quantity: Double,
    val unitPrice: Double,
    val totalPrice: Double,
    val notes: String? = null,
    val materialId: String,
    val material: MaterialItem? = null
)

@JsonClass(generateAdapter = true)
data class PurchaseOrder(
    val id: String,
    val orderNumber: String,
    val status: String = "pending", // pending | approved | delivered | cancelled
    val totalAmount: Double? = null,
    val orderDate: String? = null,
    val expectedDelivery: String? = null,
    val supplierId: String? = null,
    val supplier: Supplier? = null,
    val items: List<PurchaseOrderItem> = emptyList()
)

@JsonClass(generateAdapter = true)
data class ChecklistItem(
    val id: String,
    val checklistId: String? = null,
    val label: String,
    val isChecked: Boolean = false,
    val position: Int = 0
)

@JsonClass(generateAdapter = true)
data class Checklist(
    val id: String,
    val title: String,
    val checklistType: String = "general", // safety | daily | quality | equipment | general
    val status: String = "in_progress", // in_progress | completed
    val completedAt: String? = null,
    val projectId: String? = null,
    val items: List<ChecklistItem> = emptyList()
)

@JsonClass(generateAdapter = true)
data class CalculationRecord(
    val id: String,
    val toolType: String, // concrete | steel | formwork | mesh
    val input: Map<String, Any?> = emptyMap(),
    val output: Map<String, Any?> = emptyMap(),
    val notes: String? = null,
    val projectId: String? = null,
    val createdAt: String? = null
)

@JsonClass(generateAdapter = true)
data class CalculationSaveRequest(
    val toolType: String,
    val input: Map<String, Any?>,
    val output: Map<String, Any?>,
    val notes: String? = null,
    val projectId: String? = null
)

@JsonClass(generateAdapter = true)
data class CalculationsResponse(
    val items: List<CalculationRecord> = emptyList()
)

@JsonClass(generateAdapter = true)
data class AppNotification(
    val id: String,
    val type: String,
    val title: String,
    val message: String,
    val isRead: Boolean = false,
    val createdAt: String? = null
)

@JsonClass(generateAdapter = true)
data class SubscriptionDetails(
    val planCode: String = "free",
    val status: String = "active",
    val trialEndsAt: String? = null,
    val currentPeriodEnd: String? = null,
    val features: List<String> = emptyList()
)
