import { useParams, Link } from "wouter";
import { format } from "date-fns";
import { 
  ArrowLeft, 
  Calendar, 
  CreditCard, 
  Package, 
  User, 
  AlertCircle,
  Pencil,
  Save,
  X
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  useGetOrder, 
  getGetOrderQueryKey,
  useUpdateOrder,
  getListOrdersQueryKey,
  getGetOrdersSummaryQueryKey,
  getGetRecentOrdersQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-300",
  processing: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-300",
  shipped: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-300",
  delivered: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-300",
};

const editSchema = z.object({
  customerName: z.string().min(2, "Customer name must be at least 2 characters."),
  product: z.string().min(2, "Product name must be at least 2 characters."),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  unitPrice: z.coerce.number().min(0, "Price must be positive."),
  notes: z.string().optional().nullable(),
});

type EditFormValues = z.infer<typeof editSchema>;

export default function OrderDetail() {
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [isEditing, setIsEditing] = useState(false);
  const initializedRef = useRef(false);

  const { data: order, isLoading, error } = useGetOrder(id, {
    query: { enabled: !!id, queryKey: getGetOrderQueryKey(id) }
  });

  const updateOrder = useUpdateOrder();

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      customerName: "",
      product: "",
      quantity: 1,
      unitPrice: 0,
      notes: "",
    },
  });

  useEffect(() => {
    if (order && !initializedRef.current) {
      form.reset({
        customerName: order.customerName,
        product: order.product,
        quantity: order.quantity,
        unitPrice: order.unitPrice,
        notes: order.notes || "",
      });
      initializedRef.current = true;
    }
  }, [order, form]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  };

  const handleStatusChange = (newStatus: string) => {
    if (!order || order.status === newStatus) return;
    
    updateOrder.mutate(
      { id, data: { status: newStatus as any } },
      {
        onSuccess: (updatedData) => {
          // Optimistically update the cache
          queryClient.setQueryData(getGetOrderQueryKey(id), updatedData);
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
          
          toast({
            title: "Status Updated",
            description: `Order is now marked as ${newStatus}.`,
          });
        },
        onError: (err) => {
          toast({
            title: "Failed to update status",
            description: err.error || "An unknown error occurred.",
            variant: "destructive",
          });
        }
      }
    );
  };

  const onSubmitEdit = (values: EditFormValues) => {
    updateOrder.mutate(
      { id, data: values },
      {
        onSuccess: (updatedData) => {
          queryClient.setQueryData(getGetOrderQueryKey(id), updatedData);
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentOrdersQueryKey() });
          setIsEditing(false);
          toast({
            title: "Order Updated",
            description: "The order details have been saved successfully.",
          });
        },
        onError: (err) => {
          toast({
            title: "Update Failed",
            description: err.error || "Could not save changes.",
            variant: "destructive",
          });
        }
      }
    );
  };

  const handleCancelEdit = () => {
    if (order) {
      form.reset({
        customerName: order.customerName,
        product: order.product,
        quantity: order.quantity,
        unitPrice: order.unitPrice,
        notes: order.notes || "",
      });
    }
    setIsEditing(false);
  };

  if (isLoading) {
    return <div className="p-12 text-center text-muted-foreground animate-pulse">Loading order details...</div>;
  }

  if (error || !order) {
    return (
      <div className="p-12 text-center text-destructive">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-bold mb-2">Order Not Found</h2>
        <p className="mb-6 opacity-80">We couldn't find the order you're looking for.</p>
        <Link href="/orders">
          <Button variant="outline">Back to Orders</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/orders">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-serif font-bold text-foreground">
                Order #{order.id.toString().padStart(4, "0")}
              </h1>
              {!isEditing && (
                <Badge variant="outline" className={`uppercase tracking-wider font-semibold border ${statusColors[order.status as keyof typeof statusColors]}`}>
                  {order.status}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm flex items-center gap-1.5 mt-1">
              <Calendar className="w-3.5 h-3.5" />
              Placed on {format(new Date(order.createdAt), "MMMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {!isEditing ? (
            <>
              <div className="w-48">
                <Select value={order.status} onValueChange={handleStatusChange} disabled={updateOrder.isPending}>
                  <SelectTrigger className="bg-card font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled" className="text-destructive focus:text-destructive">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={() => setIsEditing(true)} className="gap-2">
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {isEditing ? (
            <Form {...form}>
              <form id="edit-form" onSubmit={form.handleSubmit(onSubmitEdit)}>
                <Card className="shadow-sm border-border border-primary/50 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Edit Order Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <FormField
                      control={form.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="product"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="unitPrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unit Price ($)</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" step="0.01" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea 
                              className="min-h-[100px]" 
                              {...field} 
                              value={field.value || ""} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-3 justify-end pt-4 border-t border-border">
                      <Button type="button" variant="ghost" onClick={handleCancelEdit}>
                        <X className="w-4 h-4 mr-2" /> Cancel
                      </Button>
                      <Button type="submit" disabled={updateOrder.isPending}>
                        {updateOrder.isPending ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </form>
            </Form>
          ) : (
            <Card className="shadow-sm border-border bg-card overflow-hidden">
              <CardHeader className="bg-muted/10 border-b border-border">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5 text-muted-foreground" />
                  Customer Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-serif font-bold text-2xl border-2 border-background shadow-sm">
                    {order.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-medium">{order.customerName}</h3>
                    <p className="text-sm text-muted-foreground">Artisan Client</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {order.notes ? (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Order Notes</h4>
                      <div className="bg-muted/30 p-4 rounded-md text-sm leading-relaxed border border-border">
                        {order.notes}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground italic">No special notes provided.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {!isEditing && (
            <Card className="shadow-sm border-border bg-card">
              <CardHeader className="bg-muted/10 border-b border-border">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="w-5 h-5 text-muted-foreground" />
                  Item Specifications
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  <div className="p-6 flex flex-col sm:flex-row justify-between gap-4">
                    <div>
                      <h4 className="font-medium text-lg">{order.product}</h4>
                      <p className="text-sm text-muted-foreground mt-1">Handcrafted to order</p>
                    </div>
                    <div className="text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-4 sm:gap-1">
                      <div className="font-medium">{formatCurrency(order.unitPrice)} <span className="text-muted-foreground text-sm font-normal ml-1">each</span></div>
                      <div className="text-sm bg-secondary px-2 py-0.5 rounded-sm font-medium text-secondary-foreground">Qty: {order.quantity}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="shadow-sm border-border bg-sidebar">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-muted-foreground" />
                Financial Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal ({isEditing ? form.watch("quantity") : order.quantity} items)</span>
                  <span className="font-medium">
                    {formatCurrency(isEditing ? (form.watch("quantity") || 0) * (form.watch("unitPrice") || 0) : order.totalPrice)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-medium">Calculated</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between items-center">
                  <span className="font-medium text-base text-foreground">Total</span>
                  <span className="font-serif font-bold text-2xl text-primary">
                    {formatCurrency(isEditing ? (form.watch("quantity") || 0) * (form.watch("unitPrice") || 0) : order.totalPrice)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-xs text-center text-muted-foreground">
            <p>Last updated: {format(new Date(order.updatedAt), "MMM d, yyyy h:mm a")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
