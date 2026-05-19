import { lazy, Suspense, Component, type ReactNode, useRef, useEffect, useLayoutEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { BrandProvider } from "@/contexts/BrandContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { BrandLogoMark } from "@/components/brand-logo";
import Layout from "@/components/layout";

// ─── Global Error Boundary ───────────────────────────────────────────────────
interface EBState { hasError: boolean; errorMsg: string }
interface EBProps { children: ReactNode; onRetry?: () => void }
class ErrorBoundary extends Component<EBProps, EBState> {
  state: EBState = { hasError: false, errorMsg: "" };
  static getDerivedStateFromError(err: unknown): EBState {
    const msg = err instanceof Error ? err.message : String(err);
    return { hasError: true, errorMsg: msg };
  }
  componentDidCatch(err: unknown) { console.error("[ErrorBoundary]", err); }

  handleRetry = () => {
    // نعمل clear للـ query cache عشان ما يرجعش نفس الخطأ المخزن
    this.props.onRetry?.();
    this.setState({ hasError: false, errorMsg: "" });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6" dir="rtl">
        <div className="text-center max-w-sm space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-2xl">⚠️</div>
          <div>
            <p className="font-black text-foreground text-lg">حدث خطأ غير متوقع</p>
            <p className="text-muted-foreground text-sm mt-1">يرجى إعادة المحاولة.</p>
          </div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={this.handleRetry}
              className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              حاول مرة أخرى
            </button>
            <button
              onClick={() => window.location.reload()}
              className="bg-muted text-foreground px-5 py-2 rounded-lg text-sm font-bold hover:bg-muted/80 transition-colors"
            >
              إعادة تحميل
            </button>
          </div>
        </div>
      </div>
    );
  }
}

// ─── Lazy-loaded pages (loaded only when navigated to) ───────────────────────
const Dashboard             = lazy(() => import("@/pages/dashboard"));
const Orders                = lazy(() => import("@/pages/orders"));
const OrderForm             = lazy(() => import("@/pages/order-form"));
const OrderDetail           = lazy(() => import("@/pages/order-detail"));
const Inventory             = lazy(() => import("@/pages/inventory"));
const ShippingCompanies     = lazy(() => import("@/pages/shipping-companies"));
const Invoices              = lazy(() => import("@/pages/invoices"));
const Import                = lazy(() => import("@/pages/import"));
const Movements             = lazy(() => import("@/pages/movements"));
const ProductPerformance    = lazy(() => import("@/pages/product-performance"));
const UsersPage             = lazy(() => import("@/pages/users"));
const AuditLogsPage         = lazy(() => import("@/pages/audit-logs"));
const ShippingManifestPage  = lazy(() => import("@/pages/shipping-manifest"));
const ShippingCompanyDetail = lazy(() => import("@/pages/shipping-company-detail"));
const WarehousesPage        = lazy(() => import("@/pages/warehouses"));
const TeamPerformancePage   = lazy(() => import("@/pages/team-performance"));
const AdsAnalyticsPage      = lazy(() => import("@/pages/ads-analytics"));
const TeamPage              = lazy(() => import("@/pages/team"));
const SmartAnalyticsPage    = lazy(() => import("@/pages/smart-analytics"));
const ArchivePage           = lazy(() => import("@/pages/archive"));
const ShippingFollowupPage  = lazy(() => import("@/pages/shipping-followup"));
const WhatsAppSettingsPage  = lazy(() => import("@/pages/whatsapp-settings"));
const SessionsReportPage    = lazy(() => import("@/pages/sessions-report"));
const ExportPage            = lazy(() => import("@/pages/export"));
const InvoiceGroupPage      = lazy(() => import("@/pages/invoice-group"));
const NotFound              = lazy(() => import("@/pages/not-found"));
const Login                 = lazy(() => import("@/pages/login"));
const FinancePurchases      = lazy(() => import("@/pages/finance-purchases"));
const FinanceSales          = lazy(() => import("@/pages/finance-sales"));
const FinanceSuppliers      = lazy(() => import("@/pages/finance-suppliers"));
const FinanceExpenses       = lazy(() => import("@/pages/finance-expenses"));
const FinanceShippingInvoices = lazy(() => import("@/pages/finance-shipping-invoices"));
const FinanceCash           = lazy(() => import("@/pages/finance-cash"));
const FinanceCashAnalytics  = lazy(() => import("@/pages/finance-cash-analytics"));
const FinanceCashArchive    = lazy(() => import("@/pages/finance-cash-archive"));
const FinanceHub            = lazy(() => import("@/pages/finance-hub"));
const FinanceClients        = lazy(() => import("@/pages/finance-clients"));
const SuperAdminPage        = lazy(() => import("@/pages/super-admin"));

