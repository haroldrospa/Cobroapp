import React, { useState, useRef } from 'react';
import { Package, Plus, Search, Edit, Trash2, Upload, Download, Hash, Barcode, Tag, DollarSign, AlertTriangle, Printer, Loader2 } from 'lucide-react';
import { LoadingLogo } from '@/components/ui/loading-logo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useDeleteProduct, useDeleteAllProducts, Product } from '@/hooks/useProducts';
import { useProductsOffline } from '@/hooks/useProductsOffline';
import { useCategories } from '@/hooks/useCategories';
import { useToast } from '@/hooks/use-toast';
import ProductForm from './ProductForm';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as XLSX from 'xlsx';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

type SearchType = 'name' | 'id' | 'barcode' | 'category';

const Products: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('name');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const { data: products = [], isLoading } = useProductsOffline();
  const { data: categories = [] } = useCategories();
  const deleteProduct = useDeleteProduct();
  const deleteAllProducts = useDeleteAllProducts();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calcular el valor total del inventario (costo * stock de cada producto)
  const inventoryValue = products.reduce((total, product) => {
    const cost = product.cost || 0;
    const stock = product.stock || 0;
    return total + (cost * stock);
  }, 0);
  // Contar productos con stock bajo
  // Un producto está bajo de stock si su stock actual es menor o igual al mínimo
  const lowStockProducts = products.filter(p => {
    const currentStock = p.stock || 0;
    const minStock = p.min_stock || 0;
    // Si min_stock es 0, quizás no queremos alertar, o sí? Asumiremos que si se configura alerta > 0
    // Pero el caso del usuario tiene min: 10.
    // Simplemente: stock <= min_stock
    return currentStock <= minStock;
  });
  const lowStockCount = lowStockProducts.length;

  // Función para descargar planilla de ejemplo
  const handleDownloadTemplate = () => {
    const headers = [
      ['Nombre', 'Precio', 'Costo', 'Stock', 'Stock Mínimo', 'Código de Barras', 'Categoría', 'Estado'],
      ['Ejemplo Producto', '100.00', '80.00', '50', '10', '7441000000000', 'General', 'active']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(headers);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla");
    XLSX.writeFile(workbook, "plantilla_productos.xlsx");
  };

  // Función para eliminar todos los productos
  const handleDeleteAll = async () => {
    if (products.length === 0) return;

    if (window.confirm("⚠️ ¿ESTÁS ABSOLUTAMENTE SEGURO? \n\nEsta acción eliminará TODOS los productos del inventario permanentemente. No se puede deshacer.")) {
      // Doble confirmación
      const confirmText = prompt("Para confirmar, escribe 'ELIMINAR' en mayúsculas:");
      if (confirmText === 'ELIMINAR') {
        try {
          await deleteAllProducts.mutateAsync();
          toast({
            title: "Inventario eliminado",
            description: "Todos los productos han sido eliminados correctamente.",
            variant: "destructive"
          });
        } catch (error: any) {
          console.error("Error deleting all:", error);

          // Mostrar mensaje amigable si es por Foreign Key
          let message = error.message || "No se pudieron eliminar los productos.";
          if (message.includes("foreign key") || message.includes("constraint")) {
            message = "No se pueden eliminar productos que tienen ventas, movimientos o pedidos asociados. Debes eliminar esos registros primero.";
          }

          toast({
            title: "Error al eliminar",
            description: message,
            variant: "destructive",
            duration: 5000,
          });
        }
      }
    }
  };

  // Función para importar CSV/Excel
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[worksheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        throw new Error("El archivo está vacío");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', user.id).maybeSingle();
      const storeId = profile?.store_id;

      // Crear mapa de categorías para búsqueda rápida
      const categoryMap = new Map<string, string>();
      categories.forEach(c => categoryMap.set(c.name.toLowerCase().trim(), c.id));

      // Conjuntos para detectar duplicados existentes en la BD
      const existingBarcodes = new Set(products.map(p => p.barcode).filter(Boolean));
      const existingNames = new Set(products.map(p => p.name.toLowerCase().trim()));

      const newProducts: any[] = [];
      const duplicates: string[] = [];
      const invalidRows: number[] = [];

      for (const [index, row] of (jsonData as any[]).entries()) {
        const rowNumber = index + 2; // +2 porque +1 index y +1 header

        // Mapeo flexible de nombres de columnas
        const name = row['Nombre'] || row['nombre'] || row['Name'] || row['name'];
        if (!name) {
          invalidRows.push(rowNumber);
          continue;
        }

        const nameLower = name.toString().toLowerCase().trim();
        const barcode = (row['Código de Barras'] || row['Codigo de Barras'] || row['barcode'] || row['Barcode'] || '').toString().trim();

        // Verificar duplicados
        let isDuplicate = false;
        if (existingNames.has(nameLower)) {
          duplicates.push(`${name} (Nombre duplicado)`);
          isDuplicate = true;
        } else if (barcode && existingBarcodes.has(barcode)) {
          duplicates.push(`${name} (Código de barras ${barcode} duplicado)`);
          isDuplicate = true;
        }

        if (isDuplicate) continue;

        const price = parseFloat(row['Precio'] || row['precio'] || row['Price'] || row['price'] || '0');
        const cost = parseFloat(row['Costo'] || row['costo'] || row['Cost'] || row['cost'] || '0');
        const stock = parseInt(row['Stock'] || row['stock'] || '0');
        const minStock = parseInt(row['Stock Mínimo'] || row['Stock Minimo'] || row['min_stock'] || '0');
        const categoryName = row['Categoría'] || row['Categoria'] || row['category'] || '';
        const status = (row['Estado'] || row['estado'] || 'active') === 'inactive' ? 'inactive' : 'active';

        let categoryId = null;
        if (categoryName) {
          const normalized = categoryName.toString().toLowerCase().trim();
          if (categoryMap.has(normalized)) {
            categoryId = categoryMap.get(normalized);
          }
        }

        newProducts.push({
          name,
          price,
          cost,
          stock,
          min_stock: minStock,
          barcode: barcode || null,
          category_id: categoryId,
          store_id: storeId,
          status
        });
      }

      // Si hay duplicados, advertir al usuario
      if (duplicates.length > 0) {
        toast({
          title: "Productos duplicados detectados",
          description: `Se omitieron ${duplicates.length} productos que ya existen en el inventario.`,
          variant: "destructive",
          duration: 5000,
        });
        // Si no hay productos nuevos (todos eran duplicados), podemos parar o seguir si hay otros
        if (newProducts.length === 0) {
          return;
        }
      }

      if (newProducts.length > 0) {
        const { error } = await supabase.from('products').insert(newProducts);
        if (error) throw error;

        toast({
          title: "Importación exitosa",
          description: `Se han importado ${newProducts.length} productos nuevos.${duplicates.length > 0 ? ` (${duplicates.length} omitidos por duplicidad)` : ''}`,
          className: "bg-green-50 text-green-900 border-green-200"
        });
        queryClient.invalidateQueries({ queryKey: ['products'] });
      } else if (duplicates.length === 0 && invalidRows.length === 0) {
        toast({
          title: "Advertencia",
          description: "No se encontraron productos válidos en el archivo.",
          variant: "destructive"
        });
      }

    } catch (error: any) {
      console.error('Error importing:', error);
      toast({
        title: "Error al importar",
        description: error.message || "Ocurrió un error al procesar el archivo.",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Función para imprimir lista de compras
  const handlePrintShoppingList = () => {
    const businessName = "MI NEGOCIO"; // Puedes cambiar esto
    const rnc = "000-00000-0";
    const phone = "(000) 000-0000";
    const date = new Date().toLocaleDateString('es-DO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lista de Compras - Stock Bajo</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
          .header h1 { font-size: 24px; margin-bottom: 5px; }
          .header p { font-size: 12px; color: #666; }
          .info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; }
          .title { background: #f0f0f0; padding: 10px; text-align: center; font-weight: bold; margin-bottom: 15px; font-size: 16px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #f0f0f0; font-weight: bold; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #666; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${businessName}</h1>
          <p>RNC: ${rnc} | Tel: ${phone}</p>
        </div>
        <div class="info">
          <div><strong>Fecha:</strong> ${date}</div>
          <div><strong>Total de productos:</strong> ${lowStockProducts.length}</div>
        </div>
        <div class="title">📋 LISTA DE COMPRAS - PRODUCTOS CON STOCK BAJO</div>
        <table>
          <thead>
            <tr>
              <th style="width: 5%">#</th>
              <th style="width: 40%">Producto</th>
              <th style="width: 20%">Categoría</th>
              <th class="text-center" style="width: 15%">Stock Actual</th>
              <th class="text-center" style="width: 10%">Mínimo</th>
              <th class="text-right" style="width: 10%">Costo Unit.</th>
            </tr>
          </thead>
          <tbody>
            ${lowStockProducts.map((product, index) => `
              <tr>
                <td class="text-center">${index + 1}</td>
                <td>${product.name}</td>
                <td>${product.category?.name || 'Sin categoría'}</td>
                <td class="text-center" style="color: red; font-weight: bold;">${product.stock}</td>
                <td class="text-center">${product.min_stock}</td>
                <td class="text-right">$${(product.cost || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">
          <p>Documento generado el ${new Date().toLocaleString('es-DO')}</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); }, 250);
    }
  };

  const filteredProducts = products.filter(product => {
    // Filtro por stock bajo
    if (showLowStockOnly && !((product.stock || 0) <= (product.min_stock || 0))) {
      return false;
    }

    // Filtro por categoría
    if (selectedCategory !== 'all' && product.category_id !== selectedCategory) {
      return false;
    }

    // Si no hay término de búsqueda, mostrar todos (con filtro de categoría aplicado)
    if (!searchTerm.trim()) {
      return true;
    }

    // Filtro según tipo de búsqueda
    const searchLower = searchTerm.toLowerCase().trim();

    switch (searchType) {
      case 'name':
        return product.name.toLowerCase().includes(searchLower);
      case 'id':
        return product.internal_code && product.internal_code.toLowerCase().includes(searchLower);
      case 'barcode':
        return product.barcode && product.barcode.toLowerCase().includes(searchLower);
      case 'category':
        return product.category?.name && product.category.name.toLowerCase().includes(searchLower);
      default:
        return true;
    }
  });

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleDelete = async (product: Product) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar "${product.name}"?`)) {
      try {
        await deleteProduct.mutateAsync(product.id);
        toast({
          title: "Producto eliminado",
          description: "El producto se ha eliminado correctamente.",
        });
      } catch (error) {
        console.error('Error al eliminar producto:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo eliminar el producto. Inténtalo de nuevo.",
        });
      }
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingProduct(null);
  };

  const handleFormSuccess = () => {
    // La query se invalidará automáticamente por el hook
  };

  const handleExportCSV = () => {
    if (products.length === 0) {
      toast({
        variant: "destructive",
        title: "No hay productos",
        description: "No hay productos para exportar.",
      });
      return;
    }

    // Crear headers del CSV
    const headers = [
      'Nombre',
      'Código de Barras',
      'Categoría',
      'Precio',
      'Costo',
      'Stock',
      'Stock Mínimo',
      'Estado'
    ];

    // Convertir productos a filas CSV
    const csvData = products.map(product => [
      product.name,
      product.barcode || '',
      product.category?.name || '',
      product.price.toString(),
      (product.cost || 0).toString(),
      product.stock.toString(),
      product.min_stock.toString(),
      product.status
    ]);

    // Combinar headers y datos
    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    // Crear y descargar archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `productos_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Productos exportados",
      description: `Se han exportado ${products.length} productos a CSV.`,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingLogo text="Cargando productos..." size="sm" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header con título y botones */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Productos</h1>
          <p className="text-muted-foreground">Administra tu inventario</p>
        </div>

        <div className="flex gap-2">
          {/* Menu de Importar/Exportar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Importar / Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleImportClick} disabled={isImporting}>
                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Importar CSV/Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Descargar Plantilla
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV}>
                <Download className="mr-2 h-4 w-4" />
                Exportar Productos
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
          />

          {products.length > 0 && (
            <Button
              variant="destructive"
              onClick={handleDeleteAll}
              disabled={deleteAllProducts.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar Todo
            </Button>
          )}

          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      {/* Estadísticas del inventario */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Valor del inventario */}
        <Card className="border-0 shadow-md bg-gradient-to-r from-accent/10 to-primary/10">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-accent/20">
              <DollarSign className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valor del Inventario</p>
              <p className="text-2xl font-bold text-accent">${inventoryValue.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </CardContent>
        </Card>

        {/* Total de productos */}
        <Card className="border-0 shadow-md bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-blue-500/20">
              <Package className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Productos</p>
              <p className="text-2xl font-bold text-blue-500">{products.length}</p>
            </div>
          </CardContent>
        </Card>

        {/* Productos con stock bajo */}
        <Card
          className={`border-0 shadow-md cursor-pointer transition-all ${showLowStockOnly
            ? 'ring-2 ring-destructive bg-destructive/20'
            : 'bg-gradient-to-r from-destructive/10 to-orange-500/10 hover:ring-2 hover:ring-destructive/50'
            }`}
          onClick={() => setShowLowStockOnly(!showLowStockOnly)}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-destructive/20">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Stock Bajo {showLowStockOnly && '(Filtrado)'}</p>
                <p className="text-2xl font-bold text-destructive">{lowStockCount}</p>
              </div>
            </div>
            {showLowStockOnly && lowStockCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrintShoppingList();
                }}
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                <Printer className="h-4 w-4 mr-2" />
                Imprimir Lista
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filtros y búsqueda */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Botones de tipo de búsqueda */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button
                variant={searchType === 'name' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchType('name')}
                className="flex items-center justify-center gap-2"
              >
                <Package className="h-4 w-4" />
                <span>Nombre</span>
              </Button>
              <Button
                variant={searchType === 'barcode' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchType('barcode')}
                className="flex items-center justify-center gap-2"
              >
                <Barcode className="h-4 w-4" />
                <span>Código de barras</span>
              </Button>
              <Button
                variant={searchType === 'id' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchType('id')}
                className="flex items-center justify-center gap-2"
              >
                <Hash className="h-4 w-4" />
                <span>Código interno</span>
              </Button>
              <Button
                variant={searchType === 'category' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchType('category')}
                className="flex items-center justify-center gap-2"
              >
                <Tag className="h-4 w-4" />
                <span>Categoría</span>
              </Button>
            </div>

            {/* Barra de búsqueda y filtro de categoría */}
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={
                    searchType === 'name' ? 'Buscar por nombre...' :
                      searchType === 'barcode' ? 'Buscar por código de barras...' :
                        searchType === 'id' ? 'Buscar por código interno...' :
                          'Buscar por categoría...'
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filtro de categoría */}
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de productos */}
      <div className="grid gap-4">
        {filteredProducts.map((product) => (
          <Card key={product.id}>
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-lg">{product.name}</h3>
                    <Badge variant="secondary">{product.category?.name || 'Sin categoría'}</Badge>
                    {((product.stock || 0) <= (product.min_stock || 0)) && (
                      <Badge variant="destructive">Stock Bajo</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Código: {product.barcode || 'N/A'}
                  </p>
                  <div className="flex gap-6 text-sm">
                    <span>Precio: <strong>${product.price.toFixed(2)}</strong></span>
                    <span>Costo: <strong>${(product.cost || 0).toFixed(2)}</strong></span>
                    <span>Stock: <strong>{product.stock} unidades</strong></span>
                    <span>Mín: <strong>{product.min_stock}</strong></span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(product)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(product)}
                    disabled={deleteProduct.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modal del formulario */}
      {showForm && (
        <ProductForm
          product={editingProduct}
          onClose={handleCloseForm}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
};

export default Products;
