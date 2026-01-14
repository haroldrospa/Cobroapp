import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

interface InvoiceSequenceInputProps {
    id: string;
    invoiceTypeId: string;
    currentNumber: number; // This is actually the "last used" number from DB
    onUpdate: (id: string, newNumber: number, invoiceTypeId: string) => Promise<void>;
}

export const InvoiceSequenceInput = ({
    id,
    invoiceTypeId,
    currentNumber,
    onUpdate
}: InvoiceSequenceInputProps) => {
    // We want to edit the "Next Number", which is currentNumber + 1
    const initialNextNumber = currentNumber + 1;
    const [value, setValue] = useState(String(initialNextNumber));
    const [isUpdating, setIsUpdating] = useState(false);
    const prevCurrentNumberRef = useRef(currentNumber);

    // Update local state if the prop changes externally
    useEffect(() => {
        if (prevCurrentNumberRef.current !== currentNumber) {
            setValue(String(currentNumber + 1));
            prevCurrentNumberRef.current = currentNumber;
        }
    }, [currentNumber]);

    const handleSave = async () => {
        const numericValue = parseInt(value);

        // Basic validation
        if (isNaN(numericValue) || numericValue < 1) {
            // Revert if invalid
            setValue(String(currentNumber + 1));
            return;
        }

        // The logic: 
        // Input shows "Next Number" (e.g. 1765)
        // DB stores "Current/Last Number" (e.g. 1764)
        // So we need to save (numericValue - 1)
        const valueToSave = numericValue - 1;

        // Optimization: Don't save if unchanged
        if (valueToSave === currentNumber) return;

        setIsUpdating(true);
        try {
            await onUpdate(id, valueToSave, invoiceTypeId);
        } catch (e) {
            // Revert on error
            setValue(String(currentNumber + 1));
            console.error(e);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    };

    return (
        <div className="flex items-center gap-2">
            <div className="relative">
                <Input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    className={`w-24 text-center ${isUpdating ? 'pr-8' : ''}`}
                    disabled={isUpdating}
                />
                {isUpdating && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                    </div>
                )}
            </div>
            <span className="text-sm text-muted-foreground font-mono">
                → {invoiceTypeId}-{String(value).padStart(8, '0')}
            </span>
        </div>
    );
};

export default InvoiceSequenceInput;
