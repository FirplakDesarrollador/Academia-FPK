"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./page.module.css";

/**
 * Recibe el magic link generado por Talento Humano (admin.generateLink type=magiclink)
 * y consume la sesion de Supabase, sea cual sea el flow configurado en el proyecto:
 *  - PKCE: la URL trae `?code=...` y hay que intercambiarlo explicitamente.
 *  - Implicito/hash: la URL trae `#access_token=...&refresh_token=...`. En vez de
 *    confiar en la deteccion automatica de supabase-js (detectSessionInUrl, que
 *    depende de que el cliente termine de inicializarse antes de que llamemos a
 *    getSession(), una carrera dificil de garantizar), lo leemos y lo consumimos
 *    explicitamente con setSession() para que sea deterministico.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const errorDescription =
          url.searchParams.get("error_description") ||
          new URLSearchParams(window.location.hash.replace(/^#/, "")).get("error_description");

        if (errorDescription) {
          throw new Error(decodeURIComponent(errorDescription.replace(/\+/g, " ")));
        }

        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        console.log("[auth/callback] modo detectado:", {
          hasCode: !!code,
          hasHashTokens: !!(accessToken && refreshToken),
        });

        if (accessToken && refreshToken) {
          // Flujo implicito/hash: fijamos la sesion explicitamente con los tokens
          // que ya vienen en la URL, sin depender de la deteccion automatica.
          const { error: setError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setError) throw setError;
          // Limpiamos el hash de la URL para no dejar el token visible/reusable.
          window.history.replaceState(null, "", window.location.pathname);
        } else if (code) {
          // Flujo PKCE
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else {
          throw new Error("El enlace no contiene un token de sesión válido.");
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (cancelled) return;

        if (session) {
          console.log("[auth/callback] sesión establecida para:", session.user.email);
          router.replace("/");
          router.refresh();
        } else {
          setError("No se pudo iniciar sesión con el enlace recibido. Por favor intenta de nuevo.");
          setTimeout(() => {
            if (!cancelled) router.replace("/login");
          }, 2500);
        }
      } catch (err: any) {
        console.error("[auth/callback] Error consumiendo magic link:", err);
        if (cancelled) return;
        setError(err?.message || "No se pudo iniciar sesión con el enlace recibido.");
        setTimeout(() => {
          if (!cancelled) router.replace("/login");
        }, 2500);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {error ? (
          <>
            <p className={styles.errorText}>{error}</p>
            <p className={styles.subtitle}>Redirigiendo al inicio de sesión...</p>
          </>
        ) : (
          <>
            <div className={styles.spinner} />
            <p className={styles.title}>Iniciando sesión...</p>
            <p className={styles.subtitle}>Estamos conectando tu cuenta de Talento Humano.</p>
          </>
        )}
      </div>
    </div>
  );
}
