"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// Permitimos que TypeScript sepa que esto es una proyección extendida de Supabase
interface DatabaseProfileRow {
  id: string;
  empleado_id: number;
  rol_id: number;
  empleado?: {
    nombreCompleto: string;
    correo_electronico: string;
    id: number;
  };
}

export interface UserProfile {
  id: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  correo: string;
  rol_id: string;
  empleado_id: number;
  activo: boolean;
}

interface AuthContextType {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  loading: true,
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadData(currentSession: Session | null) {
      if (!currentSession) {
        if (mounted) {
          setSession(null);
          setProfile(null);
          setLoading(false);
        }
        if (pathname !== "/login") router.push("/login");
        return;
      }

      // Si tenemos sesión, buscar el perfil
      try {
        const { data, error } = await supabase
          .schema("academia")
          .from("usuarios")
          .select("id, empleado_id, rol_id, nombre_completo")
          .eq("id", currentSession.user.id)
          .maybeSingle();

        if (error) {
          console.log("No se pudo cargar un perfil asigando al usuario en academia.usuarios:", error.message || error);
        }

        let mappedProfile: UserProfile | null = null;

        if (data) {
          let nombres = "";
          let apellidos = "";
          let correo = "";
          let cedula = data.empleado_id ? String(data.empleado_id) : "";

          if (data.empleado_id) {
            // Fetch empleado manually just to be safe from cross-schema postgrest errors
            const { data: empData } = await supabase
              .from("empleados")
              .select("nombreCompleto, correo_electronico, id")
              .eq("id", data.empleado_id)
              .maybeSingle();

            if (empData) {
              // nombreCompleto viene como "Nombre1 Nombre2 Apellido1 Apellido2"
              // Dividimos: primeras 2 partes = nombres, resto = apellidos
              const partes = (empData.nombreCompleto || "").trim().split(/\s+/);
              nombres = partes.slice(0, 2).join(" ") || empData.nombreCompleto || "";
              apellidos = partes.slice(2).join(" ");
              correo = empData.correo_electronico || "";
              cedula = String(empData.id);
            }
          }

          // Si el cruce con empleados no trajo nada (registro eliminado, RLS, etc.),
          // usamos el nombre guardado directamente en academia.usuarios al crear la cuenta.
          if (!nombres && data.nombre_completo) {
            const partes = data.nombre_completo.trim().split(/\s+/);
            nombres = partes.slice(0, 2).join(" ") || data.nombre_completo.trim();
            apellidos = partes.slice(2).join(" ");
          }

          // Mientras exista empleado_id, armamos el perfil igual (aunque no se haya
          // podido resolver el nombre) para que secciones como "Mis Cursos" —que
          // dependen de profile.empleado_id— sigan funcionando.
          if (nombres || data.empleado_id) {
            mappedProfile = {
              id: data.id,
              nombres: nombres || "Usuario",
              apellidos,
              cedula,
              correo,
              rol_id: String(data.rol_id),
              empleado_id: data.empleado_id,
              activo: true,
            };
          }
        }

        if (mounted) {
          setSession(currentSession);
          // Permite que data sea null si no tiene registro de perfil
          setProfile(mappedProfile);
        }
      } catch (err) {
        // Ignorar la excepción visual en dev mode
        console.log("No perfil asigando u obtenible:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    const initAuth = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      loadData(initialSession);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (currentSession) {
        // En caso de que inicie sesion
        loadData(currentSession);
      } else {
        // En caso de que cierre sesion
        if (mounted) {
          setSession(null);
          setProfile(null);
          setLoading(false);
        }
        if (pathname !== "/login") {
          router.push("/login");
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Skip rendering children if we are protecting the route and still loading
  if (loading && pathname !== "/login") {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
        Validando credenciales...
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
