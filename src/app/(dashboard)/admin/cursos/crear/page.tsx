"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BookOpen, AlertCircle, CheckCircle, Save, X } from "lucide-react";
import styles from "./page.module.css";

interface Categoria {
  id: string;
  nombre: string;
}

export default function CrearCurso() {
  const router = useRouter();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    imagen_url: "",
    categoria_id: "",
    activo: true,
  });

  const [nuevaCategoria, setNuevaCategoria] = useState("");

  useEffect(() => {
    fetchCategorias();
  }, []);

  const fetchCategorias = async () => {
    try {
      const { data, error } = await supabase
        .schema("academia")
        .from("categorias")
        .select("id, nombre")
        .order("nombre");
        
      if (error) throw error;
      setCategorias(data || []);
      if (data && data.length > 0) {
        setFormData(prev => ({ ...prev, categoria_id: data[0].id }));
      }
    } catch (err) {
      console.error("Error cargando categorias:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      if (!formData.nombre.trim()) throw new Error("El nombre del curso es obligatorio");
      
      let finalCategoriaId = formData.categoria_id;

      if (finalCategoriaId === "otra") {
        if (!nuevaCategoria.trim()) throw new Error("Debes especificar el nombre de la nueva categoría");
        
        // Crear la nueva categoría
        const { data: newCatData, error: catError } = await supabase
          .schema("academia")
          .from("categorias")
          .insert([{ nombre: nuevaCategoria.trim(), descripcion: "" }])
          .select();
          
        if (catError) throw catError;
        if (newCatData && newCatData.length > 0) {
          finalCategoriaId = newCatData[0].id;
        } else {
          throw new Error("No se pudo crear la nueva categoría");
        }
      } else if (!finalCategoriaId) {
        throw new Error("Debes seleccionar una categoría");
      }

      const { data, error: insertError } = await supabase
        .schema("academia")
        .from("cursos")
        .insert([
          {
            nombre: formData.nombre.trim(),
            descripcion: formData.descripcion.trim(),
            imagen_url: formData.imagen_url.trim() || null,
            categoria_id: finalCategoriaId,
            activo: formData.activo,
          }
        ])
        .select();

      if (insertError) throw insertError;

      setSuccess(true);
      setTimeout(() => {
        if (data && data[0]) {
          router.push(`/admin/cursos/${data[0].id}/editar`);
        } else {
          router.push("/admin/cursos");
        }
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Error al crear el curso");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as any;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  if (loading) {
    return <div className={styles.loading}>Cargando formulario...</div>;
  }

  return (
    <div className={`${styles.container} animate-fade-in`}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Crear Nuevo Curso</h1>
          <p className={styles.subtitle}>
            Configura los detalles básicos del curso para que esté disponible en la plataforma.
          </p>
        </div>
      </header>

      <div className={styles.card}>
        {success ? (
          <div className={styles.successMessage}>
            <CheckCircle size={48} color="#16a34a" />
            <h2>¡Curso creado con éxito!</h2>
            <p>El curso ha sido guardado. Redirigiendo...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            {error && (
              <div className={styles.errorMessage}>
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            <div className={styles.inputGroup}>
              <label htmlFor="nombre">Nombre del Curso *</label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                className={styles.input}
                placeholder="Ej: Herramientas Colaborativas"
                value={formData.nombre}
                onChange={handleChange}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="descripcion">Descripción</label>
              <textarea
                id="descripcion"
                name="descripcion"
                className={styles.textarea}
                placeholder="Breve descripción de lo que se aprenderá en este curso..."
                value={formData.descripcion}
                onChange={handleChange}
                rows={4}
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.inputGroup} style={{ flex: 1 }}>
                <label htmlFor="categoria_id">Categoría *</label>
                <select
                  id="categoria_id"
                  name="categoria_id"
                  className={styles.select}
                  value={formData.categoria_id}
                  onChange={handleChange}
                  required
                >
                  <option value="" disabled>Selecciona una categoría</option>
                  {categorias.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nombre}
                    </option>
                  ))}
                  <option value="otra">Otra (Añadir nueva)...</option>
                </select>

                {formData.categoria_id === "otra" && (
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Escribe la nueva categoría"
                    value={nuevaCategoria}
                    onChange={(e) => setNuevaCategoria(e.target.value)}
                    required
                    style={{ marginTop: "8px" }}
                  />
                )}
              </div>

              <div className={styles.inputGroup} style={{ flex: 1 }}>
                <label htmlFor="imagen_url">URL de la Imagen (Portada)</label>
                <input
                  id="imagen_url"
                  name="imagen_url"
                  type="text"
                  className={styles.input}
                  placeholder="https://ejemplo.com/imagen.jpg"
                  value={formData.imagen_url}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className={styles.checkboxGroup}>
              <input
                id="activo"
                name="activo"
                type="checkbox"
                checked={formData.activo}
                onChange={handleChange}
              />
              <label htmlFor="activo">Curso Activo (visible para inscripciones)</label>
            </div>

            <div className={styles.actions}>
              <button 
                type="button" 
                className={styles.cancelBtn}
                onClick={() => router.back()}
                disabled={saving}
              >
                <X size={18} /> Cancelar
              </button>
              <button type="submit" className={styles.saveBtn} disabled={saving}>
                <Save size={18} /> {saving ? "Guardando..." : "Crear Curso"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
