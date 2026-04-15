import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Search, Filter, Plus, Package } from "lucide-react";
import { useListOrders } from "@workspace/api-client-react";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-300",
  processing: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-300",
  shipped: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-300",
  delivered: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-300",
};

export default function Orders() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  
  const debouncedSearch = useDebounce(search, 300);

  const { data: orders, isLoading } = useListOrders({
    search: debouncedSearch || undefined,
    status: status !== "all" ? status : undefined,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Orders</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage and track your workshop orders.</p>
        </div>
        <Link href="/orders/new">
          <Button className="w-full sm:w-auto shadow-sm gap-2">
            <Plus className="w-4 h-4" />
            New Order
          </Button>
        </Link>
      </div>

      <Card className="shadow-sm border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search customers or products..."
              className="pl-9 bg-card"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-48">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-card">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <SelectValue placeholder="Filter status" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Orders</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading orders...</div>
        ) : orders && orders.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="w-[100px]">Order</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center w-[120px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} className="group hover:bg-muted/50 cursor-pointer" onClick={() => window.location.href = `/orders/${order.id}`}>
                    <TableCell className="font-mono text-sm font-medium">#{order.id.toString().padStart(4, "0")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(order.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{order.customerName}</TableCell>
                    <TableCell className="text-sm">
                      {order.product}
                      <span className="text-muted-foreground ml-1 text-xs">&times;{order.quantity}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">
                      {formatCurrency(order.totalPrice)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`text-[10px] uppercase tracking-wider font-semibold border ${statusColors[order.status as keyof typeof statusColors]}`}>
                        {order.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="p-12 text-center text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-medium text-foreground mb-1">No orders found</h3>
            <p className="text-sm max-w-sm mx-auto">
              {search || status !== "all" 
                ? "Try adjusting your search or filters to find what you're looking for."
                : "You don't have any orders yet. Create one to get started."}
            </p>
            {!(search || status !== "all") && (
              <Link href="/orders/new">
                <Button variant="outline" className="mt-4">Create Order</Button>
              </Link>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
