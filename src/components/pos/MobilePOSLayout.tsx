import React, { useState, useRef, useEffect } from 'react';
import { Package, ShoppingCart, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CartItem } from '@/types/pos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type MobileTab = 'products' | 'cart' | 'payment';

interface MobilePOSLayoutProps {
  // Products tab
  productSearchComponent: React.ReactNode;
  // Cart tab
  cart: CartItem[];
  cartComponent: React.ReactNode;
  // Payment tab
  paymentComponent: React.ReactNode;
  // Cart total for quick view
  cartTotal: string;
  onCheckout: () => void;
}

const MobilePOSLayout: React.FC<MobilePOSLayoutProps> = ({
  productSearchComponent,
  cart,
  cartComponent,
  paymentComponent,
  cartTotal,
  onCheckout,
}) => {
  const [activeTab, setActiveTab] = useState<MobileTab>('products');
  const [previousTab, setPreviousTab] = useState<MobileTab>('products');
  const [isAnimating, setIsAnimating] = useState(false);

  // Swipe gesture handling
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const tabs = [
    { id: 'products' as const, label: 'Productos', icon: Package },
    { id: 'cart' as const, label: 'Carrito', icon: ShoppingCart, badge: cart.length },
    { id: 'payment' as const, label: 'Pagar', icon: CreditCard },
  ];

  const tabOrder: MobileTab[] = ['products', 'cart', 'payment'];
  const tabIndex = { products: 0, cart: 1, payment: 2 };

  const handleTabChange = (newTab: MobileTab) => {
    if (newTab === activeTab || isAnimating) return;
    setPreviousTab(activeTab);
    setIsAnimating(true);
    setActiveTab(newTab);
    setTimeout(() => setIsAnimating(false), 300);
  };

  // Swipe handlers
  // Swipe handlers disabled as per user request
  /*
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const swipeDistance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50; // Minimum distance for a valid swipe

    if (Math.abs(swipeDistance) < minSwipeDistance) return;

    const currentIndex = tabIndex[activeTab];
    
    if (swipeDistance > 0 && currentIndex < tabOrder.length - 1) {
      // Swipe left - go to next tab
      handleTabChange(tabOrder[currentIndex + 1]);
    } else if (swipeDistance < 0 && currentIndex > 0) {
      // Swipe right - go to previous tab
      handleTabChange(tabOrder[currentIndex - 1]);
    }
  };
  */

  const getSlideDirection = (tab: MobileTab) => {
    if (!isAnimating) return '';
    const currentIndex = tabIndex[activeTab];
    const tabIndexValue = tabIndex[tab];

    if (tab === activeTab) {
      // Entering tab
      return currentIndex > tabIndex[previousTab] ? 'animate-slide-in-right' : 'animate-slide-in-left';
    }
    return '';
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Main Content Area with swipe detection */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-hidden relative"
      >
        {/* Products Tab */}
        <div className={cn(
          "absolute inset-0 h-full w-full transition-all duration-300 ease-out",
          activeTab === 'products'
            ? 'opacity-100 translate-x-0 pointer-events-auto'
            : activeTab === 'cart' || activeTab === 'payment'
              ? 'opacity-0 -translate-x-full pointer-events-none'
              : 'opacity-0 translate-x-full pointer-events-none'
        )}>
          {productSearchComponent}
        </div>

        {/* Cart Tab */}
        <div className={cn(
          "absolute inset-0 h-full w-full transition-all duration-300 ease-out",
          activeTab === 'cart'
            ? 'opacity-100 translate-x-0 pointer-events-auto'
            : activeTab === 'products'
              ? 'opacity-0 translate-x-full pointer-events-none'
              : 'opacity-0 -translate-x-full pointer-events-none'
        )}>
          {cartComponent}
        </div>

        {/* Payment Tab */}
        <div className={cn(
          "absolute inset-0 h-full w-full transition-all duration-300 ease-out overflow-y-auto",
          activeTab === 'payment'
            ? 'opacity-100 translate-x-0 pointer-events-auto'
            : 'opacity-0 translate-x-full pointer-events-none'
        )}>
          {paymentComponent}
        </div>
      </div>

      {/* Quick Total Bar - Only on products/cart tab */}
      {activeTab !== 'payment' && cart.length > 0 && (
        <div className="flex-shrink-0 bg-card border-t border-border px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{cart.length} items</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold">${cartTotal}</span>
              <Button
                size="sm"
                onClick={() => setActiveTab('payment')}
                className="gap-1"
              >
                <CreditCard className="h-4 w-4" />
                Pagar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="flex-shrink-0 bg-card border-t border-border safe-area-bottom">
        <div className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center py-3 px-2 transition-colors relative",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="relative">
                  <Icon className={cn("h-6 w-6", isActive && "scale-110 transition-transform")} />
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-5 min-w-5 p-0 flex items-center justify-center text-xs"
                    >
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </Badge>
                  )}
                </div>
                <span className={cn(
                  "text-xs mt-1 font-medium",
                  isActive && "font-semibold"
                )}>
                  {tab.label}
                </span>
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-primary rounded-b-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default MobilePOSLayout;
