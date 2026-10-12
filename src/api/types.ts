/**
 * Response shapes of the existing BuildStock API, as observed in the route
 * handlers of livreee/app/api and verified against the running backend.
 * Prisma Decimal columns are serialized as strings; use `toNumber` to read them.
 */
import type { UserRole } from '@/lib/permissions';

export type Decimalish = string | number | null;

export type UserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  companyId: string;
  isPlatformAdmin: boolean;
  authMethod?: 'password_only' | 'biometric_password' | 'biometric_only';
  phone?: string;
  lastLoginAt?: string;
  subscriptionStatus?: string;
  subscriptionTrialEndsAt?: string | null;
};

export type ProjectStatus = 'planning' | 'active' | 'in_progress' | 'paused' | 'completed' | 'cancelled';

export type Project = {
  id: string;
  name: string;
  description: string | null;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  projectType: string | null;
  status: ProjectStatus | string;
  startDate: string | null;
  endDate: string | null;
  totalBudget: Decimalish;
  currentCost: Decimalish;
  companyId: string;
  siteManagerId: string | null;
  structuralEngineerId: string | null;
  createdAt: string;
  updatedAt: string;
  siteManager?: { id: string; firstName: string; lastName: string } | null;
  structuralEngineer?: { id: string; firstName: string; lastName: string } | null;
};

export type ProjectStats = {
  total: number;
  active: number;
  planning: number;
  completed: number;
  paused: number;
  cancelled: number;
  totalBudget: number;
  totalCost: number;
  overBudgetCount: number;
  budgetUsage: number;
};

export type ProjectsResponse = { projects: Project[]; total: number; stats: ProjectStats };

export type ProjectInput = {
  name: string;
  description?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  projectType?: string | null;
  status?: string;
  totalBudget?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  siteManagerId?: string | null;
  structuralEngineerId?: string | null;
};

export type Milestone = { id: string; title: string; due_date: string | null; status: string; notes: string | null; created_at: string };
export type DelayLog = { id: string; reason: string; days_delayed: number; created_at: string };

export type InventoryRow = {
  id: string;
  quantity: Decimalish;
  minThreshold: Decimalish;
  maxThreshold: Decimalish;
  warehouseId: string | null;
  warehouse: { id: string; name: string } | null;
};

/** GET /api/inventory/materials */
export type InventoryMaterial = {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  unitPrice: Decimalish;
  category: string | null;
  supplierId: string | null;
  companyId: string;
  createdAt: string;
  updatedAt: string;
  inventory: InventoryRow[];
  supplier: { id: string; name: string } | null;
};

/** GET /api/materials/[id] */
export type MaterialDetail = Omit<InventoryMaterial, 'inventory' | 'supplier'> & {
  supplier: Supplier | null;
  inventory: InventoryRow[];
};

export type MaterialInput = {
  name: string;
  description?: string | null;
  unit: string;
  unitPrice?: number | null;
  category?: string | null;
  supplierId?: string | null;
  minStockLevel?: number | null;
  maxStockLevel?: number | null;
};

export type InventoryStats = {
  totalMaterials: number;
  totalValue: number;
  lowStockCount: number;
  criticalStockCount: number;
  outOfStockCount: number;
  recentMovements: number;
  categoriesCount: number;
};

export type StockMovementRow = {
  id: string;
  project_id: string | null;
  material_id: string;
  user_id: string | null;
  movement_type: string;
  source_type: string | null;
  source_warehouse_id: string | null;
  destination_type: string | null;
  destination_warehouse_id: string | null;
  quantity: number;
  description: string | null;
  movement_date: string;
  material?: { id: string; name: string; unit: string } | null;
  project?: { id: string; name: string } | null;
  user?: { firstName?: string; lastName?: string; first_name?: string; last_name?: string } | null;
  source_warehouse?: { id: string; name: string } | null;
  destination_warehouse?: { id: string; name: string } | null;
};

export type Warehouse = {
  id: string;
  name: string;
  location: string | null;
  capacity: Decimalish;
  isMain: boolean;
  isActive?: boolean;
};

export type Supplier = {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  companyId: string;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseOrderStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'ordered'
  | 'partially_delivered'
  | 'delivered'
  | 'cancelled';

export type PurchaseOrder = {
  id: string;
  orderNumber: string;
  status: PurchaseOrderStatus | string;
  totalAmount: Decimalish;
  orderDate: string | null;
  expectedDelivery: string | null;
  actualDelivery: string | null;
  supplierId: string;
  companyId: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  supplier: { id: string; name: string } | null;
};

export type PurchaseOrderDetail = PurchaseOrder & {
  supplier: Supplier | null;
  createdBy: { id: string; firstName: string; lastName: string; email: string } | null;
  items: {
    id: string;
    quantity: Decimalish;
    unitPrice: Decimalish;
    totalPrice: Decimalish;
    notes: string | null;
    material: { id: string; name: string; unit: string } | null;
  }[];
};

export type AppNotification = {
  id: string;
  typeCode: string;
  title: string;
  bodyText: string | null;
  isRead: boolean;
  createdAt: string;
};

export type CompanyUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  active: boolean;
  isActive?: boolean;
  phone: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  fullName?: string;
};

