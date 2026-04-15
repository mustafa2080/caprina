import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, Link } from "wouter";
import { ArrowRight, Save } from "lucide-react";
import { useCreateOrder, getListOrdersQueryKey, getGetOrdersSummaryQueryKey, getGetRecentOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const formSchema = z.object({
  customerName: z.string().min(2, "اسم العميل يجب أن يكون حرفين على الأقل."),
  product: z.string().min(2, "اسم المنتج يجب أن يكون حرفين على الأقل."),
  quantity: z.coerce.number().int().min(1, "الكمية يجب أن تكون 1 على الأقل."),
  unitPrice: z.coerce.number().min(0, "السعر يجب أن يكون موجباً."),
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
            title: "تم إنشاء الطلب",
            description: `الطلب #${newOrder.id} للعميل ${newOrder.customerName} تم إنشاؤه بنجاح.`,
          });

          setLocation(`/orders/${newOrder.id}`);
        },
        onError: (error) => {
          toast({
            title: "خطأ",
            description: error.error || "فشل إنشاء الطلب. حاول مرة أخرى.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const quantity = form.watch("quantity") || 0;
  const unitPrice = form.watch("unitPrice") || 0;
  const estimatedTotal = quantity * unitPrice;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(amount);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link href="/orders">
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" data-testid="button-back">
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">طلب جديد</h1>
          <p className="text-muted-foreground text-sm">أدخل تفاصيل الطلب الجديد.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <Card className="shadow-sm border-border">
                <CardHeader>
                  <CardTitle className="text-lg">بيانات العميل</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>اسم العميل</FormLabel>
                        <FormControl>
                          <Input placeholder="أحمد محمد" {...field} data-testid="input-customer-name" />
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
                        <FormLabel>ملاحظات الطلب</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="أي طلبات خاصة أو تعليمات التوصيل..."
                            className="min-h-[100px] resize-y"
                            {...field}
                            data-testid="input-notes"
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
                  <CardTitle className="text-lg">تفاصيل المنتج</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="product"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>اسم المنتج</FormLabel>
                        <FormControl>
                          <Input placeholder="اسم المنتج" {...field} data-testid="input-product" />
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
                          <FormLabel>الكمية</FormLabel>
                          <FormControl>
                            <Input type="number" min="1" {...field} data-testid="input-quantity" />
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
                          <FormLabel>سعر الوحدة (ر.س)</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" step="0.01" {...field} data-testid="input-unit-price" />
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
              <Card className="shadow-sm border-border bg-foreground text-background">
                <CardHeader>
                  <CardTitle className="text-lg text-background">الملخص</CardTitle>
                  <CardDescription className="text-background/50">حساب الطلب</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-background/60">المنتج</span>
                      <span className="font-semibold truncate max-w-[120px] text-background" title={form.watch("product")}>
                        {form.watch("product") || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-background/60">الكمية</span>
                      <span className="font-semibold text-background">{quantity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-background/60">السعر</span>
                      <span className="font-semibold text-background">{formatCurrency(unitPrice)}</span>
                    </div>
                    <div className="pt-3 border-t border-background/20 mt-3 flex justify-between items-center">
                      <span className="font-bold text-base text-background">الإجمالي</span>
                      <span className="font-bold text-xl text-primary">
                        {formatCurrency(estimatedTotal)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-background/20">
                    <Button
                      type="submit"
                      className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
                      disabled={createOrder.isPending}
                      data-testid="button-submit"
                    >
                      {createOrder.isPending ? (
                        <>جاري الحفظ...</>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          إنشاء الطلب
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
