import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  GripVertical, 
  Image as ImageIcon,
  ExternalLink,
  Save
} from 'lucide-react';
import { 
  usePromotionalBanners, 
  useCreateBanner, 
  useUpdateBanner, 
  useDeleteBanner,
  PromotionalBanner 
} from '@/hooks/usePromotionalBanners';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/hooks/useUserStore';
import { useToast } from '@/hooks/use-toast';

interface BannerFormData {
  title: string;
  subtitle: string;
  image_url: string;
  link_url: string;
  is_active: boolean;
}

const initialFormData: BannerFormData = {
  title: '',
  subtitle: '',
  image_url: '',
  link_url: '',
  is_active: true,
};

const BannerSettingsSection: React.FC = () => {
  const { data: banners = [], isLoading } = usePromotionalBanners();
  const createBanner = useCreateBanner();
  const updateBanner = useUpdateBanner();
  const deleteBanner = useDeleteBanner();
  const { data: userStore } = useUserStore();
  const { toast } = useToast();
  
  const [showDialog, setShowDialog] = useState(false);
  const [editingBanner, setEditingBanner] = useState<PromotionalBanner | null>(null);
  const [formData, setFormData] = useState<BannerFormData>(initialFormData);
  const [uploading, setUploading] = useState(false);

  const handleOpenCreate = () => {
    setEditingBanner(null);
    setFormData(initialFormData);
    setShowDialog(true);
  };

  const handleOpenEdit = (banner: PromotionalBanner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      image_url: banner.image_url || '',
      link_url: banner.link_url || '',
      is_active: banner.is_active,
    });
    setShowDialog(true);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userStore?.id) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "La imagen es muy grande. Máximo 5MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/banners/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, image_url: publicUrl }));
      toast({ title: "Imagen subida", description: "La imagen se ha subido correctamente." });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo subir la imagen.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.image_url) {
      toast({
        title: "Error",
        description: "Debes subir una imagen para el banner.",
        variant: "destructive",
      });
      return;
    }

    if (editingBanner) {
      await updateBanner.mutateAsync({
        id: editingBanner.id,
        ...formData,
      });
    } else {
      await createBanner.mutateAsync({
        ...formData,
        sort_order: banners.length,
      });
    }
    setShowDialog(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este banner?')) {
      await deleteBanner.mutateAsync(id);
    }
  };

  const handleToggleActive = async (banner: PromotionalBanner) => {
    await updateBanner.mutateAsync({
      id: banner.id,
      is_active: !banner.is_active,
    });
  };

  if (isLoading) {
    return <div className="animate-pulse space-y-4">
      {[1, 2].map(i => (
        <div key={i} className="h-24 bg-muted rounded-lg" />
      ))}
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Banners Promocionales</h3>
          <p className="text-sm text-muted-foreground">
            Configura los banners que aparecerán en tu tienda
          </p>
        </div>
        <Button onClick={handleOpenCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Nuevo Banner
        </Button>
      </div>

      {banners.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-4">
              No tienes banners configurados
            </p>
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-1" />
              Crear primer banner
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {banners.map((banner) => (
            <Card key={banner.id} className={!banner.is_active ? 'opacity-50' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                  
                  {banner.image_url ? (
                    <img 
                      src={banner.image_url} 
                      alt={banner.title || 'Banner'} 
                      className="h-16 w-28 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="h-16 w-28 bg-muted rounded-lg flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{banner.title || 'Sin título'}</h4>
                    <p className="text-sm text-muted-foreground truncate">{banner.subtitle || 'Sin subtítulo'}</p>
                    {banner.link_url && (
                      <div className="flex items-center gap-1 text-xs text-primary">
                        <ExternalLink className="h-3 w-3" />
                        <span className="truncate">{banner.link_url}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={banner.is_active} 
                      onCheckedChange={() => handleToggleActive(banner)}
                    />
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleOpenEdit(banner)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDelete(banner.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingBanner ? 'Editar Banner' : 'Nuevo Banner'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Imagen del Banner</Label>
              {formData.image_url ? (
                <div className="relative">
                  <img 
                    src={formData.image_url} 
                    alt="Preview" 
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute bottom-2 right-2"
                    onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                  >
                    Cambiar
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-6">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="banner-image-upload"
                    disabled={uploading}
                  />
                  <label 
                    htmlFor="banner-image-upload" 
                    className="flex flex-col items-center cursor-pointer"
                  >
                    <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">
                      {uploading ? 'Subiendo...' : 'Click para subir imagen'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Recomendado: 1200x400px
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="banner-title">Título (opcional)</Label>
              <Input
                id="banner-title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ej: ¡Gran Oferta de Verano!"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="banner-subtitle">Subtítulo (opcional)</Label>
              <Input
                id="banner-subtitle"
                value={formData.subtitle}
                onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                placeholder="Ej: Hasta 50% de descuento"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="banner-link">URL de enlace (opcional)</Label>
              <Input
                id="banner-link"
                value={formData.link_url}
                onChange={(e) => setFormData(prev => ({ ...prev, link_url: e.target.value }))}
                placeholder="Ej: https://..."
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium text-sm">Banner activo</p>
                <p className="text-xs text-muted-foreground">Mostrar en la tienda</p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={createBanner.isPending || updateBanner.isPending || !formData.image_url}
            >
              <Save className="h-4 w-4 mr-1" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BannerSettingsSection;
