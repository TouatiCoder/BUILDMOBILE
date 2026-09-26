package com.example.data.api

import com.example.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface BuildStockApiService {

    // Authentication
    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>

    @GET("api/auth/me")
    suspend fun getMe(): Response<AuthMeResponse>

    @POST("api/auth/logout")
    suspend fun logout(): Response<Unit>

    @GET("api/auth/security-method")
    suspend fun getSecurityMethod(): Response<SecurityMethodResponse>

    @PUT("api/auth/security-method")
    suspend fun updateSecurityMethod(@Body request: SecurityMethodUpdateRequest): Response<SecurityMethodResponse>

    // Projects
    @GET("api/projects")
    suspend fun getProjects(
        @Query("status") status: String? = null,
        @Query("search") search: String? = null
    ): Response<ProjectsResponse>

    @POST("api/projects")
    suspend fun createProject(@Body request: ProjectCreateRequest): Response<Project>

    @GET("api/projects/{id}")
    suspend fun getProjectDetails(@Path("id") id: String): Response<Project>

    // Inventory & Materials
    @GET("api/inventory")
    suspend fun getInventory(): Response<List<InventoryItem>>

    @GET("api/materials")
    suspend fun getMaterials(): Response<List<MaterialItem>>

    @POST("api/materials")
    suspend fun createMaterial(@Body material: MaterialItem): Response<MaterialItem>

    // Warehouses
    @GET("api/warehouses")
    suspend fun getWarehouses(): Response<List<Warehouse>>

    @POST("api/warehouses")
    suspend fun createWarehouse(@Body warehouse: Warehouse): Response<Warehouse>

    // Suppliers & Purchase Orders
    @GET("api/suppliers")
    suspend fun getSuppliers(): Response<List<Supplier>>

    @POST("api/suppliers")
    suspend fun createSupplier(@Body supplier: Supplier): Response<Supplier>

    @GET("api/purchase-orders")
    suspend fun getPurchaseOrders(): Response<List<PurchaseOrder>>

    @POST("api/purchase-orders")
    suspend fun createPurchaseOrder(@Body order: PurchaseOrder): Response<PurchaseOrder>

    // Stock Movements
    @GET("api/stock/movements")
    suspend fun getStockMovements(): Response<List<StockMovement>>

    @POST("api/stock/movements")
    suspend fun createStockMovement(@Body movement: StockMovementRequest): Response<StockMovement>

    // Tools & Calculations
    @GET("api/tools/calculations")
    suspend fun getCalculations(
        @Query("type") toolType: String? = null
    ): Response<CalculationsResponse>

    @POST("api/tools/calculations")
    suspend fun saveCalculation(
        @Body calculation: CalculationSaveRequest
    ): Response<CalculationRecord>

    // Checklists
    @GET("api/checklists")
    suspend fun getChecklists(): Response<List<Checklist>>

    @PATCH("api/checklists/{id}/items/{itemId}")
    suspend fun updateChecklistItem(
        @Path("id") checklistId: String,
        @Path("itemId") itemId: String,
        @Body body: Map<String, Boolean>
    ): Response<ChecklistItem>

    // Notifications
    @GET("api/notifications")
    suspend fun getNotifications(): Response<List<AppNotification>>

    @PUT("api/notifications/read-all")
    suspend fun markAllNotificationsAsRead(): Response<Unit>

    // Subscriptions
    @GET("api/subscription")
    suspend fun getSubscription(): Response<SubscriptionDetails>
}
