/**
 * One function per existing backend endpoint used by the app. No endpoint here
 * is invented: each maps to a route handler in livreee/app/api (see
 * docs/API_INTEGRATION_MAP.md). companyId / userId are never sent — the server
 * derives them from the session.
 */
import { api, request } from './client';
import type {
  AppNotification,
  BudgetVsActualRow,
  ChecklistDetail,
  ChecklistSummary,
  ChecklistType,
  Company,
  CompanyUser,
  DelayLog,
  InventoryMaterial,
  InventoryStats,
  Invitation,
  LibraryMaterial,
  PaymentMethods,
  ManualPayment,
  MaterialDetail,
  MaterialInput,
  Milestone,
  PlatformBillingMetrics,
  PlatformCompanyFilter,
  PlatformCompanyPage,
  PlatformDashboard,
  PlatformSubscriptions,
  Project,
  ProjectInput,
  ProjectSummaryRow,
  ProjectsResponse,
  RegisterInput,
  PurchaseOrder,
  PurchaseOrderDetail,
  StockMovementRow,
  SubscriptionInfo,
  Supplier,
  ToolCalculation,
  ToolProjectOption,
  ToolType,
  UserProfile,
  Warehouse,
} from './types';

export const projectsApi = {
  /** `limit=0` switches the route to page/pageSize pagination (see app/api/projects/route.ts). */
  list: (params: { search?: string; status?: string; page?: number; pageSize?: number; limit?: number }) =>
    api.get<ProjectsResponse>('/api/projects', {
      search: params.search,
      status: params.status,
      page: params.page,
      pageSize: params.pageSize,
      limit: params.limit ?? 0,
    }),
  get: (id: string) => api.get<Project>(`/api/projects/${id}`),
  create: (input: ProjectInput) => api.post<Project>('/api/projects', input),
  update: (id: string, input: ProjectInput) => api.patch<Project>(`/api/projects/${id}`, input),
  remove: (id: string) => api.delete<{ success: true }>(`/api/projects/${id}`),
  setStatus: (id: string, status: string) => api.patch<{ success: true }>(`/api/projects/${id}/status`, { status }),
  milestones: (id: string) => api.get<{ items: Milestone[] }>(`/api/projects/${id}/milestones`),
  delays: (id: string) => api.get<{ items: DelayLog[] }>(`/api/projects/${id}/delays`),
};

export const usersApi = {
  list: (params: { role?: string; search?: string; limit?: number }) =>
    api.get<{ users: CompanyUser[]; total: number }>('/api/users', params),
};

