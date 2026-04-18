import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Send, Eye, ChevronDown, Phone } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { type WaSettings, type WaTemplate, type WhatsAppOrderData, applyTemplate, buildWhatsAppLink, formatEgyptianPhone } from "@/lib/whatsapp";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  order: WhatsAppOrderData | null;
  onSent?: () => void;
}

export function WhatsAppDialog({ open, onOpenChange, order, onSent }: Props) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [preview, setPreview] = useState("");
  const [editingBody, setEditingBody] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const { data: settings } = useQuery<WaSettings>({
    queryKey: ["whatsapp-settings"],
    queryFn: () => apiFetch<WaSettings>("/whatsapp/settings"),
    staleTime: 30_000,
  });

  const templates = settings?.templates ?? [];
  const defaultTpl = templates.find(t => t.isDefault) ?? templates[0];

  useEffect(() => {
    if (!open || !order) return;
    const tpl = templates.find(t => t.id === selectedId) ?? defaultTpl;
    if (tpl) {
      setSelectedId(tpl.id);
      const body = applyTemplate(tpl.body, order);
      setEditingBody(body);
      setPreview(body);
    }
  }, [open, order, templates.length]);

  useEffect(() => {
    if (!order) return;
    setPreview(editingBody);
  }, [editingBody, order]);

  const selectTemplate = (tpl: WaTemplate) => {
    if (!order) return;
    setSelectedId(tpl.id);
    const body = applyTemplate(tpl.body, order);
    setEditingBody(body);
  };

  const handleSend = () => {
    if (!order?.phone || !editingBody) return;
    const link = buildWhatsAppLink(order.phone, editingBody);
    window.open(link, "_blank", "noopener,noreferrer");
    onOpenChange(false);
    onSent?.();
  };

  if (!order) return null;

  const formattedPhone = order.phone ? formatEgyptianPhone(order.phone) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-500">
            <MessageCircle className="w-5 h-5" />
            إرسال واتساب — {order.customerName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            اختر قالباً أو عدّل الرسالة قبل الإرسال
          </DialogDescription>
        </DialogHeader>

        {/* Customer info */}
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 border border-border text-sm">
          <Phone className="w-4 h-4 text-green-500 shrink-0" />
          <span className="font-bold">{order.customerName}</span>
          <span className="text-muted-foreground font-mono text-xs mr-auto">{formattedPhone ?? "لا يوجد رقم"}</span>
          {!order.phone && (
            <Badge variant="destructive" className="text-[9px]">لا يوجد رقم</Badge>
          )}
        </div>

        {/* Template chooser */}
        {templates.length > 0 && (
          <div>
            <Label className="text-xs font-bold mb-2 block">القوالب المتاحة</Label>
            <div className="flex flex-wrap gap-2">
              {templates.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => selectTemplate(tpl)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    selectedId === tpl.id
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-card text-muted-foreground border-border hover:border-green-500 hover:text-green-500"
                  }`}
                >
                  {tpl.name}
                  {tpl.isDefault && <span className="mr-1 opacity-70">★</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message editor */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label className="text-xs font-bold">نص الرسالة</Label>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="text-[10px] text-primary flex items-center gap-1 hover:underline"
            >
              <Eye className="w-3 h-3" />
              {showPreview ? "تعديل" : "معاينة"}
            </button>
          </div>

          {showPreview ? (
            <div
              className="bg-[#dcf8c6] dark:bg-green-900/30 text-[#111] dark:text-green-100 rounded-xl rounded-tl-none p-3 text-sm leading-relaxed whitespace-pre-wrap min-h-[120px] font-[Cairo]"
              style={{ direction: "rtl" }}
            >
              {preview}
            </div>
          ) : (
            <Textarea
              value={editingBody}
              onChange={e => setEditingBody(e.target.value)}
              className="min-h-[120px] text-sm leading-relaxed resize-none bg-muted/20"
              placeholder="اكتب رسالتك هنا..."
            />
          )}
          <p className="text-[10px] text-muted-foreground mt-1">
            {editingBody.length} حرف
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            onClick={handleSend}
            disabled={!order.phone || !editingBody.trim()}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2 font-bold"
          >
            <Send className="w-4 h-4" />
            فتح واتساب وإرسال
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">
            إلغاء
          </Button>
        </div>
        {!order.phone && (
          <p className="text-xs text-destructive text-center">
            لا يوجد رقم هاتف لهذا العميل — يجب إضافته أولاً
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
