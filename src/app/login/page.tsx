"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./page.module.css";

export default function Login() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Logica dual: si no tiene arroba, asumimos que es una cédula de empleado
      // y le agregamos el dominio interno mockeado
      let emailToLogin = identifier.trim();
      
      if (!emailToLogin.includes("@")) {
        emailToLogin = `${emailToLogin}@empleado.academia.local`;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: emailToLogin,
        password: password,
      });

      if (signInError) {
        throw signInError;
      }

      // Si es exitoso, redirigimos al dashboard
      router.push("/");
      router.refresh(); // Refrescar para que aplique contexto de auth en toda la app
    } catch (err: any) {
      console.error("Login error:", err);
      // Mensajes amigables para el usuario
      if (err.message === "Invalid login credentials") {
        setError("Credenciales incorrectas. Verifica tu cédula/correo y contraseña.");
      } else {
        setError(err.message || "Ocurrió un error al intentar iniciar sesión.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${styles.loginContainer} animate-fade-in`}>
      <section className={styles.formSection}>
        <div className={styles.formWrapper}>
          <div className={styles.logo}>
            <span /> Academia
          </div>
          
          <h1 className={styles.title}>Bienvenido de nuevo</h1>
          <p className={styles.subtitle}>Ingresa tus datos para continuar formándote</p>

          <form onSubmit={handleLogin}>
            <div className={styles.formGroup}>
              <label htmlFor="identifier" className={styles.label}>
                Cédula o Correo
              </label>
              <input
                id="identifier"
                type="text"
                className={styles.input}
                placeholder="Ej. 10203040 o admin@empresa.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password" className={styles.label}>
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                className={styles.input}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button 
              type="submit" 
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading ? "Iniciando sesión..." : "Ingresar a la plataforma"}
            </button>
          </form>
        </div>
      </section>

      <section className={styles.imageSection}>
        <div className={styles.imageText}>
          <h2>Transformando el conocimiento en acción</h2>
          <p>
            Plataforma centralizada de aprendizaje para continuar potenciando 
            tu desarrollo profesional y tus habilidades.
          </p>
        </div>
      </section>
    </div>
  );
}
