import { useState, useRef } from "react";
import { Upload, X, RotateCcw, Save, ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useBrand } from "@/contexts/BrandContext";

interface BrandSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function BrandSettingsDialog({ open, onClose }: BrandSettingsDialogProps) {
  const { brand, update, uploadLogo, deleteLogo } = useBrand();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(brand.name);
  const [tagline, setTagline] = useState(brand.tagline);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [pendingLogo, setPendingLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  // Reset local state when dialog opens
  const handleOpen = (v: boolean) => {
    if (v) {
      setName(brand.name);
      setTagline(brand.tagline);
      setPreviewDataUrl(null);
      setPendingLogo(null);
    } else {
      onClose();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "يجب اختيار صورة", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "الصورة أكبر من 5MB", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPreviewDataUrl(dataUrl);
      setPendingLogo(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    if (pendingLogo) {
      setPreviewDataUrl(null);
      setPendingLogo(null);
      return;
    }
    setRemoving(true);
    try {
      await deleteLogo();
      toast({ title: "تم حذف اللوجو" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setRemoving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await update({ name, tagline });
      if (pendingLogo) {
        await uploadLogo(pendingLogo);
      }
      toast({ title: "تم حفظ الإعدادات" });
      onClose();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const currentLogoSrc = previewDataUrl ?? brand.logoUrl;
  const showLogoPlaceholder = !currentLogoSrc && !brand.hasLogo;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-sm bg-card border-border" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-sm">إعدادات العلامة التجارية</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Logo Section */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">اللوجو</Label>
            <div className="flex items-center gap-4">
              {/* Preview */}
              <div
                className="w-16 h-16 rounded-xl border-2 border-dashed border-border bg-muted/20 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {currentLogoSrc ? (
                  <img
                    src={currentLogoSrc}
                    alt="logo"
                    className="w-full h-full object-contain rounded-xl"
                  />
                ) : (
                  <div className="text-center">
                    <ImageIcon className="w-5 h-5 mx-auto text-muted-foreground/40" />
                    <p className="text-[9px] text-muted-foreground/40 mt-0.5">اضغط</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 flex-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5 w-full justify-start"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-3 h-3" />
                  رفع صورة جديدة
                </Button>
                {(currentLogoSrc || brand.hasLogo) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5 w-full justify-start text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
                    onClick={handleRemoveLogo}
                    disabled={removing}
                  >
                    <X className="w-3 h-3" />
                    {removing ? "جاري الحذف..." : pendingLogo ? "إلغاء" : "حذف اللوجو"}
                  </Button>
                )}
                <p className="text-[10px] text-muted-foreground/50">PNG, JPG, SVG — حد أقصى 5MB</p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">اسم الشركة / النظام</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-8 text-xs"
              placeholder="CAPRINA"
            />
          </div>

          {/* Tagline */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">الشعار (Tagline)</Label>
            <Input
              value={tagline}
              onChange={e => setTagline(e.target.value)}
              className="h-8 text-xs"
              placeholder="WIN OR DIE"
            />
            <p className="text-[10px] text-muted-foreground/50">
              يظهر تحت الاسم في الشريط الجانبي وصفحة الدخول
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="text-xs h-7">إلغاء</Button>
          <Button onClick={handleSave} disabled={saving} className="text-xs h-7 gap-1.5">
            <Save className="w-3 h-3" />
            {saving ? "جاري الحفظ..." : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
