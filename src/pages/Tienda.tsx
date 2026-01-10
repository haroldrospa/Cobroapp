import React, { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShoppingCart, Store, Plus, Minus, Trash2, ArrowLeft, Package,
  Search, Sparkles, Tag, Filter, X, ChevronRight, Star, Percent,
  SlidersHorizontal, DollarSign, MapPin, User
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useStoreBySlug } from '@/hooks/useStore';
import { useStoreProducts } from '@/hooks/useStoreProducts';
import { useCreateStoreOrder } from '@/hooks/useStoreOrders';
import { useStoreBanners } from '@/hooks/usePromotionalBanners';
import { useShopperProfile } from '@/hooks/useShopperProfile';
import { Product } from '@/hooks/useProducts';
import { useToast } from '@/hooks/use-toast';
import BannerCarousel from '@/components/store/BannerCarousel';
import { ShopperProfileDialog } from '@/components/store/ShopperProfileDialog';


interface CartItem {
  product: Product;
  quantity: number;
}

// Helper function to check if discount is active
const isDiscountActive = (product: Product): boolean => {
  const discount = product.discount_percentage || 0;
  if (discount <= 0) return false;

  const now = new Date();
  const startDate = product.discount_start_date ? new Date(product.discount_start_date) : null;
  const endDate = product.discount_end_date ? new Date(product.discount_end_date) : null;

  if (startDate && now < startDate) return false;
  if (endDate && now > endDate) return false;

  return true;
};

// Helper function to get discounted price
const getDiscountedPrice = (product: Product): number => {
  if (!isDiscountActive(product)) return product.price;
  return product.price * (1 - (product.discount_percentage || 0) / 100);
};

