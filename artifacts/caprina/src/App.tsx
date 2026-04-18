import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Orders from "@/pages/orders";
import OrderForm from "@/pages/order-form";
import OrderDetail from "@/pages/order-detail";
import Inventory from "@/pages/inventory";
import ShippingCompanies from "@/pages/shipping-companies";
import Invoices from "@/pages/invoices";
import Import from "@/pages/import";
import Movements from "@/pages/movements";
import ProductPerformance from "@/pages/product-performance";
import UsersPage from "@/pages/users";
import AuditLogsPage from "@/pages/audit-logs";
import Login from "@/pages/login";
import Layout from "@/components/layout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const queryClient = new QueryClient();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [location] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black text-lg mx-auto mb-3">C</div>
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user && location !== "/login") {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}

function Router() {
  const { user } = useAuth();
  const [location] = useLocation();

  if (location === "/login") {
    return (
      <Switch>
        <Route path="/login" component={Login} />
      </Switch>
    );
  }

  if (!user) return <Redirect to="/login" />;

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/orders" component={Orders} />
        <Route path="/orders/new" component={OrderForm} />
        <Route path="/orders/:id" component={OrderDetail} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/shipping" component={ShippingCompanies} />
        <Route path="/invoices" component={Invoices} />
        <Route path="/import" component={Import} />
        <Route path="/movements" component={Movements} />
        <Route path="/product-performance" component={ProductPerformance} />
        <Route path="/users" component={UsersPage} />
        <Route path="/audit-logs" component={AuditLogsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <AuthGuard>
              <Router />
            </AuthGuard>
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
