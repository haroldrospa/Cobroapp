import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingLogo } from '@/components/ui/loading-logo';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        if (mounted) {
          setSession(null);
          setLoading(false);
        }
        return;
      }

      // Check if user is active
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', session.user.id)
        .single();

      if (!mounted) return;

      if (profile && profile.is_active === false) {
        await supabase.auth.signOut();
        toast({
          variant: "destructive",
          title: "Acceso denegado",
          description: "Tu cuenta ha sido desactivada. Contacta al administrador.",
        });
        setSession(null);
        setLoading(false);
        return;
      }

      setSession(session);
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        if (mounted) {
          setSession(null);
          setLoading(false);
        }
      } else if (session) {
        // Optimization: don't re-check profile on every event if we just did, but for safety in "SIGNED_IN" we might.
        // For now rely on checkAuth running once or on session change.
        // Effectively checkAuth covers initial load.
        if (event === 'SIGNED_IN') {
          // Maybe re-run checkAuth?
          checkAuth();
        } else {
          if (mounted) setSession(session);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]); // Removed toast from dependency to avoid loop if toast changes (it shouldn't)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingLogo text="Verificando sesión..." />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
