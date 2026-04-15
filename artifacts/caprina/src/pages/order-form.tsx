import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, Link } from "wouter";
import { ArrowLeft, Save } from "lucide-react";
import { useCreateOrder, getListOrdersQueryKey, getGetOrdersSummaryQueryKey, getGetRecentOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  customerName: z.string().min(2, "Customer name must be at least 2 characters."),
  product: z.string().min(2, "Product name must be at least 2 characters."),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  unitPrice: z.coerce.number().min(0, "Price must be positive."),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function OrderForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createOrder = useCreateOrder();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: "",
      product: "",
      quantity: 1,
      unitPrice: 0,
      notes: "",
    },
  });

  const onSubmit = (values: FormValues) => {
    createOrder.mutate(
      { data: values },
      {
        onSuccess: (newOrder) => {
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentOrdersQueryKey() });
          
          toast({
            title: "Order Created",
            description: `Order #${newOrder.id} for ${newOrder.customerName} has been created successfully.`,
          });
          
          setLocation(`/orders/${newOrder.id}`);
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error.error || "Failed to create order. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const quantity = form.watch("quantity") || 0;
  const unitPrice = form.watch("unitPrice") || 0;
  const estimatedTotal = quantity * unitPrice;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link href="/orders">
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">New Order</h1>
          <p className="text-muted-foreground text-sm">Enter the details for a new artisan request.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <Card className="shadow-sm border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Customer Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Jane Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Order Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Any special requests, customizations, or delivery instructions..." 
                            className="min-h-[100px] resize-y"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card className="shadow-sm border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Product Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="product"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Handcrafted Leather Wallet" {...field} />
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
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="shadow-sm border-border bg-sidebar">
                <CardHeader>
                  <CardTitle className="text-lg">Summary</CardTitle>
                  <CardDescription>Order calculation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Item</span>
                      <span className="font-medium truncate max-w-[120px]" title={form.watch("product")}>
                        {form.watch("product") || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Quantity</span>
                      <span className="font-medium">{quantity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Price</span>
                      <span className="font-medium">{formatCurrency(unitPrice)}</span>
                    </div>
                    <div className="pt-3 border-t border-border mt-3 flex justify-between items-center">
                      <span className="font-medium text-base">Total</span>
                      <span className="font-serif font-bold text-xl text-primary">
                        {formatCurrency(estimatedTotal)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-6 border-t border-border">
                    <Button 
                      type="submit" 
                      className="w-full gap-2 shadow-sm"
                      disabled={createOrder.isPending}
                    >
                      {createOrder.isPending ? (
                        <>Saving...</>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Create Order
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
