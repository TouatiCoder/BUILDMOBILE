package com.example.data.repository

import com.example.data.api.ApiClient
import com.example.data.api.BuildStockApiService
import com.example.data.model.*
import com.example.data.security.SessionManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class BuildStockRepository(
    private val sessionManager: SessionManager,
    private val apiClient: ApiClient
) {
    private var apiService: BuildStockApiService = apiClient.createService()

    fun refreshApiService() {
        apiService = apiClient.createService()
    }

    // --- Authentication ---

    suspend fun login(email: String, password: String): Result<User> = withContext(Dispatchers.IO) {
        try {
            refreshApiService()
            val response = apiService.login(LoginRequest(email.trim(), password))
            if (response.isSuccessful) {
                val body = response.body()
                if (body != null && body.user != null) {
                    sessionManager.currentUser = body.user
                    sessionManager.securityMethod = body.user.authMethod
                    Result.success(body.user)
                } else if (body?.code == "BIOMETRIC_REQUIRED") {
                    Result.failure(Exception("Connexion biométrique requise pour ce compte"))
                } else {
                    Result.failure(Exception(body?.error ?: "Échec de connexion"))
                }
            } else {
                val err = response.errorBody()?.string() ?: ""
                val msg = if (response.code() == 401) {
                    "Email ou mot de passe incorrect"
                } else if (response.code() == 403) {
                    "Connexion par mot de passe désactivée (Biométrie requise)"
                } else {
                    "Erreur serveur (${response.code()}): $err"
                }
                Result.failure(Exception(msg))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Erreur de connexion réseau: ${e.localizedMessage ?: "Serveur injoignable"}"))
        }
    }

    suspend fun refreshCurrentUser(): Result<User> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getMe()
            if (response.isSuccessful && response.body()?.user != null) {
                val user = response.body()!!.user!!
                sessionManager.currentUser = user
                sessionManager.securityMethod = user.authMethod
                Result.success(user)
            } else {
                // If token invalid, return cached user if present
                sessionManager.currentUser?.let { Result.success(it) }
                    ?: Result.failure(Exception("Session expirée"))
            }
        } catch (e: Exception) {
            sessionManager.currentUser?.let { Result.success(it) }
                ?: Result.failure(e)
        }
    }

    suspend fun logout() = withContext(Dispatchers.IO) {
        try {
            apiService.logout()
        } catch (_: Exception) {}
        sessionManager.clearSession()
    }

    // --- Security Settings ---

    suspend fun getSecurityMethod(): Result<SecurityMethodResponse> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getSecurityMethod()
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                sessionManager.securityMethod = body.authMethod
                Result.success(body)
            } else {
                Result.success(SecurityMethodResponse(authMethod = sessionManager.securityMethod))
            }
        } catch (e: Exception) {
            Result.success(SecurityMethodResponse(authMethod = sessionManager.securityMethod))
        }
    }

    suspend fun updateSecurityMethod(method: String): Result<SecurityMethodResponse> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.updateSecurityMethod(SecurityMethodUpdateRequest(method))
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                sessionManager.securityMethod = body.authMethod
                Result.success(body)
            } else {
                sessionManager.securityMethod = method
                Result.success(SecurityMethodResponse(authMethod = method, success = true))
            }
        } catch (e: Exception) {
            sessionManager.securityMethod = method
            Result.success(SecurityMethodResponse(authMethod = method, success = true))
        }
    }

    // --- Projects ---

    suspend fun getProjects(status: String? = null, search: String? = null): Result<List<Project>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getProjects(status, search)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.projects)
            } else {
                Result.success(emptyList())
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createProject(request: ProjectCreateRequest): Result<Project> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.createProject(request)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Impossible de créer le projet (${response.code()})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // --- Inventory & Materials ---

    suspend fun getInventory(): Result<List<InventoryItem>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getInventory()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.success(emptyList())
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getMaterials(): Result<List<MaterialItem>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getMaterials()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.success(emptyList())
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getWarehouses(): Result<List<Warehouse>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getWarehouses()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.success(emptyList())
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getStockMovements(): Result<List<StockMovement>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getStockMovements()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.success(emptyList())
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createStockMovement(request: StockMovementRequest): Result<StockMovement> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.createStockMovement(request)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Échec de l'enregistrement du mouvement (${response.code()})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // --- Calculators ---

    suspend fun getCalculations(type: String? = null): Result<List<CalculationRecord>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getCalculations(type)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.items)
            } else {
                Result.success(emptyList())
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun saveCalculation(request: CalculationSaveRequest): Result<CalculationRecord> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.saveCalculation(request)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Erreur de sauvegarde du calcul (${response.code()})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // --- Checklists ---

    suspend fun getChecklists(): Result<List<Checklist>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getChecklists()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.success(emptyList())
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateChecklistItem(checklistId: String, itemId: String, isChecked: Boolean): Result<ChecklistItem> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.updateChecklistItem(checklistId, itemId, mapOf("isChecked" to isChecked))
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Échec mise à jour élément"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // --- Suppliers & Orders ---

    suspend fun getSuppliers(): Result<List<Supplier>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getSuppliers()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.success(emptyList())
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getPurchaseOrders(): Result<List<PurchaseOrder>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getPurchaseOrders()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.success(emptyList())
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // --- Notifications ---

    suspend fun getNotifications(): Result<List<AppNotification>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getNotifications()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.success(emptyList())
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun markAllNotificationsAsRead() = withContext(Dispatchers.IO) {
        try {
            apiService.markAllNotificationsAsRead()
        } catch (_: Exception) {}
    }

    // --- Subscription ---

    suspend fun getSubscription(): Result<SubscriptionDetails> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getSubscription()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.success(SubscriptionDetails())
            }
        } catch (e: Exception) {
            Result.success(SubscriptionDetails())
        }
    }
}
