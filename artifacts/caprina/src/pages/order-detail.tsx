import { useParams, Link } from "wouter";
import { format } from "date-fns";
import {
  ArrowRight,
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

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  processing: "جاري التجهيز",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  processing: "bg-blue-50 text-blue-800 border-blue-200",
  shipped: "bg-purple-50 text-purple-800 border-purple-200",
  delivered: "bg-emerald-50 text-emerald-800 border-emerald-200",
  cancelled: "bg-red-50 text-red-800 border-red-200",
};

const editSchema = z.object({
  customerName: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل."),
  product: z.string().min(2, "المنتج يجب أن يكون حرفين على الأقل."),
  quantity: z.coerce.number().int().min(1, "الكمية يجب أن تكون 1 على الأقل."),
  unitPrice: z.coerce.number().min(0, "السعر يجب أن يكون موجباً."),
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

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(amount);

  const handleStatusChange = (newStatus: string) => {
    if (!order || order.status === newStatus) return;

    updateOrder.mutate(
      { id, data: { status: newStatus as any } },
      {
        onSuccess: (updatedData) => {
          queryClient.setQueryData(getGetOrderQueryKey(id), updatedData);
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });

          toast({
            title: "تم تحديث الحالة",
            description: `الطلب أصبح الآن: ${statusLabels[newStatus] || newStatus}.`,
          });
        },
        onError: () => {
          toast({
            title: "فشل التحديث",
            description: "حدث خطأ أثناء تحديث الحالة.",
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
            title: "تم تحديث الطلب",
            description: "تم حفظ التعديلات بنجاح.",
          });
        },
        onError: () => {
          toast({
            title: "فشل التحديث",
            description: "تعذّر حفظ التغييرات.",
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
    return <div className="p-12 text-center text-muted-foreground animate-pulse">جاري تحميل تفاصيل الطلب...</div>;
  }

  if (error || !order) {
    return (
      <div className="p-12 text-center text-destructive">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-bold mb-2">الطلب غير موجود</h2>
        <p className="mb-6 opacity-80">لم نتمكن من إيجاد الطلب المطلوب.</p>
        <Link href="/orders">
          <Button variant="outline">العودة إلى الطلبات</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/orders">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" data-testid="button-back">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">
                طلب #{order.id.toString().padStart(4, "0")}
              </h1>
              {!isEditing && (
                <Badge variant="outline" className={`font-semibold border ${statusColors[order.status] || ""}`}>
                  {statusLabels[order.status] || order.status}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm flex items-center gap-1.5 mt-1">
              <Calendar className="w-3.5 h-3.5" />
              تم الإنشاء في {format(new Date(order.createdAt), "yyyy/MM/dd")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isEditing ? (
            <>
              <div className="w-52">
                <Select value={order.status} onValueChange={handleStatusChange} disabled={updateOrder.isPending}>
                  <SelectTrigger className="bg-card font-medium" data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">قيد الانتظار</SelectItem>
                    <SelectItem value="processing">جاري التجهيز</SelectItem>
                    <SelectItem value="shipped">تم الشحن</SelectItem>
                    <SelectItem value="delivered">تم التسليم</SelectItem>
                    <SelectItem value="cancelled" className="text-destructive focus:text-destructive">ملغي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={() => setIsEditing(true)} className="gap-2" data-testid="button-edit">
                <Pencil className="w-4 h-4" />
                تعديل
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
                  <div className="absolute top-0 right-0 w-1 h-full bg-primary" />
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">تعديل الطلب</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <FormField
                      control={form.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>اسم العميل</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="product"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>المنتج</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
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
                            <FormControl><Input type="number" min="1" {...field} /></FormControl>
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
                            <FormControl><Input type="number" min="0" step="0.01" {...field} /></FormControl>
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
                          <FormLabel>ملاحظات</FormLabel>
                          <FormControl>
                            <Textarea className="min-h-[100px]" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-3 justify-start pt-4 border-t border-border">
                      <Button type="submit" disabled={updateOrder.isPending} data-testid="button-save">
                        {updateOrder.isPending ? "جاري الحفظ..." : <><Save className="w-4 h-4 ml-2" />حفظ التغييرات</>}
                      </Button>
                      <Button type="button" variant="ghost" onClick={handleCancelEdit} data-testid="button-cancel">
                        <X className="w-4 h-4 ml-2" />إلغاء
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
                  بيانات العميل
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-full bg-foreground flex items-center justify-center text-background font-bold text-2xl border-2 border-background shadow-sm shrink-0">
                    {order.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">{order.customerName}</h3>
                    <p className="text-sm text-muted-foreground">عميل CAPRINA</p>
                  </div>
                </div>

                {order.notes ? (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">ملاحظات الطلب</h4>
                    <div className="bg-muted/30 p-4 rounded-md text-sm leading-relaxed border border-border">
                      {order.notes}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">لا توجد ملاحظات خاصة.</div>
                )}
              </CardContent>
            </Card>
          )}

          {!isEditing && (
            <Card className="shadow-sm border-border bg-card">
              <CardHeader className="bg-muted/10 border-b border-border">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="w-5 h-5 text-muted-foreground" />
                  تفاصيل المنتج
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  <div className="p-6 flex flex-col sm:flex-row justify-between gap-4">
                    <div>
                      <h4 className="font-semibold text-lg">{order.product}</h4>
                      <p className="text-sm text-muted-foreground mt-1">منتج مطلوب</p>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-4 sm:gap-1">
                      <div className="font-semibold">{formatCurrency(order.unitPrice)} <span className="text-muted-foreground text-sm font-normal">/ وحدة</span></div>
                      <div className="text-sm bg-foreground text-background px-3 py-0.5 rounded-sm font-bold">الكمية: {order.quantity}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="shadow-sm border-border bg-foreground text-background">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2 text-background">
                <CreditCard className="w-5 h-5 text-primary" />
                الملخص المالي
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-background/60">الإجمالي الفرعي ({isEditing ? form.watch("quantity") : order.quantity} وحدة)</span>
                  <span className="font-semibold text-background">
                    {formatCurrency(isEditing ? (form.watch("quantity") || 0) * (form.watch("unitPrice") || 0) : order.totalPrice)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-background/60">الشحن</span>
                  <span className="font-semibold text-background">يُحسب</span>
                </div>
                <Separator className="my-2 bg-background/20" />
                <div className="flex justify-between items-center">
                  <span className="font-bold text-base text-background">الإجمالي</span>
                  <span className="font-bold text-2xl text-primary">
                    {formatCurrency(isEditing ? (form.watch("quantity") || 0) * (form.watch("unitPrice") || 0) : order.totalPrice)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-xs text-center text-muted-foreground">
            <p>آخر تحديث: {format(new Date(order.updatedAt), "yyyy/MM/dd")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