const Tienda: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: store, isLoading: storeLoading, error: storeError } = useStoreBySlug(slug);
  const { data: products = [], isLoading: productsLoading } = useStoreProducts(store?.id);
  const { data: banners = [] } = useStoreBanners(store?.id);
  const createOrder = useCreateStoreOrder();
  const { toast } = useToast();
  const { profile, saveProfile } = useShopperProfile();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);

  // Checkout Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [priceFilter, setPriceFilter] = useState<string>('all');
  const [showOnlyDiscounts, setShowOnlyDiscounts] = useState(false);

  // Auto-fill checkout form from profile
  useEffect(() => {
    if (profile) {
      setCustomerName(profile.name || '');
      setCustomerPhone(profile.phone || '');
      setCustomerEmail(profile.email || '');

      // Combine address and GPS if available
      let fullAddress = profile.address || '';
      if (profile.locationUrl) {
        fullAddress += `\n[GPS: ${profile.locationUrl}]`;
      }
      setCustomerAddress(fullAddress);
      setCustomerNotes(profile.notes || '');
    }
  }, [profile, showCheckout]);

  /* -----------------------------------------------------------------------------------------------
   * THEME ENGINE
   * ----------------------------------------------------------------------------------------------- */
  const storeSettings = Array.isArray(store?.store_settings)
    ? store?.store_settings?.[0]
    : store?.store_settings;
  const shopType = (storeSettings as any)?.shop_type || 'default';

  const themeStyles = useMemo(() => {
    // Default theme uses existing CSS variables
    if (!shopType || shopType === 'default') return {};

    const themes: Record<string, React.CSSProperties> = {
      restaurant: {
        '--primary': '25 95% 53%', // Vibrant Orange
        '--primary-foreground': '0 0% 100%',
        '--secondary': '20 14% 4%',
        '--secondary-foreground': '60 9.1% 97.8%',
        '--accent': '12 6.5% 15.1%',
        '--accent-foreground': '60 9.1% 97.8%',
        '--radius': '1rem', // Rounder corners for friendly food vibe
      } as React.CSSProperties,
      fashion: {
        '--primary': '0 0% 9%', // Elegant Black/Zinc
        '--primary-foreground': '0 0% 98%',
        '--secondary': '0 0% 96.1%',
        '--secondary-foreground': '0 0% 9%',
        '--muted': '0 0% 96.1%',
        '--muted-foreground': '0 0% 45.1%',
        '--radius': '0px', // Sharp corners for high fashion
      } as React.CSSProperties,
      supermarket: {
        '--primary': '142 76% 36%', // Fresh Green
        '--primary-foreground': '355.7 100% 97.3%',
        '--radius': '0.5rem',
      } as React.CSSProperties,
      technology: {
        '--primary': '221.2 83.2% 53.3%', // Tech Blue
        '--primary-foreground': '210 40% 98%',
        '--radius': '0.3rem',
      } as React.CSSProperties
    };

    return themes[shopType] || {};
  }, [shopType]);

  const activeProducts = products.filter(p => (p.stock ?? 0) > 0);
  const settingsData = store?.company_settings;
  const companySettings = Array.isArray(settingsData) ? settingsData[0] : settingsData as any; // Cast as any just to be safe with TS if types are loose
  const storeName = companySettings?.company_name || store?.store_name || 'Tienda';

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Map<string, string>();
    activeProducts.forEach(p => {
      if (p.category?.name && p.category_id) {
        cats.set(p.category_id, p.category.name);
      }
    });
    return Array.from(cats, ([id, name]) => ({ id, name }));
  }, [activeProducts]);

  // Featured products - prioritize products with active discounts or marked as featured
  const featuredProducts = useMemo(() => {
    return activeProducts
      .filter(p => p.is_featured || isDiscountActive(p))
      .slice(0, 6);
  }, [activeProducts]);

  // Filter products
  const filteredProducts = useMemo(() => {
    let filtered = activeProducts;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.category?.name?.toLowerCase().includes(term) ||
        p.barcode?.toLowerCase().includes(term)
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(p => p.category_id === selectedCategory);
    }

    // Price filter
    if (priceFilter !== 'all') {
      filtered = filtered.filter(p => {
        const price = getDiscountedPrice(p);
        switch (priceFilter) {
          case 'under50': return price < 50;
          case '50to100': return price >= 50 && price <= 100;
          case '100to500': return price > 100 && price <= 500;
          case 'over500': return price > 500;
          default: return true;
        }
      });
    }

    // Discounts only filter
    if (showOnlyDiscounts) {
      filtered = filtered.filter(p => isDiscountActive(p));
    }

    return filtered;
  }, [activeProducts, searchTerm, selectedCategory, priceFilter, showOnlyDiscounts]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + 1, product.stock ?? 0) }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    toast({ title: '¡Agregado!', description: product.name });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return item;
        if (newQty > (item.product.stock ?? 0)) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const { cartTotal, cartSubtotal, cartTax } = cart.reduce((acc, item) => {
    const price = getDiscountedPrice(item.product);
    const taxRate = (item.product.tax_percentage ?? 18) / 100;
    const quantity = item.quantity;

    let itemTotal, itemTax, itemSubtotal;

    if (item.product.cost_includes_tax) {
      itemTotal = price * quantity;
      itemSubtotal = itemTotal / (1 + taxRate);
      itemTax = itemTotal - itemSubtotal;
    } else {
      itemSubtotal = price * quantity;
      itemTax = itemSubtotal * taxRate;
      itemTotal = itemSubtotal + itemTax;
    }

    return {
      cartTotal: acc.cartTotal + itemTotal,
      cartSubtotal: acc.cartSubtotal + itemSubtotal,
      cartTax: acc.cartTax + itemTax
    };
  }, { cartTotal: 0, cartSubtotal: 0, cartTax: 0 });
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0 || !store) return;

    try {
      const items = cart.map(item => {
        const taxPercentage = item.product.tax_percentage ?? 18;
        const discountPrice = getDiscountedPrice(item.product);
        const quantity = item.quantity;

        let subtotal, taxAmount, total;

        if (item.product.cost_includes_tax) {
          total = discountPrice * quantity;
          subtotal = total / (1 + taxPercentage / 100);
          taxAmount = total - subtotal;
        } else {
          subtotal = discountPrice * quantity;
          taxAmount = subtotal * (taxPercentage / 100);
          total = subtotal + taxAmount;
        }

        return {
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: quantity,
          unit_price: discountPrice,
          tax_percentage: taxPercentage,
          tax_amount: taxAmount,
          subtotal: subtotal,
          total: total
        };
      });

      await createOrder.mutateAsync({
        store_id: store.id,
        customer_name: customerName || 'Cliente Web',
        customer_phone: customerPhone || undefined,
        customer_email: customerEmail || undefined,
        customer_address: customerAddress || undefined,
        notes: customerNotes || undefined,
        payment_method: 'pending',
        subtotal: cartSubtotal,
        discount_total: 0,
        tax_total: cartTax,
        total: cartTotal,
        items,
      });

      toast({
        title: '¡Pedido recibido!',
        description: 'Tu pedido será procesado pronto.'
      });

      setCart([]);
      setShowCheckout(false);
      setShowCart(false);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo procesar el pedido.',
        variant: 'destructive'
      });
    }
  };

  if (storeLoading || productsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Cargando tienda...</p>
        </div>
      </div>
    );
  }

  if (storeError || !store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Store className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Tienda no encontrada</h1>
        <p className="text-muted-foreground mb-6">La tienda que buscas no existe o no está disponible.</p>
        <Link to="/buscar-tienda">
          <Button>Buscar otra tienda</Button>
        </Link>
      </div>
    );
  }



  return (
    <div
      className="min-h-screen bg-gradient-to-b from-background to-muted/20 transition-colors duration-500"
      style={themeStyles}
      data-theme={shopType}
    >
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col md:flex-row items-center gap-4 w-full py-1">
            {/* Logo and Name */}
            <div className="flex items-center gap-3 self-start md:self-center shrink-0 mr-2">
              {companySettings?.logo_url ? (
                <img
                  src={companySettings.logo_url}
                  alt="Logo"
                  className="h-14 w-14 md:h-16 md:w-16 object-contain shrink-0"
                />
              ) : (
                <Store className="h-10 w-10 text-primary" />
              )}
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">{storeName}</h1>
            </div>

            {/* Search and Cart Row */}
            <div className="flex items-center gap-3 flex-1 w-full justify-end">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar productos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-10 bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary h-12 text-lg w-full"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setSearchTerm('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <Button
                variant="outline"
                onClick={() => setShowProfileDialog(true)}
                className="h-12 px-3 sm:px-4 rounded-lg border-2 border-primary/20 hover:bg-primary/10 shrink-0 flex items-center gap-2 mr-2"
                title={profile?.name ? `Hola, ${profile.name}` : "Ingresar mis datos"}
              >
                <div className="relative">
                  <User className="h-5 w-5 text-primary" />
                  {profile && <div className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-green-500 rounded-full border-2 border-background animate-pulse" />}
                </div>
                <span className="hidden sm:inline font-medium text-sm">
                  {profile?.name ? profile.name.split(' ')[0] : 'Ingresar'}
                </span>
              </Button>

              <Button
                onClick={() => setShowCart(true)}
                className="relative bg-primary hover:bg-primary/90 shadow-md h-12 px-4 sm:px-6 shrink-0"
              >
                <ShoppingCart className="h-5 w-5" />
                <span className="hidden lg:inline ml-2 font-medium">Carrito</span>
                {cartItemCount > 0 && (
                  <span className="absolute -top-2 -right-2 h-6 w-6 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center animate-scale-in border-2 border-background">
                    {cartItemCount}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">

        {/* Sticky Filters & Categories Toolbar */}
        <section className="sticky top-[72px] z-40 bg-background/80 backdrop-blur-md border-b border-border/50 py-3 -mx-4 px-4 shadow-sm transition-all duration-300">
          <div className="container mx-auto space-y-3">

            {/* Top Row: Categories & Main Actions */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">

              {/* Categories Scroll Area */}
              {categories.length > 0 && (
                <div className="w-full md:w-auto overflow-hidden relative group flex-1 min-w-0">
                  <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none md:hidden" />
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none md:hidden" />

                  <ScrollArea className="w-full whitespace-nowrap pb-1">
                    <div className="flex gap-2 px-1">
                      <Button
                        variant={selectedCategory === null ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedCategory(null)}
                        className={`rounded-full transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm ${selectedCategory === null ? 'bg-primary text-primary-foreground shadow-primary/25' : 'hover:bg-accent hover:text-accent-foreground'}`}
                      >
                        Todos
                      </Button>
                      {categories.map(cat => (
                        <Button
                          key={cat.id}
                          variant={selectedCategory === cat.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`rounded-full transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm ${selectedCategory === cat.id ? 'bg-primary text-primary-foreground shadow-primary/25 ring-2 ring-primary/20' : 'hover:bg-accent'}`}
                        >
                          {cat.name}
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Filters Group */}
              <div className="flex items-center gap-2 shrink-0 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 px-1">
                {/* Price Filter */}
                <Select value={priceFilter} onValueChange={setPriceFilter}>
                  <SelectTrigger className={`w-[130px] h-8 rounded-full border-dashed transition-all hover:bg-accent ${priceFilter !== 'all' ? 'border-primary text-primary border-solid bg-primary/5' : ''}`}>
                    <div className="flex items-center gap-2 truncate">
                      <DollarSign className="h-3.5 w-3.5" />
                      <SelectValue placeholder="Precio" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Cualquier precio</SelectItem>
                    <SelectItem value="under50">Menos de $50</SelectItem>
                    <SelectItem value="50to100">$50 - $100</SelectItem>
                    <SelectItem value="100to500">$100 - $500</SelectItem>
                    <SelectItem value="over500">Más de $500</SelectItem>
                  </SelectContent>
                </Select>

                {/* Offers Toggle */}
                <Button
                  variant={showOnlyDiscounts ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowOnlyDiscounts(!showOnlyDiscounts)}
                  className={`h-8 rounded-full border-dashed transition-all duration-300 hover:scale-105 ${showOnlyDiscounts
                    ? 'bg-destructive text-destructive-foreground border-solid shadow-destructive/25 shadow-md'
                    : 'hover:border-destructive hover:text-destructive'
                    }`}
                >
                  <Percent className={`h-3.5 w-3.5 mr-1.5 ${showOnlyDiscounts ? 'animate-pulse' : ''}`} />
                  Ofertas
                </Button>

                {/* Clear All Button (Only shows when filters active) */}
                {(selectedCategory || priceFilter !== 'all' || showOnlyDiscounts || searchTerm) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedCategory(null);
                      setPriceFilter('all');
                      setShowOnlyDiscounts(false);
                      setSearchTerm('');
                    }}
                    className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all animate-in fade-in zoom-in duration-200"
                    title="Limpiar filtros"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Active Filters Badges (Dynamic Height) */}
            {(selectedCategory || priceFilter !== 'all' || showOnlyDiscounts) && (
              <div className="flex flex-wrap gap-2 animate-in slide-in-from-top-1 duration-200">
                {selectedCategory && (
                  <Badge variant="secondary" className="rounded-md px-2 py-1 gap-1.5 bg-primary/10 text-primary border-0 hover:bg-primary/20 transition-colors cursor-pointer" onClick={() => setSelectedCategory(null)}>
                    {categories.find(c => c.id === selectedCategory)?.name}
                    <X className="h-3 w-3" />
                  </Badge>
                )}
                {priceFilter !== 'all' && (
                  <Badge variant="secondary" className="rounded-md px-2 py-1 gap-1.5 border-dashed border-primary/30 cursor-pointer hover:bg-accent" onClick={() => setPriceFilter('all')}>
                    <DollarSign className="h-3 w-3" />
                    {priceFilter === 'under50' && '< $50'}
                    {priceFilter === '50to100' && '$50 - $100'}
                    {priceFilter === '100to500' && '$100 - $500'}
                    {priceFilter === 'over500' && '> $500'}
                    <X className="h-3 w-3" />
                  </Badge>
                )}
                {showOnlyDiscounts && (
                  <span className="text-xs font-medium text-destructive flex items-center animate-pulse">
                    <Sparkles className="h-3 w-3 mr-1" /> Mostrando solo ofertas
                  </span>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Banner Carousel */}
        {banners.length > 0 && !searchTerm && (
          <section className="animate-fade-in">
            <BannerCarousel banners={banners} />
          </section>
        )}
        {/* Featured Section */}
        {featuredProducts.length > 0 && !searchTerm && !selectedCategory && (
          <section className="animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-gradient-to-br from-destructive to-orange-500 rounded-lg">
                <Percent className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">¡Ofertas y Destacados!</h2>
                <p className="text-sm text-muted-foreground">Productos en promoción</p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {featuredProducts.map(product => {
                const hasDiscount = isDiscountActive(product);
                const discountedPrice = getDiscountedPrice(product);

                return (
                  <Card
                    key={product.id}
                    className="group overflow-hidden border-2 border-destructive/30 bg-gradient-to-br from-destructive/5 to-orange-500/5 hover:border-destructive/50 transition-all hover:shadow-xl hover:-translate-y-1"
                  >
                    <div className="relative">
                      {product.image_url ? (
                        <div className="aspect-square overflow-hidden">
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                        </div>
                      ) : (
                        <div className="aspect-square bg-muted flex items-center justify-center">
                          <Package className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}

                      {/* Discount badge */}
                      {hasDiscount && (
                        <Badge className="absolute top-2 left-2 bg-destructive border-0 text-sm font-bold">
                          -{product.discount_percentage}%
                        </Badge>
                      )}

                      {/* Featured badge */}
                      {product.is_featured && !hasDiscount && (
                        <Badge className="absolute top-2 left-2 bg-gradient-to-r from-amber-500 to-orange-500 border-0">
                          <Star className="h-3 w-3 mr-1" />
                          Destacado
                        </Badge>
                      )}
                    </div>

                    <CardContent className="p-3">
                      <h3 className="font-semibold line-clamp-1 text-sm">{product.name}</h3>
                      <div className="mt-1">
                        {hasDiscount ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm line-through text-muted-foreground">${product.price.toFixed(2)}</span>
                            <span className="text-xl font-bold text-destructive">${discountedPrice.toFixed(2)}</span>
                          </div>
                        ) : (
                          <p className="text-xl font-bold text-primary">${product.price.toFixed(2)}</p>
                        )}
                      </div>
                    </CardContent>

                    <CardFooter className="p-3 pt-0">
                      <Button
                        size="sm"
                        className="w-full bg-gradient-to-r from-destructive to-orange-500 hover:from-destructive/90 hover:to-orange-600 text-white border-0"
                        onClick={() => addToCart(product)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Agregar
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </section>
        )}


        {/* Products Grid */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">
              {selectedCategory
                ? categories.find(c => c.id === selectedCategory)?.name
                : searchTerm
                  ? `Resultados para "${searchTerm}"`
                  : 'Todos los Productos'}
            </h2>
            <Badge variant="secondary">{filteredProducts.length} productos</Badge>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-16 bg-muted/30 rounded-2xl">
              <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No se encontraron productos</p>
              <p className="text-muted-foreground mb-4">Intenta con otra búsqueda o categoría</p>
              <Button variant="outline" onClick={() => { setSearchTerm(''); setSelectedCategory(null); }}>
                Ver todos los productos
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredProducts.map(product => {
                const hasDiscount = isDiscountActive(product);
                const discountedPrice = getDiscountedPrice(product);

                return (
                  <Card
                    key={product.id}
                    className={`group overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 ${hasDiscount ? 'border-destructive/30' : ''}`}
                  >
                    <div className="relative">
                      {product.image_url ? (
                        <div className="aspect-square overflow-hidden bg-muted">
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      ) : (
                        <div className="aspect-square bg-muted flex items-center justify-center">
                          <Package className="h-10 w-10 text-muted-foreground" />
                        </div>
                      )}

                      {/* Discount badge */}
                      {hasDiscount && (
                        <Badge className="absolute top-2 left-2 bg-destructive border-0 text-xs font-bold">
                          -{product.discount_percentage}%
                        </Badge>
                      )}

                      {(product.stock ?? 0) <= (product.min_stock ?? 0) && (
                        <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
                          ¡Últimos!
                        </Badge>
                      )}
                    </div>

                    <CardContent className="p-3">
                      <div className="space-y-1">
                        <h3 className="font-semibold line-clamp-2 text-sm leading-tight min-h-[2.5rem]">{product.name}</h3>
                        {product.category && (
                          <p className="text-xs text-muted-foreground">{product.category.name}</p>
                        )}
                      </div>
                      <div className="mt-2">
                        {hasDiscount ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm line-through text-muted-foreground">${product.price.toFixed(2)}</span>
                            <span className="text-lg font-bold text-destructive">${discountedPrice.toFixed(2)}</span>
                          </div>
                        ) : (
                          <p className="text-lg font-bold text-primary">${product.price.toFixed(2)}</p>
                        )}
                      </div>
                    </CardContent>

                    <CardFooter className="p-3 pt-0">
                      <Button
                        size="sm"
                        className={`w-full ${hasDiscount ? 'bg-destructive hover:bg-destructive/90' : ''}`}
                        onClick={() => addToCart(product)}
                        disabled={(product.stock ?? 0) <= 0}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Agregar
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Floating Cart Button (Mobile) */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 sm:hidden animate-fade-in">
          <Button
            size="lg"
            className="w-full h-14 text-base shadow-2xl bg-primary"
            onClick={() => setShowCart(true)}
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            Ver Carrito ({cartItemCount})
            <ChevronRight className="h-5 w-5 ml-auto" />
            <span className="ml-2 font-bold">${cartTotal.toFixed(2)}</span>
          </Button>
        </div>
      )}

      {/* Cart Dialog */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Tu Carrito
              {cartItemCount > 0 && (
                <Badge variant="secondary">{cartItemCount} items</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {cart.length === 0 ? (
            <div className="py-12 text-center">
              <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Tu carrito está vacío</p>
              <p className="text-muted-foreground">¡Agrega productos para comenzar!</p>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 max-h-[40vh] pr-4">
                <div className="space-y-3">
                  {cart.map(item => (
                    <div key={item.product.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        {item.product.image_url ? (
                          <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.product.name}</p>
                        <p className="text-sm text-muted-foreground">${item.product.price.toFixed(2)}</p>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive ml-1" onClick={() => removeFromCart(item.product.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <Separator />

              <div className="space-y-2 py-2">
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-primary">${cartTotal.toFixed(2)}</span>
                </div>
              </div>

              <DialogFooter>
                <Button size="lg" className="w-full" onClick={() => { setShowCart(false); setShowCheckout(true); }}>
                  Proceder al Pago
                  <ChevronRight className="h-5 w-5 ml-2" />
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar Pedido</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nombre *</label>
              <Input
                placeholder="Tu nombre"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Teléfono</label>
              <Input
                placeholder="Tu teléfono"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="Tu email"
                value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Dirección</label>
              <Textarea
                placeholder="Dirección de entrega"
                value={customerAddress}
                onChange={e => setCustomerAddress(e.target.value)}
                className="min-h-[60px]"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Nota (Opcional)</label>
              <Input
                placeholder="Notas para el pedido"
                value={customerNotes}
                onChange={e => setCustomerNotes(e.target.value)}
              />
            </div>

            <Separator />

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total a Pagar</span>
                <span className="text-primary">${cartTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setShowCheckout(false)} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleCheckout}
              disabled={createOrder.isPending || !customerName.trim()}
              className="flex-1"
            >
              {createOrder.isPending ? 'Procesando...' : 'Confirmar Pedido'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ShopperProfileDialog
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
        currentProfile={profile}
        onSave={saveProfile}
      />
    </div>
  );
};

export default Tienda;
