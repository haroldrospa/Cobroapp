import React from 'react';
import { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Category } from '@/hooks/useCategories';
import { ProductFormData } from './productFormSchema';
import { ProductImageUpload } from './ProductImageUpload';
import { Separator } from '@/components/ui/separator';
import { Percent, Star, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ProductFormFieldsProps {
  register: UseFormRegister<ProductFormData>;
  errors: FieldErrors<ProductFormData>;
  setValue: UseFormSetValue<ProductFormData>;
  watch: UseFormWatch<ProductFormData>;
  categories: Category[];
}

export const ProductFormFields: React.FC<ProductFormFieldsProps> = ({
  register,
  errors,
  setValue,
  watch,
  categories,
}) => {
  const selectedCategoryId = watch('category_id');
  const costIncludesTax = watch('cost_includes_tax');
  const isFeatured = watch('is_featured');
  const price = watch('price');
  const cost = watch('cost');
  const discountPercentage = watch('discount_percentage') || 0;

  const startDate = watch('discount_start_date');
  const endDate = watch('discount_end_date');

  // Helper to safely parse YYYY-MM-DD string to Date
  const parseDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return undefined;
    // Append T12:00:00 to avoid timezone shifts when just using 'YYYY-MM-DD'
    return new Date(dateStr + 'T12:00:00');
  };

  // Helper to update end date based on duration
  const setDuration = (days: number) => {
    const start = startDate ? parseDate(startDate) : new Date();
    if (start) {
      const end = addDays(start, days);
      setValue('discount_end_date', format(end, 'yyyy-MM-dd'));
      if (!startDate) {
        setValue('discount_start_date', format(new Date(), 'yyyy-MM-dd'));
      }
    }
  };

  // Calculate Profit
  const profitPercentage = React.useMemo(() => {
    if (!cost || cost === 0 || !price) return 0;
    return ((price - cost) / cost * 100).toFixed(2);
  }, [price, cost]);

  // Calculate Discounted Price
  const discountedPrice = React.useMemo(() => {
    if (!price || discountPercentage <= 0) return null;
    return price * (1 - discountPercentage / 100);
  }, [price, discountPercentage]);

  return (
    <>
      {/* Campos más comunes - Arriba */}
      <ProductImageUpload
        imageUrl={watch('image_url')}
        onImageUpload={(url) => setValue('image_url', url)}
      />

      <div>
        <Label htmlFor="name">Nombre *</Label>
        <Input
          id="name"
          {...register('name')}
          placeholder="Nombre del producto"
        />
        {errors.name && (
          <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="price">Precio *</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            {...register('price', { valueAsNumber: true })}
            placeholder="0.00"
          />
          {errors.price && (
            <p className="text-sm text-red-500 mt-1">{errors.price.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="stock">Stock *</Label>
          <Input
            id="stock"
            type="number"
            {...register('stock', { valueAsNumber: true })}
            placeholder="0"
          />
          {errors.stock && (
            <p className="text-sm text-red-500 mt-1">{errors.stock.message}</p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="cost">Costo</Label>
        <Input
          id="cost"
          type="number"
          step="0.01"
          {...register('cost', { valueAsNumber: true })}
          placeholder="0.00"
        />
        {errors.cost && (
          <p className="text-sm text-red-500 mt-1">{errors.cost.message}</p>
        )}
      </div>

      {cost && price && (
        <div className="p-3 bg-muted rounded-md">
          <Label className="text-sm font-medium">Porcentaje de Ganancia</Label>
          <p className="text-2xl font-bold text-primary mt-1">
            {profitPercentage}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Margen calculado: ${(price - cost).toFixed(2)}
          </p>
        </div>
      )}

      <div>
        <Label htmlFor="category">Categoría</Label>
        <Select value={selectedCategoryId || "no-category"} onValueChange={(value) => setValue('category_id', value === "no-category" ? "" : value)}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="no-category">Sin categoría</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="barcode">Código de Barras</Label>
        <Input
          id="barcode"
          {...register('barcode')}
          placeholder="Código de barras"
        />
      </div>

      {/* Sección de Descuentos y Ofertas */}
      <Separator className="my-4" />
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Percent className="h-4 w-4 text-destructive" />
          <Label className="text-base font-semibold">Descuentos y Ofertas</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_featured"
            checked={isFeatured}
            onCheckedChange={(checked) => setValue('is_featured', !!checked)}
          />
          <Label htmlFor="is_featured" className="text-sm font-normal flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            Producto destacado (aparece en ofertas)
          </Label>
        </div>

        <div>
          <Label htmlFor="discount_percentage">Porcentaje de Descuento (%)</Label>
          <Input
            id="discount_percentage"
            type="number"
            step="1"
            min="0"
            max="100"
            {...register('discount_percentage', { valueAsNumber: true })}
            placeholder="0"
          />
          {discountedPrice && (
            <div className="mt-2 p-2 bg-destructive/10 rounded-md flex items-center justify-between">
              <span className="text-sm">Precio con descuento:</span>
              <div className="flex items-center gap-2">
                <span className="text-sm line-through text-muted-foreground">${price?.toFixed(2)}</span>
                <span className="text-lg font-bold text-destructive">${discountedPrice.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Date Pickers with Shortcuts */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col space-y-2">
              <Label>Fecha Inicio</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(parseDate(startDate)!, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={parseDate(startDate)}
                    onSelect={(date) => date && setValue('discount_start_date', format(date, 'yyyy-MM-dd'))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col space-y-2">
              <Label>Fecha Fin</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(parseDate(endDate)!, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={parseDate(endDate)}
                    onSelect={(date) => date && setValue('discount_end_date', format(date, 'yyyy-MM-dd'))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Quick Duration Buttons */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Duración de la oferta:</Label>
            <div className="flex gap-2 flex-wrap">
              <Button type="button" variant="outline" size="sm" onClick={() => setDuration(3)} className="h-8">3 Días</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setDuration(7)} className="h-8">7 Días</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setDuration(15)} className="h-8">15 Días</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setDuration(30)} className="h-8">30 Días</Button>
            </div>
          </div>
        </div>

      </div>

      <Separator className="my-4" />

      {/* Campos menos comunes - Abajo */}
      <div>
        <Label htmlFor="internal_code">Código Interno</Label>
        <Input
          id="internal_code"
          {...register('internal_code')}
          placeholder="Código interno del producto"
        />
      </div>

      <div>
        <Label htmlFor="tax_percentage">Porcentaje de Impuesto (%)</Label>
        <Input
          id="tax_percentage"
          type="number"
          step="0.01"
          {...register('tax_percentage', { valueAsNumber: true })}
          placeholder="18"
        />
        {errors.tax_percentage && (
          <p className="text-sm text-red-500 mt-1">{errors.tax_percentage.message}</p>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="cost_includes_tax"
          checked={costIncludesTax}
          onCheckedChange={(checked) => setValue('cost_includes_tax', !!checked)}
        />
        <Label htmlFor="cost_includes_tax" className="text-sm font-normal">
          El costo incluye impuesto
        </Label>
      </div>

      <div>
        <Label htmlFor="min_stock">Stock Mínimo *</Label>
        <Input
          id="min_stock"
          type="number"
          {...register('min_stock', { valueAsNumber: true })}
          placeholder="0"
        />
        {errors.min_stock && (
          <p className="text-sm text-red-500 mt-1">{errors.min_stock.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="status">Estado</Label>
        <Select value={watch('status')} onValueChange={(value: 'active' | 'inactive') => setValue('status', value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Activo</SelectItem>
            <SelectItem value="inactive">Inactivo</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
};
