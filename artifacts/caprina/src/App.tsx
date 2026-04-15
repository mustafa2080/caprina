import { Switch, Route, Router as WouterRouter } from "wouter";
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
import Layout from "@/components/layout";

const queryClient = new QueryClient();

function Router() {
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
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
