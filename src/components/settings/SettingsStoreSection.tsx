import React, { useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Store, Hash, Globe, Building2, Share2, Copy, ExternalLink, QrCode, Download, Palette } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SettingsStoreSectionProps {
  storeLoading: boolean;
  userStore: any;
  profile: any;
  storeName: string;
  setStoreName: (name: string) => void;
  creatingStore: boolean;
  handleCreateStore: () => void;
  onUpdateStoreName?: (name: string) => void;
  isMobile?: boolean;
  logoUrl?: string | null;
  shopType: string;
  setShopType: (type: string) => void;
  handleSaveSettings: (section: string) => void;
}

const SettingsStoreSection: React.FC<SettingsStoreSectionProps> = ({
  storeLoading,
  userStore,
  profile,
  storeName,
  setStoreName,
  creatingStore,
  handleCreateStore,
  onUpdateStoreName,
  isMobile = false,
  logoUrl,
  shopType,
  setShopType,
  handleSaveSettings
}) => {
  const { toast } = useToast();
  const qrRef = useRef<HTMLDivElement>(null);
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [newStoreName, setNewStoreName] = React.useState('');

  // Initialize newStoreName when userStore loads
  React.useEffect(() => {
    if (userStore?.store_name) {
      setNewStoreName(userStore.store_name);
    }
  }, [userStore]);

  const storeLookupCode = userStore?.store_code || profile?.user_number || '';
  const storeUrl = userStore ? `${window.location.origin}/tienda/${userStore.slug}` : '';

  const handleDownloadQR = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 300;
      canvas.height = 300;
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, 300, 300);
        const pngUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `qr-tienda-${userStore?.store_code || 'mi-tienda'}.png`;
        link.href = pngUrl;
        link.click();
      }
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleSaveName = () => {
    if (onUpdateStoreName && newStoreName.trim()) {
      onUpdateStoreName(newStoreName);
      setIsEditingName(false);
    }
  };

  const content = (
    <div className="space-y-6">
      {storeLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          Cargando información de la tienda...
        </div>
      ) : !userStore ? (
        <div className="space-y-6">
          <div className="text-center py-4">
            <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">No tienes una tienda configurada</p>
            <p className="text-sm text-muted-foreground mb-6">
              Crea tu tienda para que tus clientes puedan ver tus productos y hacer pedidos online.
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="store-name">Nombre de tu Tienda</Label>
              <Input
                id="store-name"
                placeholder="Ej: Mi Negocio, Tienda Juan, etc."
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                disabled={creatingStore}
              />
            </div>
            <Button
              onClick={handleCreateStore}
              disabled={creatingStore || !storeName.trim()}
              className="w-full"
            >
              {creatingStore ? 'Creando tienda...' : 'Crear Mi Tienda'}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Store Name Edit Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Store className="h-4 w-4 text-primary" />
              Nombre de la Tienda
            </div>
            {isEditingName ? (
              <div className="flex gap-2">
                <Input
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  placeholder="Nombre de la tienda"
                />
                <Button onClick={handleSaveName} disabled={!newStoreName.trim()}>
                  Guardar
                </Button>
                <Button variant="ghost" onClick={() => setIsEditingName(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 border rounded-md">
                <span className="font-semibold text-lg">{userStore.store_name}</span>
                <Button variant="outline" size="sm" onClick={() => setIsEditingName(true)}>
                  Editar
                </Button>
              </div>
            )}
          </div>



          <Separator />

          {/* Shop Theme Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Palette className="h-4 w-4 text-primary" />
              Tema de la Tienda
            </div>
            <p className="text-sm text-muted-foreground">
              Elige el diseño que mejor se adapte a tu tipo de negocio
            </p>
            <div className="flex gap-2">
              <div className="flex-1">
                <Select value={shopType} onValueChange={(val) => {
                  setShopType(val);
                  // Autosave or button? The user explicitly asked for themes. 
                  // I will rely on the main "Guardar" button or auto-save if intended.
                  // Settings usually have a save button. But here it's mixed.
                  // Let's add a small save button next to it similar to name.
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tema" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Estándar (General)</SelectItem>
                    <SelectItem value="restaurant">Restaurante / Comida</SelectItem>
                    <SelectItem value="fashion">Tienda de Ropa / Moda</SelectItem>
                    <SelectItem value="supermarket">Supermercado / Abarrotes</SelectItem>
                    <SelectItem value="technology">Tecnología / Electrónica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => handleSaveSettings('tienda')}>
                Guardar
              </Button>
            </div>
          </div>

          <Separator />

          {/* Store Code Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Hash className="h-4 w-4 text-primary" />
              Código de Tienda
            </div>
            <p className="text-sm text-muted-foreground">
              Comparte este código para que tus clientes encuentren tu tienda
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={storeLookupCode}
                readOnly
                className="font-mono text-lg font-bold"
              />
              <Button
                variant="outline"
                size="icon"
                disabled={!storeLookupCode}
                onClick={() => {
                  if (!storeLookupCode) return;
                  navigator.clipboard.writeText(storeLookupCode);
                  toast({
                    title: "Copiado",
                    description: "Código de tienda copiado al portapapeles",
                  });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Separator />

          {/* Store Link Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Globe className="h-4 w-4 text-primary" />
              Enlace Directo a tu Tienda
            </div>
            <p className="text-sm text-muted-foreground">
              Comparte este enlace para que tus clientes accedan directamente
            </p>
            <div className="flex flex-col gap-2">
              <Input
                value={`${window.location.origin}/tienda/${userStore.slug}`}
                readOnly
                className="font-mono text-xs"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/tienda/${userStore.slug}`);
                    toast({
                      title: "Copiado",
                      description: "Enlace de tienda copiado al portapapeles",
                    });
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(`/tienda/${userStore.slug}`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* QR Code Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <QrCode className="h-4 w-4 text-primary" />
              Código QR para Caja
            </div>
            <p className="text-sm text-muted-foreground">
              Imprime este QR y colócalo en caja para que tus clientes escaneen y accedan a tu tienda
            </p>
            <div className="flex flex-col items-center gap-3 p-6 bg-white rounded-lg border shadow-sm">
              {/* QR with optional logo */}
              <div ref={qrRef} className="p-2 bg-white relative">
                <QRCodeSVG
                  value={storeUrl}
                  size={200}
                  level="H"
                  includeMargin={true}
                  imageSettings={logoUrl ? {
                    src: logoUrl,
                    x: undefined,
                    y: undefined,
                    height: 40,
                    width: 40,
                    excavate: true,
                  } : undefined}
                />
              </div>

              {/* Store Code Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
                <span className="text-xs font-medium text-primary">Código:</span>
                <span className="text-sm font-mono font-bold text-primary">
                  {userStore?.store_code}
                </span>
              </div>

              {/* Scan instruction */}
              <p className="text-xs text-muted-foreground text-center">
                Escanea para ver productos y hacer pedidos
              </p>

              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={handleDownloadQR}
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar QR
              </Button>
            </div>
          </div>

          <Separator />
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Share2 className="h-4 w-4 text-primary" />
              Compartir con Clientes
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  const text = `¡Visita mi tienda online! ${window.location.origin}/tienda/${userStore.slug}`;
                  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
                  window.open(url, '_blank');
                }}
              >
                Compartir por WhatsApp
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  const text = `¡Visita mi tienda online! ${window.location.origin}/tienda/${userStore.slug}`;
                  navigator.clipboard.writeText(text);
                  toast({
                    title: "Copiado",
                    description: "Mensaje copiado al portapapeles",
                  });
                }}
              >
                Copiar Mensaje
              </Button>
            </div>
          </div>
        </>
      )
      }
    </div >
  );

  if (isMobile) {
    return content;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Store className="mr-2 h-5 w-5" />
          Mi Tienda Online
        </CardTitle>
        <CardDescription>
          Comparte tu tienda con tus clientes para que puedan hacer pedidos
        </CardDescription>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
};

export default SettingsStoreSection;
