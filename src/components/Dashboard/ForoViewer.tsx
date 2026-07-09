"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Providers/AuthProvider";
import { Send, MessageSquare, Trash2 } from "lucide-react";
import styles from "./ForoViewer.module.css";

interface Mensaje {
  id: string;
  mensaje: string;
  created_at: string;
  usuario_id: string;
  usuario: { nombre_completo: string; } | null;
}

interface ForoViewerProps {
  leccionId: string;
  tema: string;
  onComplete?: () => void;
  completed?: boolean;
}

export default function ForoViewer({ leccionId, tema, onComplete, completed }: ForoViewerProps) {
  const { profile } = useAuth();
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);

  const fetchMensajes = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .schema("academia")
        .from("foro_mensajes")
        .select("id, mensaje, created_at, usuario_id, usuario:usuario_id (nombre_completo)")
        .eq("leccion_id", leccionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setMensajes((data || []) as any);
    } catch (err) {
      console.error("Error cargando mensajes del foro:", err);
    } finally {
      setLoading(false);
    }
  }, [leccionId]);

  useEffect(() => { fetchMensajes(); }, [fetchMensajes]);

  const handleEnviar = async () => {
    if (!nuevoMensaje.trim() || !profile?.id) return;
    setEnviando(true);
    try {
      const { error } = await supabase.schema("academia").from("foro_mensajes").insert({
        leccion_id: leccionId,
        usuario_id: profile.id,
        mensaje: nuevoMensaje.trim(),
      });
      if (error) throw error;
      setNuevoMensaje("");
      await fetchMensajes();
      if (!completed && onComplete) onComplete();
    } catch (err: any) {
      alert("Error al enviar el mensaje: " + err.message);
    } finally {
      setEnviando(false);
    }
  };

  const handleEliminar = async (id: string) => {
    if (!confirm("Eliminar tu mensaje?")) return;
    try {
      const { error } = await supabase.schema("academia").from("foro_mensajes").delete().eq("id", id);
      if (error) throw error;
      await fetchMensajes();
    } catch (err: any) {
      alert("Error al eliminar el mensaje: " + err.message);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString("es-CO", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });

  return (
    <div className={styles.foroContainer}>
      <div className={styles.temaHeader}>
        <MessageSquare size={22} color="#f97316" />
        <div>
          <h2 className={styles.temaTitle}>Foro de Discusion</h2>
          <p className={styles.temaTopic}>{tema}</p>
        </div>
      </div>
      <div className={styles.mensajesList}>
        {loading ? (
          <p className={styles.empty}>Cargando mensajes...</p>
        ) : mensajes.length === 0 ? (
          <div className={styles.emptyState}><MessageSquare size={40} opacity={0.3} /><p>Se el primero en comentar.</p></div>
        ) : (
          mensajes.map((msg) => {
            const isOwn = msg.usuario_id === profile?.id;
            return (
              <div key={msg.id} className={`${styles.mensajeCard} ${isOwn ? styles.ownMensaje : ""}`}>
                <div className={styles.mensajeAvatar}>{(msg.usuario?.nombre_completo || "U")[0].toUpperCase()}</div>
                <div className={styles.mensajeBody}>
                  <div className={styles.mensajeMeta}>
                    <span className={styles.mensajeAutor}>{msg.usuario?.nombre_completo || "Usuario"}</span>
                    <span className={styles.mensajeFecha}>{formatDate(msg.created_at)}</span>
                    {isOwn && <button className={styles.deleteBtn} onClick={() => handleEliminar(msg.id)} title="Eliminar"><Trash2 size={14} /></button>}
                  </div>
                  <p className={styles.mensajeTexto}>{msg.mensaje}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className={styles.inputArea}>
        <div className={styles.inputAvatar}>{(profile ? `${profile.nombres} ${profile.apellidos}` : "U")[0].toUpperCase()}</div>
        <div className={styles.inputWrapper}>
          <textarea
            className={styles.messageInput}
            rows={3}
            placeholder="Escribe tu comentario o respuesta..."
            value={nuevoMensaje}
            onChange={(e) => setNuevoMensaje(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleEnviar(); }}
          />
          <div className={styles.inputFooter}>
            <span className={styles.hint}>Ctrl+Enter para enviar</span>
            <button className={styles.sendBtn} onClick={handleEnviar} disabled={enviando || !nuevoMensaje.trim()}>
              <Send size={16} />{enviando ? "Enviando..." : "Publicar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
