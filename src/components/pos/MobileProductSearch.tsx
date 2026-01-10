import React, { useState } from 'react';
import { Search, Package, Barcode, Hash, Tag, Asterisk, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Product } from '@/hooks/useProducts';
import { cn } from '@/lib/utils';

interface MobileProductSearchProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  menuButton?: React.ReactNode;
  actionButton?: React.ReactNode;
  gridCols?: number;
}

type SearchType = 'all' | 'name' | 'barcode' | 'id' | 'category';

const MobileProductSearch: React.FC<MobileProductSearchProps> = ({
  products,
  onAddToCart,
  searchTerm,
  onSearchChange,
  menuButton,
  actionButton,
  gridCols = 2,
}) => {
  const [searchType, setSearchType] = useState<SearchType>('all');

  const gridColsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6'
  }[gridCols] || 'grid-cols-2';

  const searchTypes = [
    { type: 'all' as const, label: 'Todo', icon: Asterisk },
    { type: 'name' as const, label: 'Nombre', icon: Package },
    { type: 'barcode' as const, label: 'Código', icon: Barcode },
    { type: 'id' as const, label: 'ID', icon: Hash },
    { type: 'category' as const, label: 'Cat.', icon: Tag },
  ];

  const getFilteredProducts = () => {
    if (!searchTerm.trim()) return products.slice(0, 20); // Show first 20 products by default

    const searchLower = searchTerm.toLowerCase().trim();
    return products.filter(product => {
      switch (searchType) {
        case 'all':
          return (
            product.name.toLowerCase().includes(searchLower) ||
            (product.barcode && product.barcode.toLowerCase().includes(searchLower)) ||
            (product.internal_code && product.internal_code.toLowerCase().includes(searchLower)) ||
            (product.category?.name && product.category.name.toLowerCase().includes(searchLower))
          );
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
    });
  };

  const filteredProducts = getFilteredProducts();
  const currentSearchType = searchTypes.find(st => st.type === searchType);

  const handleProductSelect = (product: Product) => {
    onAddToCart(product);
    // Clear search after adding
    onSearchChange('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredProducts.length === 1) {
      handleProductSelect(filteredProducts[0]);
    }
  };

  return (
    <div className="h-full flex flex-col p-3 gap-3">
      {/* Header with menu and actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {menuButton}
        <Select value={searchType} onValueChange={(v) => setSearchType(v as SearchType)}>
          <SelectTrigger className="w-auto gap-1 h-10">
            {currentSearchType && <currentSearchType.icon className="h-4 w-4" />}
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {searchTypes.map((st) => (
              <SelectItem key={st.type} value={st.type}>
                <div className="flex items-center gap-2">
                  <st.icon className="h-4 w-4" />
                  <span>{st.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {actionButton}
      </div>

      {/* Search Input */}
      <div className="relative flex-shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder={`Buscar ${currentSearchType?.label.toLowerCase() || 'productos'}...`}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-10 h-12 text-base"
        />
      </div>

      {/* Products Grid */}
      <ScrollArea className="flex-1 min-h-0">
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <Package className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No se encontraron productos</p>
            {searchTerm && (
              <p className="text-sm text-muted-foreground mt-1">
                Intenta con otro término de búsqueda
              </p>
            )}
          </div>
        ) : (
          <div className={`grid ${gridColsClass} gap-2 pb-4`}>
            {filteredProducts.map((product) => (
              <Card
                key={product.id}
                className={cn(
                  "cursor-pointer transition-all active:scale-95",
                  product.stock <= 0 && "opacity-50"
                )}
                onClick={() => product.stock > 0 && handleProductSelect(product)}
              >
                <CardContent className="p-3">
                  <div className="flex flex-col gap-2">
                    {/* Product image or placeholder */}
                    <div className="aspect-square bg-muted rounded-md flex items-center justify-center overflow-hidden">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="h-8 w-8 text-muted-foreground/50" />
                      )}
                    </div>

                    {/* Product info */}
                    <div className="space-y-1">
                      <h4 className="font-medium text-sm line-clamp-2 leading-tight">
                        {product.name}
                      </h4>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-base">
                          ${product.price.toFixed(2)}
                        </span>
                        <Badge
                          variant={product.stock > 0 ? "secondary" : "destructive"}
                          className="text-xs"
                        >
                          {product.stock}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default MobileProductSearch;
