import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { OfflineIndicator } from "@/components/OfflineIndicator";

// Lazy load components for code splitting
const Layout = lazy(() => import("./components/Layout"));
const Dashboard = lazy(() => import("./components/Dashboard"));
const POS = lazy(() => import("./components/POS"));
const Products = lazy(() => import("./components/Products"));
const Customers = lazy(() => import("./components/Customers"));
const Invoices = lazy(() => import("./components/Invoices"));
const Reports = lazy(() => import("./components/Reports"));
const Settings = lazy(() => import("./components/Settings"));
const Employees = lazy(() => import("./components/Employees"));
const Auth = lazy(() => import("./pages/Auth"));
const MiTienda = lazy(() => import("./pages/MiTienda"));
const Accounting = lazy(() => import("./components/Accounting"));
const Payroll = lazy(() => import("./components/Payroll"));
const Tienda = lazy(() => import("./pages/Tienda"));
const BuscarTienda = lazy(() => import("./pages/BuscarTienda"));
const ProtectedRoute = lazy(() => import("./components/ProtectedRoute"));
const NotFound = lazy(() => import("./pages/NotFound"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
    mutations: {
      networkMode: 'offlineFirst',
    }
  },
});

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-muted-foreground text-sm">Cargando...</p>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <OfflineIndicator />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public routes - no auth required */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/tienda/:slug" element={<Tienda />} />
            <Route path="/buscar-tienda" element={<BuscarTienda />} />

            {/* Protected routes - auth required */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        <Route path="/" element={<POS />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/pos" element={<POS />} />
                        <Route path="/products" element={<Products />} />
                        <Route path="/customers" element={<Customers />} />
                        <Route path="/invoices" element={<Invoices />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/employees" element={<Employees />} />
                        <Route path="/mi-tienda" element={<MiTienda />} />
                        <Route path="/accounting" element={<Accounting />} />
                        <Route path="/payroll" element={<Payroll />} />

                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
