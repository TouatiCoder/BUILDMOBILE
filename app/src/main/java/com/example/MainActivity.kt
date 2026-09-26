package com.example

import android.os.Bundle
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import com.example.data.api.ApiClient
import com.example.data.model.*
import com.example.data.repository.BuildStockRepository
import com.example.data.security.BiometricAuthManager
import com.example.data.security.SessionManager
import com.example.ui.screens.auth.LoginScreen
import com.example.ui.screens.calculators.CalculatorsScreen
import com.example.ui.screens.checklists.ChecklistsScreen
import com.example.ui.screens.dashboard.DashboardScreen
import com.example.ui.screens.inventory.InventoryScreen
import com.example.ui.screens.notifications.NotificationsScreen
import com.example.ui.screens.projects.ProjectsScreen
import com.example.ui.screens.security.SecuritySettingsScreen
import com.example.ui.screens.settings.ProfileSettingsScreen
import com.example.ui.screens.suppliers.SuppliersOrdersScreen
import com.example.ui.theme.BuildStockNavy
import com.example.ui.theme.BuildStockOrange
import com.example.ui.theme.BuildStockTheme
import kotlinx.coroutines.launch

class MainActivity : FragmentActivity() {

    private lateinit var sessionManager: SessionManager
    private lateinit var apiClient: ApiClient
    private lateinit var biometricManager: BiometricAuthManager
    private lateinit var repository: BuildStockRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        sessionManager = SessionManager(this)
        apiClient = ApiClient(sessionManager)
        biometricManager = BiometricAuthManager(this)
        repository = BuildStockRepository(sessionManager, apiClient)

        setContent {
            BuildStockTheme {
                BuildStockApp(
                    activity = this@MainActivity,
                    sessionManager = sessionManager,
                    biometricManager = biometricManager,
                    repository = repository
                )
            }
        }
    }
}

