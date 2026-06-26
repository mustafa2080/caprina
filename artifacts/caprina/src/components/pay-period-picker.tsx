import React, { useState } from "react";
import { Calendar, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Returns the "pay period" label for a given YYYY-MM value.
 *  Period: 26th of prev month → 25th of this month.
 *  e.g. "2026-06"  →  "26 مايو ← 25 يونيو 2026"
 */
function periodLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  const endDate = new Date(y, m - 1, 25);
  const startDate = new Date(y, m - 2, 26);
  const fmt = (d: Date) =>
    d.toLocaleDateString("ar-EG", { day: "numeric", month: "long" });
  const year = endDate.getFullYear();
  return `${fmt(startDate)} ← ${fmt(endDate)} ${year}`;
}

/** Returns YYYY-MM for "today" using the same logic as getPayPeriodDates:
 *  if today >= 26 → current calendar month
 *  if today < 26  → previous calendar month
 */
export function currentPayPeriodValue(): string {
  const now = new Date();
  const d = now.getDate();
  // If today is 26+, the current pay period ends on the 25th of NEXT month → month = next month
  // But getPayPeriod on the backend treats "month" as the END month (25th).
  // So current period: if day >= 26, the period just started → end month is next month
  //                    if day < 26,  we're inside this period → end month is this month
  let year = now.getFullYear();
  let month = now.getMonth() + 1; // 1-based
  if (d >= 26) {
    // Advance to next month
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

const MONTH_NAMES_AR = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

// ─── component ────────────────────────────────────────────────────────────────

interface PayPeriodPickerProps {
  value: string;          // YYYY-MM
  onChange: (v: string) => void;
  className?: string;
  disabled?: boolean;
}

export function PayPeriodPicker({ value, onChange, className, disabled }: PayPeriodPickerProps) {
  const current = currentPayPeriodValue();
  const [open, setOpen] = useState(false);

  // year shown in the popover grid
  const [gridYear, setGridYear] = useState(() => {
    const v = value || current;
    return parseInt(v.split("-")[0]);
  });

  const handleSelect = (yyyyMm: string) => {
    onChange(yyyyMm);
    setOpen(false);
  };

  const label = periodLabel(value || current);
  const isCurrentPeriod = (value || current) === current;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-8 gap-2 text-xs font-medium border-border bg-background hover:bg-muted/40 transition-colors",
            isCurrentPeriod && "border-primary/40",
            className,
          )}
        >
          <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="truncate max-w-[200px]">{label}</span>
          {isCurrentPeriod && (
            <span className="shrink-0 text-[9px] bg-primary/15 text-primary rounded-full px-1.5 py-0.5 font-bold leading-none">
              الحالي
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-72 p-3 shadow-xl border border-border bg-popover"
        align="start"
        dir="rtl"
      >
        {/* ── Year nav ── */}
        <div className="flex items-center justify-between mb-3">
          <button
            className="p-1 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
            onClick={() => setGridYear(y => y - 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold">{gridYear}</span>
          <button
            className="p-1 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
            onClick={() => setGridYear(y => y + 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* ── Quick shortcut ── */}
        <button
          onClick={() => { setGridYear(parseInt(current.split("-")[0])); handleSelect(current); }}
          className={cn(
            "w-full mb-3 rounded-lg py-1.5 text-xs font-bold border transition-colors",
            (value || current) === current
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground",
          )}
        >
          الفترة الحالية
        </button>

        {/* ── Month grid ── */}
        <div className="grid grid-cols-3 gap-1.5">
          {MONTH_NAMES_AR.map((name, idx) => {
            const monthNum = idx + 1;
            const yyyyMm = `${gridYear}-${String(monthNum).padStart(2, "0")}`;
            const isSelected = yyyyMm === (value || current);
            const isCurrent  = yyyyMm === current;
            return (
              <button
                key={yyyyMm}
                onClick={() => handleSelect(yyyyMm)}
                className={cn(
                  "relative rounded-lg py-2 text-xs font-medium transition-colors border",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : isCurrent
                    ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                    : "bg-muted/20 text-foreground border-transparent hover:bg-muted/50",
                )}
              >
                {name}
                {isCurrent && !isSelected && (
                  <span className="absolute -top-1 -left-1 w-2 h-2 bg-primary rounded-full border border-background" />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Period label preview ── */}
        <div className="mt-3 pt-2 border-t border-border/50 text-center">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {periodLabel(value || current)}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
