"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { PlusCircle, Search, Edit, Eye, BookOpen, Clock } from "lucide-react";
import styles from "./page.module.css";

interface Curso {
  id: string;
  nombre: string;
  categoria: { nombre: string };
  activo: boolean;
  modulos_count?: number;
}

export default function GestionCursos() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchCursos();
  }, []);

  const fetchCursos = async () => {
    setLoading(true);
    try {
      const { data: cursosData, error } = await supabase
        .schema("academia")
        .from("cursos")
        .select("id, nombre, activo, categoria:categoria_id(nombre)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Para optimizar podríamos hacer un conteo, pero para ahora listamos lo básico.
      setCursos((cursosData || []) as any);
    } catch (err) {
      console.error("Error cargando cursos:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCursos = cursos.filter(c => 
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`${styles.container} animate-fade-in`}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Gestión de Cursos</h1>
          <p className={styles.subtitle}>
            Crea, edita y organiza el contenido de todos los cursos de la Academia.
          </p>
        </div>
      </header>

      <div className={styles.controls}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={20} color="#64748b" className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Buscar curso por nombre..."
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Link href="/admin/cursos/crear" className={styles.createBtn}>
          <PlusCircle size={18} /> Nuevo Curso
        </Link>
      </div>

      <div className={styles.tableContainer}>
        {loading ? (
          <div className={styles.loading}>Cargando cursos...</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Curso</th>
                <th>Categoría</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredCursos.length > 0 ? (
                filteredCursos.map(curso => (
                  <tr key={curso.id}>
                    <td>
                      <strong>{curso.nombre}</strong>
                    </td>
                    <td>{curso.categoria?.nombre || "Sin Categoría"}</td>
                    <td>
                      {curso.activo ? (
                        <span className={`${styles.status} ${styles.statusActive}`}>Activo</span>
                      ) : (
                        <span className={`${styles.status} ${styles.statusInactive}`}>Inactivo</span>
                      )}
                    </td>
                    <td style={{ display: "flex", gap: "8px" }}>
                      <Link 
                        href={`/admin/cursos/${curso.id}/editar`}
                        className={styles.actionBtn}
                        title="Editar Contenido del Curso"
                      >
                        <Edit size={16} /> Contenido
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                    No hay cursos disponibles.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
