import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
        const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: req.headers.get("Authorization")! } },
        });

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) {
            return new Response(JSON.stringify({ error: "No autorizado: sesión no válida" }), {
                status: 200, // Regresamos 200 para capturar el error custom en el front
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const { action, ...payload } = await req.json();

        // Obtener el perfil del que realiza la acción
        const { data: adminProfile } = await supabaseAdmin
            .from("profiles")
            .select("store_id, role")
            .eq("id", user.id)
            .single();

        let currentStoreId = adminProfile?.store_id;

        // Fallback: si el admin no tiene store_id, buscamos la primera tienda
        if (!currentStoreId) {
            const { data: stores } = await supabaseAdmin.from("stores").select("id").limit(1);
            if (stores && stores.length > 0) {
                currentStoreId = stores[0].id;
            }
        }

        if (action === "create") {
            const { email, password, fullName, role } = payload;
            let userId: string;

            if (!currentStoreId) {
                throw new Error("No tienes un comercio asociado. Crea uno primero.");
            }

            // 1. Check if Auth User already exists
            // 1. Check if Profile already exists (Proxy for Auth User existence)
            const { data: existingProfile } = await supabaseAdmin
                .from("profiles")
                .select("id, store_id")
                .eq("email", email)
                .maybeSingle();

            if (existingProfile) {
                console.log("Profile found, adopting user...");
                userId = existingProfile.id;

                if (existingProfile.store_id && existingProfile.store_id !== currentStoreId) {
                    throw new Error("Este correo ya está registrado en otro comercio.");
                }
            } else {
                // Profile not found. Try creating Auth user.
                const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true,
                    user_metadata: { full_name: fullName },
                });

                if (createError) {
                    console.error("Create User Error:", createError);
                    // If user validly exists in Auth but has no profile, we can't easily recover without RPC
                    if (createError.message?.toLowerCase().includes("already registered") || createError.message?.toLowerCase().includes("already exists")) {
                        throw new Error("El usuario ya existe en Auth pero no tiene perfil. Contacte soporte.");
                    }
                    throw createError;
                }

                if (!newUser.user) throw new Error("Error al crear usuario en Auth.");
                userId = newUser.user.id;
            }

            // Map roles ...
            let dbRole = role || 'staff';
            if (dbRole === 'cashier' || dbRole === 'manager') {
                dbRole = 'staff';
            }

            // 2. Update/Insert Profile
            const { error: profileError } = await supabaseAdmin
                .from("profiles")
                .upsert({
                    id: userId,
                    email: email,
                    full_name: fullName,
                    role: dbRole,
                    store_id: currentStoreId,
                    is_active: true
                }, { onConflict: 'id' });

            if (profileError) {
                console.error("Profile upsert error:", profileError);
                // Only delete if we just created it (profile didn't exist before)
                if (!existingProfile) {
                    await supabaseAdmin.auth.admin.deleteUser(userId);
                }
                throw profileError;
            }

            // 3. Update user_roles table if it exists (some migrations use it)
            try {
                await supabaseAdmin.from("user_roles").upsert({
                    user_id: userId,
                    role: dbRole === 'admin' ? 'admin' : 'staff'
                }, { onConflict: 'user_id' });
            } catch (e: any) {
                console.log("user_roles table likely doesn't exist or other error, skipping:", e.message);
            }

            return new Response(JSON.stringify({ success: true, userId }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        else if (action === "update") {
            const { id, email, password, fullName, role, is_active } = payload;

            const { data: targetProfile, error: fetchError } = await supabaseAdmin
                .from("profiles")
                .select("store_id, email")
                .eq("id", id)
                .single();

            if (fetchError || !targetProfile) throw new Error("Empleado no encontrado.");

            // Permitir si es el mismo usuario o si el store coincide
            const isSelfUpdate = id === user.id;
            const storeMismatch = targetProfile.store_id && currentStoreId && targetProfile.store_id !== currentStoreId;

            if (!isSelfUpdate && storeMismatch) {
                throw new Error("No tienes permiso para editar este empleado.");
            }

            // Actualizar Perfil
            // Map roles to known allowed values in the DB constraint if needed
            let dbRole = role;
            if (dbRole === 'cashier' || dbRole === 'manager') {
                dbRole = 'staff';
            }

            const updateData: any = {
                full_name: fullName,
                role: dbRole,
            };

            // Solo incluimos is_active si viene en el payload y no da error la columna
            if (typeof is_active === 'boolean') {
                updateData.is_active = is_active;
            }

            const { error: profileError } = await supabaseAdmin
                .from("profiles")
                .update(updateData)
                .eq("id", id);

            if (profileError) {
                // Si el error es que no existe la columna is_active, intentamos sin ella
                if (profileError.message.includes("is_active") || profileError.code === "42703") {
                    const { error: retryError } = await supabaseAdmin
                        .from("profiles")
                        .update({ full_name: fullName, role: role })
                        .eq("id", id);
                    if (retryError) throw retryError;
                } else {
                    throw profileError;
                }
            }

            // Actualizar Auth
            const authUpdates: any = {};
            if (email && email.toLowerCase() !== targetProfile.email?.toLowerCase()) {
                authUpdates.email = email;
            }
            if (password && password.length >= 6) {
                authUpdates.password = password;
            }

            if (Object.keys(authUpdates).length > 0) {
                const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdates);
                if (authError) throw authError;
            }

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        throw new Error("Acción no válida.");

    } catch (error: any) {
        console.error("Function error:", error.message);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 200, // Usamos 200 para que el front reciba el JSON de error correctamente
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
        );
    }
});
