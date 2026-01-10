import { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useLocation } from 'react-router-dom';

export const OnboardingTutorial = () => {
    const location = useLocation();
    const driverRef = useRef<any>(null);

    useEffect(() => {
        // Check if tutorial has been seen
        const hasSeenTutorial = localStorage.getItem('cobro_tutorial_completed');
        // Check if we are in the POS (Home)
        const isPOS = location.pathname === '/' || location.pathname === '/pos';
        // Check if we are in Accounting (for the new features tour)
        const isAccounting = location.pathname === '/accounting';

        if (!isPOS && !isAccounting) return;
        if (hasSeenTutorial && !isAccounting) return; // Always show accounting hints if specifically requested? No, stick to global standard.
        if (hasSeenTutorial) return;


        const steps = [];

        if (isPOS) {
            steps.push(
                {
                    element: 'body', // Fallback if no specific element, act as modal
                    popover: {
                        title: '👋 ¡Bienvenido a Cobro App!',
                        description: 'Tu sistema integral para ventas y contabilidad. Te daremos un recorrido rápido de 1 minuto.',
                        side: "center",
                        align: 'center'
                    }
                },
                {
                    element: '#pos-products-area',
                    popover: {
                        title: '📦 Catálogo de Productos',
                        description: 'Aquí tienes tus productos. Haz clic para agregar al carrito o usa la barra de búsqueda para encontrar lo que necesitas.',
                        side: "right",
                        align: 'start'
                    }
                },
                {
                    element: '#pos-cart-area',
                    popover: {
                        title: '🛒 Tu Carrito',
                        description: 'Los productos seleccionados aparecen aquí. Puedes cambiar cantidades o eliminar items fácilmente.',
                        side: "left",
                        align: 'start'
                    }
                },
                {
                    element: '#pos-payment-area',
                    popover: {
                        title: '💳 Procesar Venta',
                        description: 'El resumen final. Selecciona el cliente, tipo de factura (NCF) y método de pago. ¡Todo en uno!',
                        side: "left",
                        align: 'center'
                    }
                },
                {
                    element: '#pos-menu-btn',
                    popover: {
                        title: '🚀 Menú Principal',
                        description: 'El centro de comando. Accede aquí para ir a **Contabilidad**, Reportes, Configuración y más funciones administrativas.',
                        side: "bottom",
                        align: 'start'
                    }
                }
            );
        } else if (isAccounting) {
            // Specialized tour for the new Accounting AI features
            steps.push(
                {
                    element: '#accounting-stats',
                    popover: {
                        title: '📊 Resumen Financiero',
                        description: 'Controla tu salud financiera. Ve tus ventas vs gastos y utilidad neta en tiempo real.',
                        side: "bottom",
                        align: 'center'
                    }
                },
                {
                    element: '#accounting-add-expense-btn',
                    popover: {
                        title: '🤖 Nuevo: IA para Facturas',
                        description: '¡La magia ocurre aquí! Haz clic para registrar un gasto y prueba nuestra **IA mejorada** que lee tus facturas automáticamente.',
                        side: "bottom",
                        align: 'end'
                    }
                },
                {
                    element: '#accounting-tabs',
                    popover: {
                        title: '📂 Organización Total',
                        description: 'Gestiona tus Proveedores y ve Reportes detallados desde estas pestañas.',
                        side: "top",
                        align: 'start'
                    }
                }
            );
        }

        if (steps.length === 0) return;

        driverRef.current = driver({
            showProgress: true,
            animate: true,
            allowClose: true,
            doneBtnText: '¡Entendido!',
            nextBtnText: 'Siguiente',
            prevBtnText: 'Atrás',
            steps: steps,
            onDestroyed: () => {
                // If they finish the POS tour, mark as completed so we don't spam.
                // If they are in accounting, maybe we just mark that specific part? 
                // For simplicity, let's just mark the global tutorial as done if they finish the Welcome one.
                if (isPOS) {
                    localStorage.setItem('cobro_tutorial_completed', 'true');
                }
            }
        });

        // Small delay to ensure render
        const timer = setTimeout(() => {
            driverRef.current.drive();
        }, 1500);

        return () => {
            clearTimeout(timer);
            if (driverRef.current) {
                driverRef.current.destroy();
            }
        };

    }, [location]);

    return null;
};
