import { useGetOrdersSummary, useGetRecentOrders } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Clock, Truck, CheckCircle2, TrendingUp, XCircle, Plus } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: summary, isLoading: isSummaryLoading } = useGetOrdersSummary();
  const { data: recentOrders, isLoading: isRecentLoading } = useGetRecentOrders();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-300';
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-300';
      case 'shipped': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-300';
      case 'delivered': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Overview</h1>
        <p className="text-muted-foreground mt-1 text-sm">Welcome to your workshop. Here's what's happening today.</p>
      </div>

      {isSummaryLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2"><div className="h-4 bg-muted rounded w-1/2"></div></CardHeader>
              <CardContent><div className="h-8 bg-muted rounded w-3/4"></div></CardContent>
            </Card>
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-sm border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
              <TrendingUp className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-serif">{formatCurrency(summary.totalRevenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Orders</CardTitle>
              <Clock className="w-4 h-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-serif">{summary.pendingOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting action</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Processing</CardTitle>
              <Package className="w-4 h-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-serif">{summary.processingOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">In the workshop</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-serif">{summary.deliveredOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">Successfully delivered</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-serif font-semibold">Recent Activity</h2>
            <Link href="/orders" className="text-sm text-primary hover:underline font-medium">View all</Link>
          </div>
          
          <Card className="shadow-sm overflow-hidden">
            {isRecentLoading ? (
              <div className="p-6 text-center text-muted-foreground text-sm">Loading recent orders...</div>
            ) : recentOrders && recentOrders.length > 0 ? (
              <div className="divide-y divide-border">
                {recentOrders.map((order) => (
                  <Link key={order.id} href={`/orders/${order.id}`} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-medium text-sm border border-border">
                        {order.customerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-foreground">{order.customerName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>#{order.id.toString().padStart(4, '0')}</span>
                          <span>&bull;</span>
                          <span>{order.product}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="font-medium text-sm font-mono">{formatCurrency(order.totalPrice)}</span>
                      <Badge variant="outline" className={`text-[10px] uppercase tracking-wider font-semibold border ${getStatusColor(order.status)}`}>
                        {order.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Package className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p>No orders yet.</p>
                <Link href="/orders/new" className="text-primary hover:underline mt-2 inline-block text-sm">Create your first order</Link>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-serif font-semibold">Quick Actions</h2>
          <Card className="shadow-sm">
            <div className="p-4 flex flex-col gap-2">
              <Link href="/orders/new" className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors py-2.5 px-4 rounded-md text-sm font-medium shadow-sm">
                <Plus className="w-4 h-4" />
                Create New Order
              </Link>
              <Link href="/orders?status=pending" className="w-full flex items-center justify-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors py-2.5 px-4 rounded-md text-sm font-medium border border-border">
                <Clock className="w-4 h-4" />
                View Pending
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
