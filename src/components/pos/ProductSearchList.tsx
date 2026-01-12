import React, { useState, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Hash, Barcode, Tag, Package, Asterisk, Search } from 'lucide-react';
import { Product } from '@/hooks/useProducts';
import { useIsMobile } from '@/hooks/use-mobile';
interface ProductSearchListProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  menuButton?: React.ReactNode;
  actionButton?: React.ReactNode;
}
type SearchType = 'all' | 'name' | 'barcode' | 'id' | 'category';
const ProductSearchList: React.FC<ProductSearchListProps> = ({
  products,
  onAddToCart,
  searchTerm,
  onSearchChange,
  menuButton,
  actionButton
}) => {
  const [searchType, setSearchType] = useState<SearchType>('all');
  const [isFocused, setIsFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isExpanded = isFocused || searchTerm.trim().length > 0;
  const isMobile = useIsMobile();

  // Focus input on component mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const searchTypes = [{
    type: 'all' as const,
    label: 'Todo',
    icon: Asterisk,
    placeholder: 'Buscar por cualquier campo...'
  }, {
    type: 'name' as const,
    label: 'Nombre',
    icon: Package,
    placeholder: 'Buscar por nombre...'
  }, {
    type: 'barcode' as const,
    label: 'Código de barras',
    icon: Barcode,
    placeholder: 'Buscar por código de barras...'
  }, {
    type: 'id' as const,
    label: 'Código interno',
    icon: Hash,
    placeholder: 'Buscar por código interno...'
  }, {
    type: 'category' as const,
    label: 'Categoría',
    icon: Tag,
    placeholder: 'Buscar por categoría...'
  }];
  const getFilteredProducts = () => {
    if (!searchTerm.trim()) return [];
    const searchLower = searchTerm.toLowerCase().trim();
    return products.filter(product => {
      switch (searchType) {
        case 'all':
          // Buscar en todos los campos
          return product.name.toLowerCase().includes(searchLower) || product.barcode && product.barcode.toLowerCase().includes(searchLower) || product.internal_code && product.internal_code.toLowerCase().includes(searchLower) || product.category?.name && product.category.name.toLowerCase().includes(searchLower);
        case 'name':
          return product.name.toLowerCase().includes(searchLower);
        case 'barcode':
          return product.barcode && product.barcode.toLowerCase().includes(searchLower);
        case 'id':
          return product.internal_code && product.internal_code.toLowerCase().includes(searchLower);
        case 'category':
          return product.category?.name && product.category.name.toLowerCase().includes(searchLower);
        default:
          return false;
      }
    }).sort((a, b) => {
      // Ordenar por relevancia según el tipo de búsqueda
      let aValue = '';
      let bValue = '';
      switch (searchType) {
        case 'all':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'barcode':
          aValue = a.barcode?.toLowerCase() || '';
          bValue = b.barcode?.toLowerCase() || '';
          break;
        case 'id':
          aValue = a.internal_code?.toLowerCase() || '';
          bValue = b.internal_code?.toLowerCase() || '';
          break;
        case 'category':
          aValue = a.category?.name?.toLowerCase() || '';
          bValue = b.category?.name?.toLowerCase() || '';
          break;
      }

      // Primero los que coinciden exactamente
      const aExact = aValue === searchLower;
      const bExact = bValue === searchLower;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // Luego los que empiezan con el término
      const aStarts = aValue.startsWith(searchLower);
      const bStarts = bValue.startsWith(searchLower);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // Finalmente orden alfabético por nombre
      return a.name.localeCompare(b.name);
    });
  };
  const filteredProducts = getFilteredProducts();
  const currentSearchType = searchTypes.find(st => st.type === searchType);
  const handleSearchTypeChange = (newType: SearchType) => {
    setSearchType(newType);
    onSearchChange(''); // Limpiar búsqueda al cambiar tipo
    searchInputRef.current?.focus(); // Volver foco al input
  };

  const handleProductSelect = (product: Product) => {
    onAddToCart(product);
    onSearchChange('');
    // Re-focus input after adding to cart for continuous scanning/adding
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  // Manejar Enter para agregar producto automáticamente (útil para escáners de código de barras)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      // Buscar coincidencia exacta de código de barras primero
      const exactBarcodeMatch = products.find(
        p => p.barcode && p.barcode.toLowerCase() === searchTerm.toLowerCase().trim()
      );

      if (exactBarcodeMatch) {
        handleProductSelect(exactBarcodeMatch);
        return;
      }

      // Si no hay coincidencia exacta de código de barras, agregar el primer resultado filtrado
      if (filteredProducts.length > 0) {
        handleProductSelect(filteredProducts[0]);
      }
    }
  };
  return <div className="space-y-3">
    {/* Campo de búsqueda con iconos a la izquierda */}
    <div className="flex items-stretch gap-2">
      {/* Botón de menú */}
      {menuButton && <div className="shrink-0">{menuButton}</div>}

      {/* Botones de tipo de búsqueda - Desktop: iconos, Mobile: dropdown */}
      {isMobile ? <Select value={searchType} onValueChange={value => handleSearchTypeChange(value as SearchType)}>
        <SelectTrigger className="w-[110px] h-12 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {searchTypes.map(({
            type,
            label,
            icon: Icon
          }) => <SelectItem key={type} value={type}>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </div>
            </SelectItem>)}
        </SelectContent>
      </Select> : <div className="flex gap-1 items-center shrink-0">
        {searchTypes.map(({
          type,
          label,
          icon: Icon
        }) => <Button key={type} variant="ghost" size="sm" onClick={() => handleSearchTypeChange(type)} className={`h-10 w-10 p-0 transition-all hover:scale-110 ${searchType === type ? 'bg-accent text-accent-foreground' : ''}`} title={label}>
            <Icon className="h-4 w-4" />
          </Button>)}
      </div>}

      <div className="flex-1 relative min-w-0">
        <div className="relative border-2 rounded-xl shadow-sm bg-background">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={searchInputRef}
            placeholder={currentSearchType?.placeholder || 'Buscar productos...'}
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            className="h-12 pl-10 pr-3 text-sm md:text-base border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        {/* Dropdown de resultados */}
        {searchTerm.trim() && <div className="absolute top-full left-0 mt-1 z-50 border-2 rounded-xl shadow-lg bg-background max-h-[300px] overflow-y-auto w-full md:w-[600px]">
          {filteredProducts.length === 0 ? <div className="p-4 text-center text-sm text-muted-foreground">
            No se encontraron productos por {currentSearchType?.label.toLowerCase()}.
          </div> : <div className="p-1">
            {filteredProducts.map(product => {
              return <div key={product.id} onClick={() => handleProductSelect(product)} className="flex justify-between items-center cursor-pointer hover:bg-accent rounded-md p-2 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{product.name}</div>
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <span>{product.category?.name || 'Sin categoría'}</span>
                    <span>•</span>
                    <span>Stock: {product.stock}</span>
                    {product.barcode && <>
                      <span>•</span>
                      <span>CB: {product.barcode}</span>
                    </>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">${product.price.toFixed(2)}</div>
                  {product.status === 'low_stock' && <div className="text-xs text-red-500">Stock Bajo</div>}
                </div>
              </div>;
            })}
          </div>}
        </div>}
      </div>

      {/* Action button (Ver Ventas) */}
      {/* Action button (Ver Ventas) */}
      {/* Action button (Ver Ventas) */}
      {(!isMobile || !isExpanded) && actionButton && <div className="shrink-0">{actionButton}</div>}
    </div>
  </div>;
};
export default ProductSearchList;