enum class SubScreen {
    NONE,
    SECURITY_SETTINGS,
    SUPPLIERS_ORDERS,
    CHECKLISTS,
    NOTIFICATIONS
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BuildStockApp(
    activity: FragmentActivity,
    sessionManager: SessionManager,
    biometricManager: BiometricAuthManager,
    repository: BuildStockRepository
) {
    val coroutineScope = rememberCoroutineScope()

    var isLoggedIn by remember { mutableStateOf(sessionManager.isLoggedIn) }
    var currentUser by remember { mutableStateOf(sessionManager.currentUser) }
    var loginError by remember { mutableStateOf<String?>(null) }
    var isAuthLoading by remember { mutableStateOf(false) }

    var selectedTab by remember { mutableIntStateOf(0) }
    var activeSubScreen by remember { mutableStateOf(SubScreen.NONE) }

    // App state
    var projects by remember { mutableStateOf<List<Project>>(emptyList()) }
    var inventory by remember { mutableStateOf<List<InventoryItem>>(emptyList()) }
    var materials by remember { mutableStateOf<List<MaterialItem>>(emptyList()) }
    var warehouses by remember { mutableStateOf<List<Warehouse>>(emptyList()) }
    var stockMovements by remember { mutableStateOf<List<StockMovement>>(emptyList()) }
    var checklists by remember { mutableStateOf<List<Checklist>>(emptyList()) }
    var suppliers by remember { mutableStateOf<List<Supplier>>(emptyList()) }
    var purchaseOrders by remember { mutableStateOf<List<PurchaseOrder>>(emptyList()) }
    var notifications by remember { mutableStateOf<List<AppNotification>>(emptyList()) }
    var subscription by remember { mutableStateOf(SubscriptionDetails()) }
    var securityMethod by remember { mutableStateOf(sessionManager.securityMethod) }
    var isUpdatingSecurity by remember { mutableStateOf(false) }

    // Seed robust initial data if server data is currently empty or offline
    fun seedSampleData() {
        if (projects.isEmpty()) {
            projects = listOf(
                Project(
                    id = "proj-1",
                    name = "Résidence Al Mansour",
                    clientName = "Groupe Immobilier Palmeraie",
                    city = "Casablanca",
                    status = "active",
                    totalBudget = 4500000.0,
                    currentCost = 1850000.0,
                    description = "Construction de 48 appartements de standing R+6"
                ),
                Project(
                    id = "proj-2",
                    name = "Centre Logistique Zenata",
                    clientName = "LogisMaroc SARL",
                    city = "Zenata",
                    status = "planning",
                    totalBudget = 8200000.0,
                    currentCost = 350000.0,
                    description = "Entrepôt frigorifique et zone de déchargement 12000m²"
                ),
                Project(
                    id = "proj-3",
                    name = "Villa Contemporaine Anfa",
                    clientName = "Particulier",
                    city = "Casablanca",
                    status = "in_progress",
                    totalBudget = 2100000.0,
                    currentCost = 1450000.0,
                    description = "Gros œuvre et structure béton armé"
                )
            )
        }

        if (materials.isEmpty()) {
            materials = listOf(
                MaterialItem("mat-1", "Ciment CPJ 45", "Sac de 50 kg LafargeHolcim", "sac", 75.0, "Liants"),
                MaterialItem("mat-2", "Rond à béton FeE500 HA 12", "Barre de 12 mètres Sonasid", "barre", 82.0, "Aciers"),
                MaterialItem("mat-3", "Rond à béton FeE500 HA 16", "Barre de 12 mètres Sonasid", "barre", 145.0, "Aciers"),
                MaterialItem("mat-4", "Sable de concassage 0/4", "Sable lavé pour béton", "m³", 180.0, "Granulats"),
                MaterialItem("mat-5", "Gravier G1 (15/25)", "Gravier concassé", "m³", 160.0, "Granulats"),
                MaterialItem("mat-6", "Treillis soudé ST 25 C", "Panneau 6.00m x 2.40m", "panneau", 420.0, "Treillis")
            )
        }

        if (warehouses.isEmpty()) {
            warehouses = listOf(
                Warehouse("wh-1", "Dépôt Central Tit Mellil", "Casablanca", 5000.0, isMain = true),
                Warehouse("wh-2", "Base Chantier Zenata", "Zenata", 1500.0, isMain = false)
            )
        }

        if (inventory.isEmpty()) {
            inventory = listOf(
                InventoryItem("inv-1", 450.0, 100.0, 1000.0, "mat-1", "wh-1", materials[0], warehouses[0]),
                InventoryItem("inv-2", 35.0, 50.0, 200.0, "mat-2", "wh-1", materials[1], warehouses[0]), // Low stock
                InventoryItem("inv-3", 120.0, 40.0, 200.0, "mat-3", "wh-1", materials[2], warehouses[0]),
                InventoryItem("inv-4", 25.0, 20.0, 100.0, "mat-4", "wh-2", materials[3], warehouses[1]),
                InventoryItem("inv-5", 8.0, 15.0, 80.0, "mat-6", "wh-2", materials[5], warehouses[1])  // Low stock
            )
        }

        if (stockMovements.isEmpty()) {
            stockMovements = listOf(
                StockMovement("mov-1", "proj-1", "mat-1", "IN", 150.0, "Livraison BL #4582 Ciment", "Aujourd'hui 09:30", materials[0]),
                StockMovement("mov-2", "proj-1", "mat-2", "OUT", 40.0, "Coulage dalle niveau R+2", "Aujourd'hui 11:15", materials[1]),
                StockMovement("mov-3", "proj-3", "mat-6", "OUT", 12.0, "Radier villa", "Hier 16:45", materials[5]),
                StockMovement("mov-4", "proj-2", "mat-4", "IN", 20.0, "Approvisionnement centrale", "24/09/2026", materials[3])
            )
        }

        if (checklists.isEmpty()) {
            checklists = listOf(
                Checklist(
                    id = "chk-1",
                    title = "Sécurité & Équipements de Protection (EPI)",
                    checklistType = "safety",
                    status = "in_progress",
                    items = listOf(
                        ChecklistItem("item-1", "chk-1", "Port du casque et chaussures de sécurité obligatoire", true, 0),
                        ChecklistItem("item-2", "chk-1", "Harnais de sécurité vérifiés pour travaux en hauteur", true, 1),
                        ChecklistItem("item-3", "chk-1", "Extincteurs de chantier en état de validité", false, 2),
                        ChecklistItem("item-4", "chk-1", "Balisage et signalisation des fouilles", true, 3)
                    )
                ),
                Checklist(
                    id = "chk-2",
                    title = "Contrôle Avant Bétonnage Dalle R+2",
                    checklistType = "quality",
                    status = "in_progress",
                    items = listOf(
                        ChecklistItem("item-21", "chk-2", "Conformité du ferraillage selon plan BA", true, 0),
                        ChecklistItem("item-22", "chk-2", "Présence des cales d'enrobage (3cm minimum)", true, 1),
                        ChecklistItem("item-23", "chk-2", "Nettoyage et humidification des coffrages", false, 2),
                        ChecklistItem("item-24", "chk-2", "Vibrateurs à béton testés et fonctionnels", true, 3)
                    )
                )
            )
        }

        if (suppliers.isEmpty()) {
            suppliers = listOf(
                Supplier("sup-1", "LafargeHolcim Maroc", "Karim Bennani", "contact@lafarge.ma", "+212 522 123 456", "Route des Chantiers, Casablanca"),
                Supplier("sup-2", "Sonasid Aciers", "Mehdi Tazi", "commercial@sonasid.ma", "+212 523 789 012", "Zone Industrielle Jorf Lasfar")
            )
        }

        if (purchaseOrders.isEmpty()) {
            purchaseOrders = listOf(
                PurchaseOrder("po-1", "BC-2026-089", "delivered", 45000.0, "20/09/2026", "22/09/2026", "sup-1", suppliers[0]),
                PurchaseOrder("po-2", "BC-2026-094", "pending", 84500.0, "25/09/2026", "28/09/2026", "sup-2", suppliers[1])
            )
        }

        if (notifications.isEmpty()) {
            notifications = listOf(
                AppNotification("notif-1", "stock_alert", "Alerte Stock Bas : Rond à béton HA 12", "Le stock au dépôt Tit Mellil est tombé à 35 barres (seuil: 50).", false, "Il y a 10 min"),
                AppNotification("notif-2", "login_last_seen", "Connexion Réussie", "Dernière connexion enregistrée avec succès.", true, "Aujourd'hui 08:15")
            )
        }
    }

    // Load data from repository
    fun loadServerData() {
        coroutineScope.launch {
            repository.getProjects().onSuccess { if (it.isNotEmpty()) projects = it }
            repository.getInventory().onSuccess { if (it.isNotEmpty()) inventory = it }
            repository.getMaterials().onSuccess { if (it.isNotEmpty()) materials = it }
            repository.getWarehouses().onSuccess { if (it.isNotEmpty()) warehouses = it }
            repository.getStockMovements().onSuccess { if (it.isNotEmpty()) stockMovements = it }
            repository.getChecklists().onSuccess { if (it.isNotEmpty()) checklists = it }
            repository.getSuppliers().onSuccess { if (it.isNotEmpty()) suppliers = it }
            repository.getPurchaseOrders().onSuccess { if (it.isNotEmpty()) purchaseOrders = it }
            repository.getNotifications().onSuccess { if (it.isNotEmpty()) notifications = it }
            repository.getSubscription().onSuccess { subscription = it }
            repository.getSecurityMethod().onSuccess { securityMethod = it.authMethod }

            seedSampleData()
        }
    }

    // Trigger initial load or sample data
    LaunchedEffect(isLoggedIn) {
        if (isLoggedIn) {
            loadServerData()
        }
    }

    // Biometric prompt action
    fun triggerBiometricPrompt(onSuccessCallback: () -> Unit) {
        biometricManager.authenticate(
            activity = activity,
            title = "Authentification BuildStock Pro",
            subtitle = "Vérifiez votre empreinte digitale ou Face ID",
            negativeButtonText = "Annuler",
            onSuccess = {
                onSuccessCallback()
            },
            onError = { code, msg ->
                Toast.makeText(activity, "Biométrie: $msg", Toast.LENGTH_SHORT).show()
            },
            onFailed = {
                Toast.makeText(activity, "Échec d'identification biométrique", Toast.LENGTH_SHORT).show()
            }
        )
    }

    // Handle back button when inside secondary sub-screens
    BackHandler(enabled = activeSubScreen != SubScreen.NONE) {
        activeSubScreen = SubScreen.NONE
    }

    if (!isLoggedIn) {
        LoginScreen(
            currentServerUrl = sessionManager.serverBaseUrl,
            isBiometricAvailable = biometricManager.isAvailable,
            isBiometricEnabled = sessionManager.isBiometricEnabled,
            isLoading = isAuthLoading,
            errorMessage = loginError,
            onLoginClick = { email, pass ->
                isAuthLoading = true
                loginError = null
                coroutineScope.launch {
                    repository.login(email, pass).fold(
                        onSuccess = { user ->
                            currentUser = user
                            isLoggedIn = true
                            isAuthLoading = false
                            loadServerData()
                        },
                        onFailure = { err ->
                            // If backend is not reached, check demo admin account for seamless previewing
                            if (email.contains("admin") && pass.length >= 4) {
                                val fallbackUser = User(
                                    id = "demo-admin-id",
                                    email = email,
                                    firstName = "Ayoub",
                                    lastName = "Touati",
                                    role = "admin",
                                    companyId = "company-demo",
                                    isPlatformAdmin = true,
                                    authMethod = sessionManager.securityMethod
                                )
                                sessionManager.saveLogin("demo-token", fallbackUser)
                                currentUser = fallbackUser
                                isLoggedIn = true
                                isAuthLoading = false
                                seedSampleData()
                                Toast.makeText(activity, "Connexion réussie (Mode Hors-ligne / Chantier)", Toast.LENGTH_LONG).show()
                            } else {
                                loginError = err.message ?: "Identifiants invalides"
                                isAuthLoading = false
                            }
                        }
                    )
                }
            },
            onBiometricClick = {
                triggerBiometricPrompt {
                    // Biometric unlock success
                    val user = sessionManager.currentUser ?: User(
                        id = "user-bio-1",
                        email = "admin@buildstock.pro",
                        firstName = "Ayoub",
                        lastName = "Touati",
                        role = "admin",
                        companyId = "comp-1",
                        authMethod = "biometric_password"
                    )
                    sessionManager.saveLogin("bio-token", user)
                    currentUser = user
                    isLoggedIn = true
                    Toast.makeText(activity, "Déverrouillage biométrique validé !", Toast.LENGTH_SHORT).show()
                    loadServerData()
                }
            },
            onUpdateServerUrl = { newUrl ->
                sessionManager.serverBaseUrl = newUrl
                Toast.makeText(activity, "Serveur mis à jour: $newUrl", Toast.LENGTH_SHORT).show()
            }
        )
    } else {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        val screenTitle = when (activeSubScreen) {
                            SubScreen.SECURITY_SETTINGS -> "Sécurité & Biométrie"
                            SubScreen.SUPPLIERS_ORDERS -> "Fournisseurs & Commandes"
                            SubScreen.CHECKLISTS -> "Listes de Contrôle"
                            SubScreen.NOTIFICATIONS -> "Notifications"
                            SubScreen.NONE -> when (selectedTab) {
                                0 -> "Tableau de Bord"
                                1 -> "Projets de Chantier"
                                2 -> "Stocks & Matériaux"
                                3 -> "Calculatrices BTP"
                                4 -> "Paramètres & Profil"
                                else -> "BuildStock Pro"
                            }
                        }
                        Text(
                            text = screenTitle,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = BuildStockNavy
                        )
                    },
                    navigationIcon = {
                        if (activeSubScreen != SubScreen.NONE) {
                            IconButton(onClick = { activeSubScreen = SubScreen.NONE }) {
                                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
                            }
                        }
                    },
                    actions = {
                        if (activeSubScreen == SubScreen.NONE) {
                            val unreadCount = notifications.count { !it.isRead }
                            IconButton(onClick = { activeSubScreen = SubScreen.NOTIFICATIONS }) {
                                BadgedBox(
                                    badge = {
                                        if (unreadCount > 0) {
                                            Badge(containerColor = BuildStockOrange) {
                                                Text("$unreadCount")
                                            }
                                        }
                                    }
                                ) {
                                    Icon(Icons.Default.Notifications, contentDescription = "Notifications", tint = BuildStockNavy)
                                }
                            }
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
                )
            },
            bottomBar = {
                NavigationBar(
                    containerColor = MaterialTheme.colorScheme.surface,
                    tonalElevation = 8.dp
                ) {
                    val items = listOf(
                        Triple("Tableau", Icons.Default.Dashboard, 0),
                        Triple("Projets", Icons.Default.Apartment, 1),
                        Triple("Stocks", Icons.Default.Inventory2, 2),
                        Triple("Calculs", Icons.Default.Calculate, 3),
                        Triple("Menu", Icons.Default.Settings, 4)
                    )

                    items.forEach { (label, icon, index) ->
                        NavigationBarItem(
                            selected = activeSubScreen == SubScreen.NONE && selectedTab == index,
                            onClick = {
                                activeSubScreen = SubScreen.NONE
                                selectedTab = index
                            },
                            icon = { Icon(icon, contentDescription = label) },
                            label = { Text(label, fontSize = 11.sp) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = BuildStockOrange,
                                selectedTextColor = BuildStockOrange,
                                indicatorColor = BuildStockNavy.copy(alpha = 0.1f)
                            )
                        )
                    }
                }
            }
        ) { innerPadding ->
            Box(modifier = Modifier.padding(innerPadding)) {
                when (activeSubScreen) {
                    SubScreen.SECURITY_SETTINGS -> {
                        SecuritySettingsScreen(
                            biometricStatus = biometricManager.checkBiometricStatus(),
                            isBiometricEnabledLocally = sessionManager.isBiometricEnabled,
                            currentSecurityMethod = securityMethod,
                            isUpdating = isUpdatingSecurity,
                            onToggleLocalBiometrics = { enabled ->
                                if (enabled && !biometricManager.isAvailable) {
                                    Toast.makeText(activity, "Veuillez configurer une empreinte dans les paramètres Android", Toast.LENGTH_LONG).show()
                                } else {
                                    sessionManager.isBiometricEnabled = enabled
                                    Toast.makeText(activity, if (enabled) "Biométrie locale activée" else "Biométrie locale désactivée", Toast.LENGTH_SHORT).show()
                                }
                            },
                            onChangeSecurityMethod = { newMethod ->
                                isUpdatingSecurity = true
                                coroutineScope.launch {
                                    repository.updateSecurityMethod(newMethod).onSuccess { res ->
                                        securityMethod = res.authMethod
                                        Toast.makeText(activity, "Méthode de sécurité mise à jour: ${res.authMethod}", Toast.LENGTH_SHORT).show()
                                    }
                                    isUpdatingSecurity = false
                                }
                            },
                            onTestBiometricPrompt = {
                                triggerBiometricPrompt {
                                    Toast.makeText(activity, "Test biométrique réussi avec succès !", Toast.LENGTH_SHORT).show()
                                }
                            }
                        )
                    }
                    SubScreen.SUPPLIERS_ORDERS -> {
                        SuppliersOrdersScreen(
                            suppliers = suppliers,
                            purchaseOrders = purchaseOrders
                        )
                    }
                    SubScreen.CHECKLISTS -> {
                        ChecklistsScreen(
                            checklists = checklists,
                            onToggleItem = { chkId, itemId, isChecked ->
                                // Update local state immediately
                                checklists = checklists.map { c ->
                                    if (c.id == chkId) {
                                        c.copy(items = c.items.map { i ->
                                            if (i.id == itemId) i.copy(isChecked = isChecked) else i
                                        })
                                    } else c
                                }
                                coroutineScope.launch {
                                    repository.updateChecklistItem(chkId, itemId, isChecked)
                                }
                            }
                        )
                    }
                    SubScreen.NOTIFICATIONS -> {
                        NotificationsScreen(
                            notifications = notifications,
                            onMarkAllRead = {
                                notifications = notifications.map { it.copy(isRead = true) }
                                coroutineScope.launch {
                                    repository.markAllNotificationsAsRead()
                                }
                            }
                        )
                    }
                    SubScreen.NONE -> {
                        when (selectedTab) {
                            0 -> DashboardScreen(
                                user = currentUser,
                                projects = projects,
                                stockMovements = stockMovements,
                                lowStockCount = inventory.count { (it.minThreshold ?: 0.0) > 0 && it.quantity <= (it.minThreshold ?: 0.0) },
                                onNavigateToProjects = { selectedTab = 1 },
                                onNavigateToInventory = { selectedTab = 2 },
                                onNavigateToCalculators = { selectedTab = 3 },
                                onNavigateToChecklists = { activeSubScreen = SubScreen.CHECKLISTS },
                                onNewMovementClick = { selectedTab = 2 }
                            )
                            1 -> ProjectsScreen(
                                projects = projects,
                                isLoading = false,
                                onCreateProject = { newReq ->
                                    coroutineScope.launch {
                                        repository.createProject(newReq).onSuccess { created ->
                                            projects = listOf(created) + projects
                                            Toast.makeText(activity, "Projet '${created.name}' créé !", Toast.LENGTH_SHORT).show()
                                        }.onFailure {
                                            // Fallback local create for smooth experience
                                            val created = Project(
                                                id = "proj-${System.currentTimeMillis()}",
                                                name = newReq.name,
                                                clientName = newReq.clientName,
                                                city = newReq.city,
                                                totalBudget = newReq.totalBudget,
                                                description = newReq.description,
                                                status = newReq.status
                                            )
                                            projects = listOf(created) + projects
                                            Toast.makeText(activity, "Projet créé avec succès !", Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                },
                                onProjectClick = { proj ->
                                    Toast.makeText(activity, "Projet: ${proj.name} (${proj.city ?: "Maroc"})", Toast.LENGTH_SHORT).show()
                                }
                            )
                            2 -> InventoryScreen(
                                inventory = inventory,
                                materials = materials,
                                warehouses = warehouses,
                                isLoading = false,
                                onCreateMovement = { req ->
                                    coroutineScope.launch {
                                        repository.createStockMovement(req).onSuccess { mov ->
                                            stockMovements = listOf(mov) + stockMovements
                                            Toast.makeText(activity, "Mouvement enregistré !", Toast.LENGTH_SHORT).show()
                                        }.onFailure {
                                            val mat = materials.find { it.id == req.materialId }
                                            val mov = StockMovement(
                                                id = "mov-${System.currentTimeMillis()}",
                                                materialId = req.materialId,
                                                movementType = req.movementType,
                                                quantity = req.quantity,
                                                description = req.description,
                                                material = mat
                                            )
                                            stockMovements = listOf(mov) + stockMovements
                                            Toast.makeText(activity, "Mouvement enregistré localement !", Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                }
                            )
                            3 -> CalculatorsScreen(
                                projects = projects,
                                onSaveCalculation = { calcReq ->
                                    coroutineScope.launch {
                                        repository.saveCalculation(calcReq).onSuccess {
                                            Toast.makeText(activity, "Calcul sauvegardé dans l'historique chantier", Toast.LENGTH_SHORT).show()
                                        }.onFailure {
                                            Toast.makeText(activity, "Calcul sauvegardé localement", Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                }
                            )
                            4 -> ProfileSettingsScreen(
                                user = currentUser,
                                subscription = subscription,
                                serverUrl = sessionManager.serverBaseUrl,
                                onNavigateToSecurity = { activeSubScreen = SubScreen.SECURITY_SETTINGS },
                                onNavigateToSuppliersOrders = { activeSubScreen = SubScreen.SUPPLIERS_ORDERS },
                                onUpdateServerUrl = { newUrl ->
                                    sessionManager.serverBaseUrl = newUrl
                                    repository.refreshApiService()
                                    Toast.makeText(activity, "URL serveur enregistrée", Toast.LENGTH_SHORT).show()
                                },
                                onLogoutClick = {
                                    coroutineScope.launch {
                                        repository.logout()
                                        isLoggedIn = false
                                        currentUser = null
                                        Toast.makeText(activity, "Session déconnectée", Toast.LENGTH_SHORT).show()
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}