export const inventoryApi = {
  materials: async (params: { search?: string; category?: string; supplierId?: string; lowStock?: boolean; criticalStock?: boolean }) => {
    // The existing endpoint returns Prisma-shaped rows (camelCase), including
    // inventory rows per warehouse. Accept snake_case too for older deployments.
    type WebsiteInventoryRow = {
      id: string;
      name: string;
      description?: string | null;
      unitOfMeasure?: string | null;
      unit_of_measure?: string | null;
      unit?: string | null;
      unitPrice?: string | number | null;
      unit_price?: string | number | null;
      category?: string | { name?: string } | null;
      category_name?: string | null;
      supplierId?: string | null;
      supplier_id?: string | null;
      supplier?: { id?: string; name?: string } | null;
      supplier_name?: string | null;
      inventory?: Array<{
        id: string;
        quantity?: string | number | null;
        minThreshold?: string | number | null;
        min_threshold?: string | number | null;
        maxThreshold?: string | number | null;
        max_threshold?: string | number | null;
        warehouseId?: string | null;
        warehouse_id?: string | null;
        warehouse?: { id: string; name: string } | null;
      }>;
      current_stock?: string | number | null;
      min_stock_level?: string | number | null;
      critical_threshold?: string | number | null;
      companyId?: string;
      createdAt?: string;
      updatedAt?: string;
    };
    const rows = await api.get<WebsiteInventoryRow[]>('/api/inventory/materials', {
      search: params.search,
      category: params.category,
      supplierId: params.supplierId,
      lowStock: params.lowStock ? 'true' : undefined,
      criticalStock: params.criticalStock ? 'true' : undefined,
    });
    return rows.map((row) => {
      const inventory = Array.isArray(row.inventory)
        ? row.inventory.map((item) => ({
            id: item.id,
            quantity: item.quantity ?? 0,
            minThreshold: item.minThreshold ?? item.min_threshold ?? 0,
            maxThreshold: item.maxThreshold ?? item.max_threshold ?? null,
            warehouseId: item.warehouseId ?? item.warehouse_id ?? null,
            warehouse: item.warehouse ?? null,
          }))
        : [{
            id: `${row.id}:aggregate`,
            quantity: row.current_stock ?? 0,
            minThreshold: row.min_stock_level ?? row.critical_threshold ?? 0,
            maxThreshold: null,
            warehouseId: null,
            warehouse: null,
          }];
      const supplierName = typeof row.supplier === 'object' && row.supplier
        ? row.supplier.name
        : row.supplier_name;
      const categoryName = typeof row.category === 'string'
        ? row.category
        : row.category?.name ?? row.category_name ?? null;
      return {
        id: row.id,
        name: row.name,
        description: row.description ?? null,
        unit: row.unitOfMeasure ?? row.unit_of_measure ?? row.unit ?? '',
        unitPrice: row.unitPrice ?? row.unit_price ?? 0,
        category: categoryName,
        supplierId: row.supplierId ?? row.supplier_id ?? null,
        companyId: row.companyId ?? '',
        createdAt: row.createdAt ?? '',
        updatedAt: row.updatedAt ?? '',
        inventory,
        supplier: typeof row.supplier === 'object' && row.supplier?.id && row.supplier.name
          ? { id: row.supplier.id, name: row.supplier.name }
          : supplierName
            ? { id: row.supplierId ?? row.supplier_id ?? '', name: supplierName }
            : null,
      } satisfies InventoryMaterial;
    });
  },
  filters: () => api.get<{ categories: string[]; suppliers: { id: string; name: string }[] }>('/api/inventory/materials/filters'),
  stats: () => api.get<InventoryStats>('/api/inventory/stats'),
  movements: (limit: number) => api.get<StockMovementRow[]>('/api/inventory/movements', { limit }),
  entry: (input: { material_id: string; warehouse_id: string; quantity: number; notes?: string }) =>
    api.post<{ success: true; id: string }>('/api/inventory', { operation: 'entry', ...input }),
  transfer: (input: { material_id: string; source_warehouse_id: string; destination_warehouse_id: string; quantity: number; notes?: string }) =>
    api.post<{ success: true; id: string }>('/api/inventory', { operation: 'transfer', ...input }),
};

export const materialsApi = {
  get: (id: string) => api.get<MaterialDetail>(`/api/materials/${id}`),
  create: (input: MaterialInput) => api.post<{ id: string }>('/api/materials', input),
  update: (id: string, input: MaterialInput) => api.put<MaterialDetail>(`/api/materials/${id}`, input),
  remove: (id: string) => api.delete<{ success: true }>(`/api/materials/${id}`),
  library: () => api.get<{ items: LibraryMaterial[] }>('/api/materials/library'),
};

export const warehousesApi = {
  list: () => api.get<Warehouse[]>('/api/warehouses'),
  get: (id: string) => api.get<Warehouse & { isActive: boolean }>(`/api/warehouses/${id}`),
  create: (input: { name: string; location?: string | null; capacity?: number | null }) => api.post<Warehouse>('/api/warehouses', input),
  update: (id: string, input: { name: string; location?: string | null; capacity?: number | null; isMain?: boolean; isActive?: boolean }) =>
    api.put<Warehouse>(`/api/warehouses/${id}`, input),
  remove: (id: string) => api.delete<{ success: true }>(`/api/warehouses/${id}`),
};

