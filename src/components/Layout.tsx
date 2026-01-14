import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingCart, Package, Users, FileText, BarChart, Settings, Menu, ChevronDown, LogOut, Store, User, Briefcase, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useTheme } from '@/components/ThemeProvider';
import cobroLogoLight from '@/assets/cobro-logo-light.png';
import cobroLogoDark from '@/assets/cobro-logo-dark.png';
import { OnboardingTutorial } from '@/components/OnboardingTutorial';
import { useQueryClient } from '@tanstack/react-query';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const queryClient = useQueryClient();
  const isPOS = location.pathname === '/' || location.pathname === '/pos';

  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const navigation = React.useMemo(() => {
    // Definimos solo los items principales según el rol
    if (profile?.role === 'staff' || profile?.role === 'cashier') {
      return [
        { name: 'Punto de Venta', href: '/', icon: ShoppingCart },
        { name: 'Clientes', href: '/customers', icon: Users },
      ];
    }

    // Para administradores y gerentes, mostramos el menú completo
    return [
      { name: 'Punto de Venta', href: '/', icon: ShoppingCart },
      { name: 'Dashboard', href: '/dashboard', icon: Home },
      { name: 'Productos', href: '/products', icon: Package },
      { name: 'Clientes', href: '/customers', icon: Users },
      { name: 'Facturas', href: '/invoices', icon: FileText },
      { name: 'Reportes', href: '/reports', icon: BarChart },
      { name: 'Contabilidad', href: '/accounting', icon: FileText },
      { name: 'Empleados', href: '/employees', icon: Users },
      { name: 'Nómina', href: '/payroll', icon: Briefcase },
      { name: 'Configuración', href: '/settings', icon: Settings },
    ];
  }, [profile]);

  const { theme } = useTheme();
  const [systemTheme, setSystemTheme] = React.useState<'dark' | 'light'>(
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );

  React.useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light');

    // Initial check
    setSystemTheme(media.matches ? 'dark' : 'light');

    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []); // Run once on mount to set up listener

  const effectiveTheme = theme === 'system' ? systemTheme : theme;
  const logoSrc = effectiveTheme === 'dark' ? cobroLogoDark : cobroLogoLight;

  // Redirect unauthorized users
  React.useEffect(() => {
    if (profile?.role === 'staff' || profile?.role === 'cashier') {
      const allowedPaths = ['/', '/pos', '/customers'];
      const isAllowed = allowedPaths.some(path =>
        location.pathname === path || (path !== '/' && location.pathname.startsWith(path))
      );

      if (!isAllowed) {
        navigate('/');
      }
    }
  }, [profile, location.pathname, navigate]);

  const getCurrentPageName = () => {
    const currentItem = navigation.find(item => item.href === location.pathname);
    return currentItem ? currentItem.name : 'Menú';
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    // Clear query cache regardless of error to ensure clean state
    queryClient.clear();

    if (error) {
      toast({
        title: 'Error al iniciar sesión', // fixed typo from original "Error al cerrar sesión" which was correct, but keeping consistency
        description: error.message,
        variant: 'destructive',
      });
    } else {
      navigate('/');
    }
  };

  if (isPOS) {
    return (
      <div className="h-screen w-screen overflow-hidden flex flex-col">
        <OnboardingTutorial />
        {!isOnline && (
          <div className="bg-destructive text-destructive-foreground p-1 text-center text-xs font-semibold safe-area-top">
            Sin conexión - Trabajando offline
          </div>
        )}
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <OnboardingTutorial />
      {!isOnline && (
        <div className="bg-destructive text-destructive-foreground text-center text-xs py-1 px-4 font-medium fixed top-0 w-full z-50">
          Sin conexión a internet. Trabajando en modo offline.
        </div>
      )}
      <div className={`flex items-center justify-between p-3 border-b border-border bg-card ${!isOnline ? 'mt-6' : ''}`}>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-3 h-10">
                <Menu className="h-5 w-5" />
                <span className="font-semibold">{getCurrentPageName()}</span>
                <ChevronDown className="h-4 w-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 bg-popover">
              {navigation.map(item => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem key={item.name} asChild>
                    <Link
                      to={item.href}
                      className={`flex items-center gap-2 px-2 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground ${location.pathname === item.href ? 'bg-accent text-accent-foreground' : ''
                        }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex items-center gap-2 px-2 py-2 cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                <span>Cerrar Sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-4">
          {profile && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{profile.full_name || profile.email}</span>
              {profile.user_number && (
                <span className="text-xs text-muted-foreground">({profile.user_number})</span>
              )}
            </div>
          )}
          <div className="text-xs text-muted-foreground hidden md:block">Desarrollado por Harold Rosado</div>
        </div>
      </div>

      {/* Contenido principal */}
      <main className="p-4">
        {children}
      </main>
    </div>
  );
};

export default Layout;