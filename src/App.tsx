import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { LoadingLogo } from "@/components/ui/loading-logo";

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
const LandingPage = lazy(() => import("./pages/LandingPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',
      gcTime: 1000 * 60 * 60 * 24, // 24 hours - keep data in cache
      staleTime: 1000 * 60 * 15, // 15 minutes - data is fresh for longer
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
      refetchOnReconnect: true, // Refetch when internet reconnects
      retry: 2, // Retry failed requests twice
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: 1, // Retry mutations once
    }
  },
});

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <LoadingLogo text="Cargando..." />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <OfflineIndicator />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public routes - no auth required */}
            <Route path="/" element={<LandingPage />} />
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