export type Invitation = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  invitedBy?: { firstName?: string; lastName?: string } | null;
};

export type Company = {
  id: string;
  name: string;
  email: string | null;
  siret: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  taxRate: Decimalish;
  bankInfo: string | null;
  ice: string | null;
  if_id: string | null;
  currency: string | null;
  country: string | null;
  timezone: string | null;
  plan: string | null;
  updatedAt: string;
};

export type SubscriptionInfo = {
  subscription: {
    id: string;
    status: string;
    planCode: string;
    planName: string;
    price: number;
    isTrialing: boolean;
    trialDaysLeft: number | null;
    trialExpired: boolean;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    features: { maxProjects?: number; maxUsers?: number; advancedAnalytics?: boolean };
  };
  plans: SubscriptionPlan[];
  lastPayment?: PlanPaymentSummary | null;
  pendingPayment?: PlanPaymentSummary | null;
};

export type SubscriptionPlan = {
  code: string;
  name: string;
  price: number;
  isCurrent: boolean;
  features?: { featureCode: string; limitValue: number | null; enabled: boolean }[];
};

/** A PlanPayment row as returned inside GET /api/subscription. */
export type PlanPaymentSummary = {
  id?: string;
  planCode: string;
  cadence: string;
  amountMad: number;
  method: string;
  status: string;
  paidAt?: string | null;
  createdAt?: string;
};

export type PaymentMethods = { stripe: boolean; paypal: boolean; cash: boolean };

export type RegisterInput = {
  companyName: string;
  siret?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

export type ToolType = 'concrete' | 'steel' | 'formwork' | 'mesh';

export type ToolCalculation = {
  id: string;
  toolType: ToolType;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  notes: string | null;
  project: { id: string; name: string } | null;
  createdAt: string;
};

export type ToolProjectOption = { id: string; name: string; status: string };

export type LibraryMaterial = { id: string; name: string; unit: string; unitPrice: number | null; category: string | null };

export type ChecklistType = 'safety' | 'daily' | 'quality' | 'equipment' | 'general';

export type ChecklistSummary = {
  id: string;
  title: string;
  checklistType: ChecklistType;
  status: 'in_progress' | 'completed';
  completedAt: string | null;
  createdAt: string;
  project: { id: string; name: string } | null;
  createdBy: { id: string; firstName: string; lastName: string } | null;
  itemsTotal: number;
  itemsChecked: number;
};

export type ChecklistDetail = Omit<ChecklistSummary, 'itemsTotal' | 'itemsChecked'> & {
  createdById?: string;
  items: { id: string; label: string; isChecked: boolean; position: number }[];
};

export type BudgetVsActualRow = { project_id: string; project_name: string; budget: number; actual: number; variance: number };
export type ProjectSummaryRow = { project_id: string; project_name: string; status: string; budget: Decimalish; expenses: Decimalish };

// ---------------------------------------------------------------------------
// Platform (super-admin) — /api/v1/platform/* and /api/platform/billing/*
// ---------------------------------------------------------------------------

export type PlatformDashboard = {
  total_companies: number;
  active_companies: number;
  suspended_companies: number;
  companies_on_trial: number;
  monthly_revenue_estimate: number;
  failed_payments_count: number;
};

export type PlatformCompanyStatus = 'active' | 'suspended' | 'trialing' | string;
export type PlatformCompanyFilter = 'all' | 'active' | 'suspended' | 'trialing';

export type PlatformCompany = {
  id: string;
  name: string;
  status: PlatformCompanyStatus;
  subscription_status: string | null;
  trial_ends_at: string | null;
  last_payment_status: string | null;
  created_at: string;
};

export type PlatformCompanyPage = {
  items: PlatformCompany[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type PlatformSubscriptions = {
  total_subscriptions: number;
  active_subscriptions: number;
  trialing_subscriptions: number;
  past_due_subscriptions: number;
  canceled_subscriptions: number;
  monthly_recurring_revenue: number;
  failed_payments_count: number;
};

export type PlatformBillingMetrics = {
  total_mrr: number;
  active_subscriptions: number;
  past_due_count: number;
  grace_period_count: number;
  dead_letter_webhooks: number;
  webhook_failures_last_24h: number;
  last_reconciliation_at: string | null;
  webhook_monitoring: { pending: number; failed: number; dead_letter: number; avg_processing_time_ms: number; retry_rate: number };
};

export type ManualPayment = {
  id: string;
  companyId: string;
  planCode: string;
  cadence: string;
  amountMad: number;
  method: string;
  status: 'pending' | 'completed' | 'rejected' | string;
  rejectedReason: string | null;
  paidAt: string | null;
  createdAt: string;
  company: { id: string; name: string } | null;
  requestedBy: { id: string; firstName: string; lastName: string; email: string } | null;
  confirmedBy: { id: string; firstName: string; lastName: string } | null;
};
