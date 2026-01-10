
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { Product, useCreateProduct, useUpdateProduct } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useToast } from '@/hooks/use-toast';
import { productSchema, ProductFormData } from './product-form/productFormSchema';
import { ProductFormFields } from './product-form/ProductFormFields';
import { ProductFormActions } from './product-form/ProductFormActions';

interface ProductFormProps {
  product?: Product;
  onClose: () => void;
  onSuccess: () => void;
}

const ProductForm: React.FC<ProductFormProps> = ({ product, onClose, onSuccess }) => {
  const { data: categories = [] } = useCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const { toast } = useToast();

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name || '',
      price: product?.price || 0,
      cost: product?.cost || undefined,
      cost_includes_tax: product?.cost_includes_tax || false,
      tax_percentage: product?.tax_percentage || 18,
      internal_code: product?.internal_code || '',
      barcode: product?.barcode || '',
      category_id: product?.category_id || '',
      stock: product?.stock || 0,
      min_stock: product?.min_stock || 0,
      status: (product?.status === 'low_stock' ? 'active' : product?.status) || 'active',
      image_url: product?.image_url || '',
      discount_percentage: product?.discount_percentage || 0,
      discount_start_date: product?.discount_start_date || '',
      discount_end_date: product?.discount_end_date || '',
      is_featured: product?.is_featured || false,
    },
  });

  const onSubmit = async (data: ProductFormData) => {
    try {
      console.log('Submitting form data:', data);
      
      // Ensure all required fields are present and properly formatted
      const productData = {
        name: data.name,
        price: Number(data.price),
        cost: data.cost ? Number(data.cost) : undefined,
        cost_includes_tax: Boolean(data.cost_includes_tax),
        tax_percentage: Number(data.tax_percentage),
        internal_code: data.internal_code || undefined,
        barcode: data.barcode || undefined,
        category_id: data.category_id && data.category_id !== '' ? data.category_id : null,
        stock: Number(data.stock),
        min_stock: Number(data.min_stock),
        status: data.status,
        image_url: data.image_url && data.image_url !== '' ? data.image_url : undefined,
        discount_percentage: Number(data.discount_percentage) || 0,
        discount_start_date: data.discount_start_date && data.discount_start_date !== '' ? data.discount_start_date : null,
        discount_end_date: data.discount_end_date && data.discount_end_date !== '' ? data.discount_end_date : null,
        is_featured: Boolean(data.is_featured),
      };

      console.log('Formatted product data:', productData);

      if (product) {
        await updateProduct.mutateAsync({
          id: product.id,
          ...productData,
        });
        toast({
          title: "Producto actualizado",
          description: "El producto se ha actualizado correctamente.",
        });
      } else {
        await createProduct.mutateAsync(productData);
        toast({
          title: "Producto creado",
          description: "El producto se ha creado correctamente.",
        });
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error al guardar producto:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo guardar el producto. Inténtalo de nuevo.",
      });
    }
  };

  const isLoading = createProduct.isPending || updateProduct.isPending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{product ? 'Editar Producto' : 'Nuevo Producto'}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <ProductFormFields
              register={register}
              errors={errors}
              setValue={setValue}
              watch={watch}
              categories={categories}
            />
            <ProductFormActions
              onClose={onClose}
              isLoading={isLoading}
            />
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductForm;