// ─── Global QueryClient with smart caching defaults ──────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: 1,                        // محاولة واحدة إضافية بس — عشان ما يتأخرش في إظهار الخطأ
      retryDelay: 2000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,        // لما الانترنت يرجع يعمل refetch تلقائي
    },
    mutations: {
      retry: 1,
    },
  },
});

// ─── Page-level loading spinner ───────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]" dir="rtl">
      <div className="flex flex-col items-center gap-3">
        <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-xs text-muted-foreground">جاري التحميل...</p>
      </div>
    </div>
  );
}

// ─── Scroll to top on every route change ─────────────────────────────────────
function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    const scrollAll = () => {
      // اعمل scroll على كل العناصر الممكنة
      const el = document.getElementById("main-scroll-area");
      if (el) el.scrollTop = 0;
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    // مرة فورية
    scrollAll();
    // ومرة بعد ما الـ DOM يتحدث
    const raf = requestAnimationFrame(scrollAll);
    return () => cancelAnimationFrame(raf);
  }, [location]);
  return null;
}

// ─── Refresh permissions on every route change ───────────────────────────────
function PermissionRefresher() {
  const { user, refreshUser } = useAuth();
  const [location] = useLocation();
  const prevLocation = useRef<string | null>(null);

  useEffect(() => {
    // نعمل refresh لما يتغير الـ route — عشان التغييرات في الصلاحيات تنعكس فوراً
    if (user && prevLocation.current !== null && prevLocation.current !== location) {
      refreshUser();
    }
    prevLocation.current = location;
  }, [location, user]);

  return null;
}

// ─── Auth guard (shown once, blocks pre-auth rendering) ──────────────────────
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [location] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <BrandLogoMark size="md" className="mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user && location !== "/login") return <Redirect to="/login" />;
  return <>{children}</>;
}

// ─── Permission-protected route ───────────────────────────────────────────────
// لو الصلاحية اتشالت (realtime) → redirect للـ أول صفحة مسموح بيها — بدون loop
function ProtectedRoute({ permission, component: Comp }: { permission: string; component: React.ComponentType }) {
  const { can, user, isAdmin } = useAuth();
  if (!can(permission) && !(isAdmin && permission === "finance")) {
    // لو كان الـ permission نفسه dashboard نبعد عن الـ loop
    if (permission === "dashboard") {
      if (can("orders"))    return <Redirect to="/orders" />;
      if (can("inventory")) return <Redirect to="/inventory" />;
      // مفيش صلاحيات خالص — اعرض رسالة
      return (
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center space-y-3 p-6">
            <p className="text-lg font-bold text-foreground">مرحباً {user?.displayName} 👋</p>
            <p className="text-sm text-muted-foreground">ليس لديك صلاحية الوصول لأي صفحة حتى الآن.</p>
            <p className="text-xs text-muted-foreground">تواصل مع المدير لإضافة الصلاحيات المناسبة.</p>
          </div>
        </div>
      );
    }
    return <Redirect to="/" />;
  }
  return <Comp />;
}

// ─── Video background sync with React router ─────────────────────────────────
function VideoBackgroundSync() {
  const [location] = useLocation();
  useEffect(() => {
    const isLogin = location === "/login" || location === "/";
    const video = document.getElementById("login-bg-video") as HTMLVideoElement | null;
    const html = document.documentElement;
    if (!video) return;
    if (isLogin) {
      video.style.display = "block";
      html.classList.add("login-active");
      if (video.paused) video.play().catch(() => {});
    } else {
      video.style.display = "none";
      html.classList.remove("login-active");
      video.pause();
    }
  }, [location]);
  return null;
}

