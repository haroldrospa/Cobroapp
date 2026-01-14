import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import {
    format,
    subDays,
    startOfMonth,
    endOfMonth,
    startOfYear,
    endOfYear,
    startOfWeek,
    endOfWeek,
    subMonths,
    startOfDay,
    endOfDay
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

interface DateRangePickerProps {
    dateRange: DateRange | undefined;
    onDateRangeChange: (range: DateRange | undefined) => void;
    className?: string;
}

const DATE_PRESETS = [
    {
        label: 'Hoy',
        getValue: () => ({
            from: startOfDay(new Date()),
            to: endOfDay(new Date()),
        }),
    },
    {
        label: 'Ayer',
        getValue: () => {
            const yesterday = subDays(new Date(), 1);
            return {
                from: startOfDay(yesterday),
                to: endOfDay(yesterday),
            };
        },
    },
    {
        label: 'Esta semana',
        getValue: () => ({
            from: startOfWeek(new Date(), { weekStartsOn: 1 }), // Lunes
            to: endOfWeek(new Date(), { weekStartsOn: 1 }), // Domingo
        }),
    },
    {
        label: 'Últimos 7 días',
        getValue: () => ({
            from: startOfDay(subDays(new Date(), 6)),
            to: endOfDay(new Date()),
        }),
    },
    {
        label: 'Últimos 30 días',
        getValue: () => ({
            from: startOfDay(subDays(new Date(), 29)),
            to: endOfDay(new Date()),
        }),
    },
    {
        label: 'Este mes',
        getValue: () => ({
            from: startOfMonth(new Date()),
            to: endOfMonth(new Date()),
        }),
    },
    {
        label: 'Mes pasado',
        getValue: () => {
            const lastMonth = subMonths(new Date(), 1);
            return {
                from: startOfMonth(lastMonth),
                to: endOfMonth(lastMonth),
            };
        },
    },
    {
        label: 'Este año',
        getValue: () => ({
            from: startOfYear(new Date()),
            to: endOfYear(new Date()),
        }),
    },
];

export const DateRangePicker = ({ dateRange, onDateRangeChange, className }: DateRangePickerProps) => {
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    const handlePresetClick = (preset: typeof DATE_PRESETS[0]) => {
        onDateRangeChange(preset.getValue());
        setIsCalendarOpen(false);
    };

    const clearDates = () => {
        onDateRangeChange(undefined);
    };

    const formatDateRange = () => {
        if (!dateRange?.from) return 'Seleccionar rango';

        if (dateRange.to) {
            return `${format(dateRange.from, 'dd/MM/yyyy', { locale: es })} - ${format(dateRange.to, 'dd/MM/yyyy', { locale: es })}`;
        }

        return format(dateRange.from, 'dd/MM/yyyy', { locale: es });
    };

    return (
        <div className={cn('flex items-center gap-2 flex-wrap', className)}>
            {/* Quick Presets */}
            <div className="flex items-center gap-1 flex-wrap">
                {DATE_PRESETS.map((preset) => (
                    <Button
                        key={preset.label}
                        variant="outline"
                        size="sm"
                        className="h-9 px-4 text-sm font-medium"
                        onClick={() => handlePresetClick(preset)}
                    >
                        {preset.label}
                    </Button>
                ))}
            </div>

            {/* Range Selector */}
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                            'h-9 px-4 justify-start text-sm font-medium min-w-[240px]',
                            !dateRange && 'text-muted-foreground'
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formatDateRange()}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 [&>button]:hidden" align="start">
                    <Calendar
                        key={`${dateRange?.from?.getTime()}-${dateRange?.to?.getTime()}`}
                        mode="range"
                        selected={dateRange}
                        onSelect={(range) => {
                            // Properly handle range selection
                            if (range) {
                                onDateRangeChange({
                                    from: range.from ? startOfDay(range.from) : undefined,
                                    to: range.to ? endOfDay(range.to) : range.from ? endOfDay(range.from) : undefined,
                                });
                            } else {
                                onDateRangeChange(undefined);
                            }

                            // Auto-close when both dates are selected
                            if (range?.from && range?.to) {
                                setIsCalendarOpen(false);
                            }
                        }}
                        locale={es}
                        numberOfMonths={2}
                        initialFocus
                        className="p-3"
                    />
                </PopoverContent>
            </Popover>

            {/* Clear Button */}
            {(dateRange?.from || dateRange?.to) && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-3 text-sm text-muted-foreground hover:text-destructive"
                    onClick={clearDates}
                >
                    <X className="h-4 w-4" />
                </Button>
            )}
        </div>
    );
};
