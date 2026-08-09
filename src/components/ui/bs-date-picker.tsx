import { useState } from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  adToBs,
  bsToAd,
  daysInBsMonth,
  BS_MONTHS,
  type BSDate,
} from "@/lib/date-conversion";

interface BsDatePickerProps {
  value: string; // AD date string (YYYY-MM-DD)
  onChange: (adDate: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

function getCurrentBS(): BSDate {
  const today = new Date();
  const bs = adToBs(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`,
  );
  return bs || { year: 2082, month: 1, day: 1 };
}

export function BsDatePicker({ value, onChange, placeholder = "Select date", className, disabled }: BsDatePickerProps) {
  const [open, setOpen] = useState(false);

  // Convert AD value to BS for display
  const bsDate: BSDate | null = value ? adToBs(value) : null;
  const currentBS = getCurrentBS();

  const [viewYear, setViewYear] = useState(bsDate?.year ?? currentBS.year);
  const [viewMonth, setViewMonth] = useState(bsDate?.month ?? currentBS.month);

  const daysInMonth = daysInBsMonth(viewYear, viewMonth);

  // Build grid of days (BS months start on different weekdays, just fill 1-N)
  const days: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }

  // Find which weekday the 1st falls on (0=Sun ... 6=Sat)
  // Use AD equivalent to find weekday
  const firstOfAd = bsToAd(viewYear, viewMonth, 1);
  const firstWeekday = firstOfAd
    ? new Date(firstOfAd.year, firstOfAd.month - 1, firstOfAd.day).getDay()
    : 0;

  // Empty cells before the 1st
  const leadingEmpties = Array.from({ length: firstWeekday }, (_, i) => i);

  const displayText = bsDate
    ? `${bsDate.year}-${String(bsDate.month).padStart(2, "0")}-${String(bsDate.day).padStart(2, "0")}`
    : "";

  function selectDay(day: number) {
    const ad = bsToAd(viewYear, viewMonth, day);
    if (ad) {
      const adStr = `${ad.year}-${String(ad.month).padStart(2, "0")}-${String(ad.day).padStart(2, "0")}`;
      onChange(adStr);
    }
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-44 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono",
            className,
          )}
        >
          <span className={cn(!displayText && "text-muted-foreground")}>
            {displayText || placeholder}
          </span>
          <CalendarIcon className="h-4 w-4 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        {/* Month/Year navigation */}
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              if (viewMonth === 1) {
                setViewMonth(12);
                setViewYear(viewYear - 1);
              } else {
                setViewMonth(viewMonth - 1);
              }
            }}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <div className="flex items-center gap-2">
            <select
              className="text-sm font-medium border rounded px-1 py-0.5 bg-background"
              value={viewMonth}
              onChange={(e) => setViewMonth(Number(e.target.value))}
            >
              {BS_MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              className="text-sm font-medium border rounded px-1 py-0.5 bg-background"
              value={viewYear}
              onChange={(e) => setViewYear(Number(e.target.value))}
            >
              {Array.from({ length: 91 }, (_, i) => 2000 + i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              if (viewMonth === 12) {
                setViewMonth(1);
                setViewYear(viewYear + 1);
              } else {
                setViewMonth(viewMonth + 1);
              }
            }}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-0 mb-1">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-0">
          {leadingEmpties.map((e) => (
            <div key={`empty-${e}`} />
          ))}
          {days.map((day) => {
            const isSelected =
              bsDate &&
              bsDate.year === viewYear &&
              bsDate.month === viewMonth &&
              bsDate.day === day;
            const isToday =
              currentBS.year === viewYear &&
              currentBS.month === viewMonth &&
              currentBS.day === day;

            return (
              <button
                key={day}
                type="button"
                className={cn(
                  "h-8 w-8 text-xs rounded-md transition-colors",
                  "hover:bg-primary/10 hover:text-primary",
                  isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                  isToday && !isSelected && "font-bold underline",
                )}
                onClick={() => selectDay(day)}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Today button */}
        <div className="mt-2 pt-2 border-t flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => {
              setViewYear(currentBS.year);
              setViewMonth(currentBS.month);
              const adStr = `${currentBS.year}-${String(currentBS.month).padStart(2, "0")}-${String(currentBS.day).padStart(2, "0")}`;
              // Convert BS today to AD for storage
              const adToday = bsToAd(currentBS.year, currentBS.month, currentBS.day);
              if (adToday) {
                const ad = `${adToday.year}-${String(adToday.month).padStart(2, "0")}-${adToday.day}`;
                onChange(ad);
              }
              setOpen(false);
            }}
          >
            Today
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