// ─── Router ───────────────────────────────────────────────────────────────────
function Router() {
  const { user } = useAuth();
  const [location] = useLocation();

  if (location === "/login") {
    return (
      <>
        <VideoBackgroundSync />
        <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path="/login" component={Login} />
          </Switch>
        </Suspense>
      </>
    );
  }

  if (!user) return <Redirect to="/login" />;

  return (
    <>
      <VideoBackgroundSync />
      <Layout>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/"                         component={() => <ProtectedRoute permission="dashboard" component={Dashboard} />} />
          <Route path="/orders"                   component={() => <ProtectedRoute permission="orders" component={Orders} />} />
          <Route path="/orders/new"               component={() => <ProtectedRoute permission="orders" component={OrderForm} />} />
          <Route path="/invoices/:invoiceNumber"  component={() => <ProtectedRoute permission="invoices" component={InvoiceGroupPage} />} />
          <Route path="/orders/:id"               component={() => <ProtectedRoute permission="orders" component={OrderDetail} />} />
          <Route path="/inventory"                component={() => <ProtectedRoute permission="inventory" component={Inventory} />} />
          <Route path="/shipping"                 component={() => <ProtectedRoute permission="shipping" component={ShippingCompanies} />} />
          <Route path="/shipping/manifests/:id"   component={() => <ProtectedRoute permission="shipping" component={ShippingManifestPage} />} />
          <Route path="/shipping/company/:id"     component={() => <ProtectedRoute permission="shipping" component={ShippingCompanyDetail} />} />
          <Route path="/invoices"                 component={() => <ProtectedRoute permission="invoices" component={Invoices} />} />
          <Route path="/import"                   component={() => <ProtectedRoute permission="import" component={Import} />} />
          <Route path="/movements"                component={() => <ProtectedRoute permission="movements" component={Movements} />} />
          <Route path="/product-performance"      component={() => <ProtectedRoute permission="view_product_performance" component={ProductPerformance} />} />
          <Route path="/users"                    component={() => <ProtectedRoute permission="users" component={UsersPage} />} />
          <Route path="/audit-logs"               component={() => <ProtectedRoute permission="audit" component={AuditLogsPage} />} />
          <Route path="/warehouses"               component={() => <ProtectedRoute permission="inventory" component={WarehousesPage} />} />
          <Route path="/team-performance"         component={() => <ProtectedRoute permission="analytics" component={TeamPerformancePage} />} />
          <Route path="/ads-analytics"            component={() => <ProtectedRoute permission="analytics" component={AdsAnalyticsPage} />} />
          <Route path="/team"                     component={() => <ProtectedRoute permission="analytics" component={TeamPage} />} />
          <Route path="/smart"                    component={() => <ProtectedRoute permission="analytics" component={SmartAnalyticsPage} />} />
          <Route path="/archive"                  component={() => <ProtectedRoute permission="orders" component={ArchivePage} />} />
          <Route path="/shipping-followup"        component={() => <ProtectedRoute permission="orders" component={ShippingFollowupPage} />} />
          <Route path="/whatsapp"                 component={() => <ProtectedRoute permission="whatsapp" component={WhatsAppSettingsPage} />} />
          <Route path="/sessions-report"          component={() => <ProtectedRoute permission="users" component={SessionsReportPage} />} />
          <Route path="/export"                   component={() => <ProtectedRoute permission="import" component={ExportPage} />} />
          {/* Finance */}
          <Route path="/finance"                  component={() => <ProtectedRoute permission="finance" component={FinanceHub} />} />
          <Route path="/finance/dashboard"        component={() => <Redirect to="/finance" />} />
          <Route path="/finance/purchases"        component={() => <ProtectedRoute permission="finance" component={FinancePurchases} />} />
          <Route path="/finance/sales"            component={() => <ProtectedRoute permission="finance" component={FinanceSales} />} />
          <Route path="/finance/clients"          component={() => <ProtectedRoute permission="finance" component={FinanceClients} />} />
          <Route path="/finance/suppliers"        component={() => <ProtectedRoute permission="finance" component={FinanceSuppliers} />} />
          <Route path="/finance/expenses"         component={() => <ProtectedRoute permission="finance" component={FinanceExpenses} />} />
          <Route path="/finance/shipping-invoices" component={() => <ProtectedRoute permission="finance" component={FinanceShippingInvoices} />} />
          <Route path="/finance/cash"              component={() => <ProtectedRoute permission="finance" component={FinanceCash} />} />
          <Route path="/finance/cash/analytics"  component={() => <ProtectedRoute permission="finance" component={FinanceCashAnalytics} />} />
          <Route path="/finance/cash/archive"    component={() => <ProtectedRoute permission="finance" component={FinanceCashArchive} />} />
          {/* Super Admin */}
          <Route path="/super-admin" component={() => user?.role === "super_admin" ? <SuperAdminPage /> : <Redirect to="/" />} />
          <Route                                  component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
    </>
  );
}

// ─── App root ────────────────────────────────────────────────────────────────
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <ThemeProvider>
            <BrandProvider>
              <AuthProvider>
                <AuthGuard>
                  <ErrorBoundary onRetry={() => queryClient.clear()}>
                    <ScrollToTop />
                    <PermissionRefresher />
                    <Router />
                  </ErrorBoundary>
                </AuthGuard>
              </AuthProvider>
            </BrandProvider>
          </ThemeProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