export type SupplierInput = {
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export const suppliersApi = {
  list: () => api.get<Supplier[]>('/api/suppliers'),
  get: (id: string) => api.get<Supplier>(`/api/suppliers/${id}`),
  create: (input: SupplierInput) => api.post<Supplier>('/api/suppliers', input),
  update: (id: string, input: SupplierInput) => api.patch<Supplier>(`/api/suppliers/${id}`, input),
  remove: (id: string) => api.delete<{ success: true }>(`/api/suppliers/${id}`),
};

export const ordersApi = {
  list: (params: { search?: string; status?: string; limit?: number }) => api.get<PurchaseOrder[]>('/api/purchase-orders', params),
  get: (id: string) => api.get<PurchaseOrderDetail>(`/api/purchase-orders/${id}`),
  create: (input: { supplierId: string; orderDate?: string | null; expectedDelivery?: string | null }) =>
    api.post<PurchaseOrder>('/api/purchase-orders', input),
  update: (id: string, input: { status?: string; orderDate?: string | null; expectedDelivery?: string | null }) =>
    api.patch<PurchaseOrder>(`/api/purchase-orders/${id}`, input),
  remove: (id: string) => api.delete<{ success: true }>(`/api/purchase-orders/${id}`),
};

export const notificationsApi = {
  list: () => api.get<AppNotification[]>('/api/notifications'),
  markRead: (id: string) => api.post<{ success: true }>(`/api/notifications/${id}/read`),
  markAllRead: () => api.post<{ success: true }>('/api/notifications/read-all'),
};

export const reportsApi = {
  budgetVsActual: () => api.get<{ items: BudgetVsActualRow[] }>('/api/reports/budget-vs-actual'),
  projectSummary: () => api.get<{ items: ProjectSummaryRow[] }>('/api/reports/project-summary'),
};

export const toolsApi = {
  projects: () => api.get<{ items: ToolProjectOption[] }>('/api/tools/projects', { scope: 'company' }),
  calculations: (type?: ToolType) => api.get<{ items: ToolCalculation[] }>('/api/tools/calculations', { type }),
  save: (input: { toolType: ToolType; projectId: string | null; notes: string | null; input: Record<string, unknown>; output: Record<string, unknown> }) =>
    api.post<ToolCalculation>('/api/tools/calculations', input),
};

export const checklistsApi = {
  list: (params: { status?: string; type?: string; projectId?: string }) => api.get<{ items: ChecklistSummary[] }>('/api/checklists', params),
  get: (id: string) => api.get<{ item: ChecklistDetail }>(`/api/checklists/${id}`),
  create: (input: { title: string; checklistType: ChecklistType; projectId: string | null; items: string[] }) =>
    api.post<{ item: ChecklistDetail }>('/api/checklists', input),
  update: (id: string, input: { title?: string; checklistType?: ChecklistType; status?: 'completed' | 'in_progress' }) =>
    api.patch<{ item: ChecklistDetail }>(`/api/checklists/${id}`, input),
  toggleItem: (id: string, itemId: string, isChecked: boolean) =>
    api.patch<{ item: ChecklistDetail }>(`/api/checklists/${id}/items/${itemId}`, { isChecked }),
  remove: (id: string) => api.delete<{ success: true }>(`/api/checklists/${id}`),
};

export const accountApi = {
  updateProfile: (input: { firstName: string; lastName: string; phone: string; email: string }) =>
    api.put<{ user: UserProfile }>('/api/auth/me', input),
  changePassword: (input: { currentPassword: string; newPassword: string }) => api.post<{ success: true }>('/api/auth/change-password', input),
  forgotPassword: (email: string) => api.post<{ success?: boolean; message?: string }>('/api/auth/forgot-password', { email }),
};

export const companyApi = {
  get: (companyId: string) => api.get<Company>(`/api/company/${companyId}`),
  /** The web form sends snake_case keys for some fields (see company-settings.tsx). */
  update: (companyId: string, input: Record<string, string | null>) => api.put<Company>(`/api/company/${companyId}`, input),
  users: () => api.get<CompanyUser[]>('/api/company/users'),
  deactivateUser: (userId: string) => api.delete<{ success: true }>(`/api/company/users/${userId}`),
  invite: (input: { email: string; role: string; firstName: string; lastName: string }) =>
    api.post<{ success?: boolean }>('/api/company/users/invite', input),
  invitations: (companyId: string) => api.get<Invitation[]>('/api/invitations', { companyId }),
  cancelInvitation: (id: string) => api.delete<{ success: true }>(`/api/invitations/${id}`),
  subscription: () => api.get<SubscriptionInfo>('/api/subscription'),
};

/**
 * Platform super-admin endpoints (requirePlatformAdmin on the server). Only
 * the routes whose behavior was verified are used; company creation and plan
 * change are deliberately excluded (see docs/BACKEND_CHANGES_REQUIRED.md §8).
 */
export const platformApi = {
  dashboard: () => api.get<PlatformDashboard>('/api/v1/platform/dashboard'),
  subscriptions: () => api.get<PlatformSubscriptions>('/api/v1/platform/subscriptions'),
  billingMetrics: () => api.get<PlatformBillingMetrics>('/api/platform/billing/metrics'),
  companies: (params: { page: number; pageSize: number; search?: string; status: PlatformCompanyFilter }) =>
    api.get<PlatformCompanyPage>('/api/v1/platform/companies', {
      page: params.page,
      page_size: params.pageSize,
      search: params.search,
      status: params.status,
    }),
  activateCompany: (id: string) => api.patch<{ success: true }>(`/api/v1/platform/companies/${id}/activate`, {}),
  suspendCompany: (id: string, reason: string) => api.patch<{ success: true }>(`/api/v1/platform/companies/${id}/suspend`, { reason }),
  manualPayments: () => api.get<{ items: ManualPayment[] }>('/api/platform/billing/manual-payments'),
  confirmPayment: (id: string) => api.post<{ success: true }>(`/api/platform/billing/manual-payments/${id}/confirm`),
  rejectPayment: (id: string, reason: string | null) =>
    api.post<{ success: true }>(`/api/platform/billing/manual-payments/${id}/reject`, reason ? { reason } : {}),
};

/**
 * Company subscription purchase — same routes as the website's billing tab
 * (components/settings/payment-billing-settings.tsx).
 */
export const billingApi = {
  paymentMethods: () => api.get<PaymentMethods>('/api/billing/payment-methods'),
  /** Stripe: returns a hosted checkout URL opened in the in-app browser. */
  checkout: (input: { planCode: string; cadence: string; idempotencyKey: string }) =>
    api.post<{ checkout_url: string | null; stripe_checkout_session_id?: string; reused?: boolean }>('/api/billing/checkout', {
      plan_code: input.planCode,
      cadence: input.cadence,
      idempotency_key: input.idempotencyKey,
    }),
  /** Cash / PayPal: creates a pending request confirmed later by the platform admin. */
  manualRequest: (input: { planCode: string; cadence: string; method: 'cash' | 'paypal' }) =>
    api.post<{ item: unknown }>('/api/billing/manual-request', input),
  /** Switch to the free plan (web "Rétrograder"). */
  changePlan: (planCode: string) => api.post<{ planCode?: string; planName?: string }>('/api/subscription', { planCode }),
};

/** Public company + admin sign-up (POST /api/register). */
export const registrationApi = {
  status: () => request<{ open: boolean }>('/api/register/status', { anonymous: true }),
  register: (input: RegisterInput) =>
    request<{ success: true; isPlatformAdmin?: boolean; emailSent?: boolean; emailMessage?: string }>('/api/register', { method: 'POST', body: input, anonymous: true }),
};
