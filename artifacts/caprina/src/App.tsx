import { lazy, Suspense, Component, type ReactNode } from "react";
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
interface EBState { hasError: boolean }
class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false };
  static getDerivedStateFromError(): EBState { return { hasError: true }; }
  componentDidCatch(err: unknown) { console.error("[ErrorBoundary]", err); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6" dir="rtl">
        <div className="text-center max-w-sm space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-2xl">⚠️</div>
          <div>
            <p className="font-black text-foreground text-lg">حدث خطأ غير متوقع</p>
            <p className="text-muted-foreground text-sm mt-1">يرجى إعادة المحاولة. إذا استمر الخطأ، أعد تحميل الصفحة.</p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            حاول مرة أخرى
          </button>
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
const NotFound              = lazy(() => import("@/pages/not-found"));
const Login                 = lazy(() => import("@/pages/login"));

// ─── Global QueryClient with smart caching defaults ──────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
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

// ─── Router ───────────────────────────────────────────────────────────────────
function Router() {
  const { user } = useAuth();
  const [location] = useLocation();

  if (location === "/login") {
    return (
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/login" component={Login} />
        </Switch>
      </Suspense>
    );
  }

  if (!user) return <Redirect to="/login" />;

  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/"                         component={Dashboard} />
          <Route path="/orders"                   component={Orders} />
          <Route path="/orders/new"               component={OrderForm} />
          <Route path="/orders/:id"               component={OrderDetail} />
          <Route path="/inventory"                component={Inventory} />
          <Route path="/shipping"                 component={ShippingCompanies} />
          <Route path="/shipping/manifests/:id"   component={ShippingManifestPage} />
          <Route path="/shipping/company/:id"     component={ShippingCompanyDetail} />
          <Route path="/invoices"                 component={Invoices} />
          <Route path="/import"                   component={Import} />
          <Route path="/movements"                component={Movements} />
          <Route path="/product-performance"      component={ProductPerformance} />
          <Route path="/users"                    component={UsersPage} />
          <Route path="/audit-logs"               component={AuditLogsPage} />
          <Route path="/warehouses"               component={WarehousesPage} />
          <Route path="/team-performance"         component={TeamPerformancePage} />
          <Route path="/ads-analytics"            component={AdsAnalyticsPage} />
          <Route path="/team"                     component={TeamPage} />
          <Route path="/smart"                    component={SmartAnalyticsPage} />
          <Route path="/archive"                  component={ArchivePage} />
          <Route path="/shipping-followup"        component={ShippingFollowupPage} />
          <Route path="/whatsapp"                 component={WhatsAppSettingsPage} />
          <Route                                  component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
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
                  <ErrorBoundary>
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
