"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./page.module.css";

/**
 * Recibe el magic link generado por Talento Humano (admin.generateLink type=magiclink)
 * y consume la sesion de Supabase, sea cual sea el flow configurado en el proyecto:
 *  - PKCE: la URL trae `?code=...` y hay que intercambiarlo explicitamente.
 *  - Implicito/hash: la URL trae `#access_token=...&refresh_token=...`; supabase-js
 *    ya la detecta y guarda la sesion automaticamente al inicializar el cliente
 *    (detectSessionInUrl: true, que es el default en src/lib/supabase.ts) — no hay
 *    que hacer nada extra para ese caso, solo esperar a que getSession() la resuelva.
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
        const errorDescription = url.searchParams.get("error_description");

        if (errorDescription) {
          throw new Error(errorDescription);
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        // Si vino como hash (#access_token=...), supabase-js ya la detecto y
        // guardo la sesion al inicializar el cliente. En ambos casos, confirmamos
        // aqui que efectivamente haya una sesion activa.
        const { data: { session } } = await supabase.auth.getSession();

        if (cancelled) return;

        if (session) {
          router.replace("/");
          router.refresh();
        } else {
          setError("No se pudo iniciar sesión con el enlace recibido. Por favor intenta de nuevo.");
          setTimeout(() => {
            if (!cancelled) router.replace("/login");
          }, 2500);
        }
      } catch (err: any) {
        console.error("Error consumiendo magic link:", err);
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
