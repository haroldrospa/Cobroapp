import React from 'react';
import { cn } from '@/lib/utils';
import {
  Store,
  Building2,
  FileText,
  CreditCard,
  Package,
  Printer,
  Settings as SettingsIcon,
  Database,
  ChevronLeft,
  ChevronRight,
  Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SettingsSection {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

interface MobileSettingsLayoutProps {
  activeSection: string | null;
  onSectionChange: (section: string | null) => void;
  children: Record<string, React.ReactNode>;
}

const settingsSections: SettingsSection[] = [
  { id: 'store', label: 'Mi Tienda', icon: Store, description: 'Configura tu tienda online' },
  { id: 'company', label: 'Empresa', icon: Building2, description: 'Información de la empresa' },
  { id: 'invoices', label: 'Facturas', icon: FileText, description: 'Numeración y formato' },
  { id: 'payments', label: 'Pagos', icon: CreditCard, description: 'Métodos de pago' },
  { id: 'products', label: 'Productos', icon: Package, description: 'Inventario y categorías' },
  { id: 'print', label: 'Impresión', icon: Printer, description: 'Configurar impresora' },
  { id: 'notifications', label: 'Notificaciones', icon: Bell, description: 'Sonidos y alertas' },
  { id: 'system', label: 'Sistema', icon: SettingsIcon, description: 'Idioma y apariencia' },
  { id: 'advanced', label: 'Avanzado', icon: Database, description: 'Datos y seguridad' },
];

const MobileSettingsLayout: React.FC<MobileSettingsLayoutProps> = ({
  activeSection,
  onSectionChange,
  children
}) => {
  const currentSection = settingsSections.find(s => s.id === activeSection);

  // Si no hay sección activa, mostrar el menú
  if (!activeSection) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-border">
          <h1 className="text-2xl font-bold">Configuración</h1>
          <p className="text-sm text-muted-foreground">Administra tu sistema</p>
        </div>

        {/* Section List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2 space-y-1">
            {settingsSections.map((section, index) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => onSectionChange(section.id)}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-xl",
                    "bg-card hover:bg-accent/50 active:bg-accent",
                    "transition-all duration-200 ease-out",
                    "text-left transform hover:scale-[1.02] active:scale-[0.98]",
                    "animate-fade-in"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-base">{section.label}</h3>
                    <p className="text-sm text-muted-foreground truncate">{section.description}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Mostrar el contenido de la sección activa
  return (
    <div className="min-h-screen flex flex-col bg-background animate-slide-in-right">
      {/* Header with back button */}
      <div className="flex-shrink-0 border-b border-border">
        <div className="flex items-center gap-2 p-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onSectionChange(null)}
            className="h-10 w-10"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="flex-1">
            <h2 className="font-semibold text-lg">{currentSection?.label}</h2>
          </div>
        </div>
      </div>

      {/* Section Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {children[activeSection]}
        </div>
      </div>
    </div>
  );
};

export default MobileSettingsLayout;
