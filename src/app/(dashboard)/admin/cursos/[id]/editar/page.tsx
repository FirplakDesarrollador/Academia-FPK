"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, Plus, Edit, Trash2, Video, FileText, CheckSquare, 
  Save, X, GripVertical, FileBox
} from "lucide-react";
import styles from "./page.module.css";
import Link from "next/link";

interface Leccion {
  id: string;
  modulo_id: string;
  nombre: string;
  tipo: string;
  contenido: any;
  duracion_estimada: number;
  orden: number;
}

interface Modulo {
  id: string;
  curso_id: string;
  nombre: string;
  orden: number;
  lecciones: Leccion[];
}

export default function EditorCurso() {
  const router = useRouter();
  const params = useParams();
  const cursoId = params.id as string;

  const [curso, setCurso] = useState<any>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [loading, setLoading] = useState(true);

  // Modales
  const [showModuloModal, setShowModuloModal] = useState(false);
  const [moduloEdit, setModuloEdit] = useState<{id?: string, nombre: string, orden: number} | null>(null);

  const [showLeccionModal, setShowLeccionModal] = useState(false);
  const [leccionEdit, setLeccionEdit] = useState<any>(null); // Datos del formulario de lección

  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchCursoCompleto();
  }, [cursoId]);

  const fetchCursoCompleto = async () => {
    setLoading(true);
    try {
      // 1. Obtener curso
      const { data: cursoData, error: cursoError } = await supabase
        .schema("academia")
        .from("cursos")
        .select("*")
        .eq("id", cursoId)
        .single();
      
      if (cursoError) throw cursoError;
      setCurso(cursoData);

      // 2. Obtener modulos y lecciones
      const { data: modulosData, error: modulosError } = await supabase
        .schema("academia")
        .from("modulos")
        .select("*, lecciones(*)")
        .eq("curso_id", cursoId)
        .order("orden", { ascending: true });

      if (modulosError) throw modulosError;

      // Ordenar lecciones dentro de cada modulo
      const modulosOrdenados = modulosData.map((m: any) => ({
        ...m,
        lecciones: (m.lecciones || []).sort((a: any, b: any) => a.orden - b.orden)
      }));

      setModulos(modulosOrdenados);
    } catch (err) {
      console.error(err);
      alert("Error cargando la estructura del curso");
    } finally {
      setLoading(false);
    }
  };

  // ─── GESTION DE MODULOS ──────────────────────────────────────
  const openCrearModulo = () => {
    setModuloEdit({ nombre: "", orden: modulos.length + 1 });
    setShowModuloModal(true);
  };

  const openEditarModulo = (mod: Modulo) => {
    setModuloEdit({ id: mod.id, nombre: mod.nombre, orden: mod.orden });
    setShowModuloModal(true);
  };

  const handleSaveModulo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduloEdit || !moduloEdit.nombre.trim()) return;

    try {
      if (moduloEdit.id) {
        // Actualizar
        await supabase.schema("academia").from("modulos").update({
          nombre: moduloEdit.nombre,
          orden: moduloEdit.orden
        }).eq("id", moduloEdit.id);
      } else {
        // Crear
        await supabase.schema("academia").from("modulos").insert({
          curso_id: cursoId,
          nombre: moduloEdit.nombre,
          orden: moduloEdit.orden
        });
      }
      setShowModuloModal(false);
      fetchCursoCompleto();
    } catch (err) {
      console.error(err);
      alert("Error guardando el módulo");
    }
  };

  const handleDeleteModulo = async (modId: string) => {
    if (!confirm("¿Seguro que deseas eliminar este módulo? También se eliminarán todas sus lecciones.")) return;
    try {
      await supabase.schema("academia").from("modulos").delete().eq("id", modId);
      fetchCursoCompleto();
    } catch (err) {
      console.error(err);
      alert("Error eliminando módulo");
    }
  };


  // ─── GESTION DE LECCIONES ────────────────────────────────────
  const openCrearLeccion = (moduloId: string, currentLeccionesCount: number) => {
    setLeccionEdit({
      modulo_id: moduloId,
      nombre: "",
      tipo: "video",
      duracion_estimada: 10,
      orden: currentLeccionesCount + 1,
      // Contenido por defecto
      contenido_url: "",
      contenido_texto: "",
      evaluacion_preguntas: []
    });
    setShowLeccionModal(true);
  };

  const openEditarLeccion = (leccion: Leccion) => {
    let contenido = leccion.contenido || {};
    if (typeof contenido === "string") {
      try { contenido = JSON.parse(contenido); } catch (e) { contenido = {}; }
    }

    setLeccionEdit({
      id: leccion.id,
      modulo_id: leccion.modulo_id,
      nombre: leccion.nombre,
      tipo: leccion.tipo,
      duracion_estimada: leccion.duracion_estimada,
      orden: leccion.orden,
      contenido_url: contenido.url || "",
      contenido_texto: contenido.texto || contenido.descripcion || "",
      evaluacion_preguntas: contenido.preguntas || []
    });
    setShowLeccionModal(true);
  };

  const handleSaveLeccion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leccionEdit || !leccionEdit.nombre.trim()) return;

    try {
      // Preparar el JSON de contenido dependiendo del tipo
      let contenidoJson: any = {};
      if (leccionEdit.tipo === "video") {
        contenidoJson = { url: leccionEdit.contenido_url };
      } else if (leccionEdit.tipo === "texto") {
        contenidoJson = { texto: leccionEdit.contenido_texto };
      } else if (leccionEdit.tipo === "archivo") {
        contenidoJson = { url: leccionEdit.contenido_url, descripcion: leccionEdit.contenido_texto };
      } else if (leccionEdit.tipo === "evaluacion") {
        contenidoJson = { 
          titulo: leccionEdit.nombre,
          descripcion: leccionEdit.contenido_texto,
          preguntas: leccionEdit.evaluacion_preguntas 
        };
      }

      const payload = {
        modulo_id: leccionEdit.modulo_id,
        nombre: leccionEdit.nombre,
        tipo: leccionEdit.tipo,
        duracion_estimada: leccionEdit.duracion_estimada,
        orden: leccionEdit.orden,
        contenido: contenidoJson
      };

      if (leccionEdit.id) {
        await supabase.schema("academia").from("lecciones").update(payload).eq("id", leccionEdit.id);
      } else {
        await supabase.schema("academia").from("lecciones").insert(payload);
      }

      setShowLeccionModal(false);
      fetchCursoCompleto();
    } catch (err) {
      console.error(err);
      alert("Error guardando lección");
    }
  };

  const handleDeleteLeccion = async (leccionId: string) => {
    if (!confirm("¿Seguro que deseas eliminar esta lección?")) return;
    try {
      await supabase.schema("academia").from("lecciones").delete().eq("id", leccionId);
      fetchCursoCompleto();
    } catch (err) {
      console.error(err);
      alert("Error eliminando lección");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `cursos/${cursoId}/${fileName}`;

      const { error } = await supabase.storage.from('videos').upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

      if (error) {
        throw error;
      }

      const { data: publicUrlData } = supabase.storage.from('videos').getPublicUrl(filePath);

      setLeccionEdit((prev: any) => ({ ...prev, contenido_url: publicUrlData.publicUrl }));
    } catch (err: any) {
      console.error(err);
      alert("Error al subir el video: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // ─── GESTION DE PREGUNTAS (EVALUACION) ────────────────────────
  const addPregunta = () => {
    setLeccionEdit((prev: any) => ({
      ...prev,
      evaluacion_preguntas: [
        ...prev.evaluacion_preguntas,
        {
          id: Date.now(),
          tipo: "opcion_multiple",
          texto: "",
          opciones: ["Opción 1", "Opción 2"],
          respuesta_correcta: "Opción 1",
          retroalimentacion_correcta: "¡Muy bien!",
          retroalimentacion_incorrecta: "Respuesta incorrecta."
        }
      ]
    }));
  };

  const updatePregunta = (index: number, key: string, value: any) => {
    setLeccionEdit((prev: any) => {
      const newPreguntas = [...prev.evaluacion_preguntas];
      newPreguntas[index] = { ...newPreguntas[index], [key]: value };
      return { ...prev, evaluacion_preguntas: newPreguntas };
    });
  };

  const removePregunta = (index: number) => {
    setLeccionEdit((prev: any) => {
      const newPreguntas = [...prev.evaluacion_preguntas];
      newPreguntas.splice(index, 1);
      return { ...prev, evaluacion_preguntas: newPreguntas };
    });
  };

  const updateOpciones = (pIndex: number, opcionesTexto: string) => {
    const arr = opcionesTexto.split("\\n").filter(o => o.trim() !== "");
    updatePregunta(pIndex, "opciones", arr);
  };


  if (loading) return <div className={styles.loading}>Cargando editor del curso...</div>;
  if (!curso) return <div className={styles.loading}>Curso no encontrado</div>;

  return (
    <div className={`${styles.container} animate-fade-in`}>
      <header className={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Link href="/admin/cursos" className={styles.backBtn}>
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className={styles.title}>Constructor: {curso.nombre}</h1>
            <p className={styles.subtitle}>Estructura el temario añadiendo módulos y lecciones.</p>
          </div>
        </div>
        <button className={styles.createBtn} onClick={openCrearModulo}>
          <Plus size={18} /> Añadir Módulo
        </button>
      </header>

      <div className={styles.courseBuilder}>
        {modulos.length === 0 ? (
          <div className={styles.emptyState}>
            Este curso aún no tiene contenido. Añade el primer módulo para empezar.
          </div>
        ) : (
          modulos.map((mod) => (
            <div key={mod.id} className={styles.moduloCard}>
              <div className={styles.moduloHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <GripVertical size={18} color="#94a3b8" />
                  <h3 className={styles.moduloTitle}>Módulo {mod.orden}: {mod.nombre}</h3>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => openEditarModulo(mod)} className={styles.iconBtn} title="Editar módulo">
                    <Edit size={16} />
                  </button>
                  <button onClick={() => handleDeleteModulo(mod.id)} className={styles.iconBtnDelete} title="Eliminar módulo">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className={styles.leccionesList}>
                {mod.lecciones.length === 0 ? (
                  <p style={{ color: "#94a3b8", fontSize: "13px", padding: "10px" }}>Sin lecciones. Añade una para comenzar.</p>
                ) : (
                  mod.lecciones.map((lec) => (
                    <div key={lec.id} className={styles.leccionItem}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <GripVertical size={16} color="#cbd5e1" />
                        <div className={styles.tipoIcon} title={lec.tipo}>
                          {lec.tipo === "video" && <Video size={16} color="#3b82f6" />}
                          {lec.tipo === "texto" && <FileText size={16} color="#f59e0b" />}
                          {lec.tipo === "evaluacion" && <CheckSquare size={16} color="#10b981" />}
                          {lec.tipo === "archivo" && <FileBox size={16} color="#8b5cf6" />}
                        </div>
                        <span className={styles.leccionNombre}>{lec.orden}. {lec.nombre}</span>
                        <span className={styles.leccionDuracion}>{lec.duracion_estimada} min</span>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => openEditarLeccion(lec)} className={styles.iconBtn}>
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleDeleteLeccion(lec.id)} className={styles.iconBtnDelete}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
                
                <button 
                  className={styles.addLeccionBtn}
                  onClick={() => openCrearLeccion(mod.id, mod.lecciones.length)}
                >
                  <Plus size={16} /> Añadir Lección o Evaluación a este Módulo
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ─── MODAL: MODULO ────────────────────────────────────────── */}
      {showModuloModal && moduloEdit && (
        <div className={styles.overlay}>
          <div className={styles.modal} style={{ maxWidth: "400px" }}>
            <h3>{moduloEdit.id ? "Editar Módulo" : "Nuevo Módulo"}</h3>
            <form onSubmit={handleSaveModulo}>
              <div className={styles.inputGroup}>
                <label>Nombre del Módulo</label>
                <input 
                  type="text" 
                  required
                  className={styles.input} 
                  value={moduloEdit.nombre}
                  onChange={(e) => setModuloEdit({...moduloEdit, nombre: e.target.value})}
                />
              </div>
              <div className={styles.inputGroup} style={{ marginTop: "12px" }}>
                <label>Orden</label>
                <input 
                  type="number" 
                  required
                  className={styles.input} 
                  value={moduloEdit.orden}
                  onChange={(e) => setModuloEdit({...moduloEdit, orden: parseInt(e.target.value)})}
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModuloModal(false)}>Cancelar</button>
                <button type="submit" className={styles.saveBtn}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: LECCION / EVALUACION ────────────────────────────── */}
      {showLeccionModal && leccionEdit && (
        <div className={styles.overlay}>
          <div className={styles.modal} style={{ maxWidth: leccionEdit.tipo === "evaluacion" ? "800px" : "500px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0 }}>{leccionEdit.id ? "Editar Lección" : "Nueva Lección"}</h3>
              <button onClick={() => setShowLeccionModal(false)} className={styles.iconBtn}><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSaveLeccion}>
              <div className={styles.formRow}>
                <div className={styles.inputGroup} style={{ flex: 2 }}>
                  <label>Título de la lección/evaluación</label>
                  <input 
                    type="text" required className={styles.input} 
                    value={leccionEdit.nombre}
                    onChange={(e) => setLeccionEdit({...leccionEdit, nombre: e.target.value})}
                  />
                </div>
                <div className={styles.inputGroup} style={{ flex: 1 }}>
                  <label>Tipo</label>
                  <select 
                    className={styles.select} 
                    value={leccionEdit.tipo}
                    onChange={(e) => setLeccionEdit({...leccionEdit, tipo: e.target.value})}
                  >
                    <option value="video">🎥 Video (URL)</option>
                    <option value="texto">📄 Texto / Artículo</option>
                    <option value="archivo">📦 Archivo Descargable</option>
                    <option value="evaluacion">✅ Evaluación (Examen)</option>
                  </select>
                </div>
              </div>

              <div className={styles.formRow} style={{ marginTop: "12px" }}>
                <div className={styles.inputGroup} style={{ flex: 1 }}>
                  <label>Duración estimada (minutos)</label>
                  <input 
                    type="number" required min="1" className={styles.input} 
                    value={leccionEdit.duracion_estimada}
                    onChange={(e) => setLeccionEdit({...leccionEdit, duracion_estimada: parseInt(e.target.value)})}
                  />
                </div>
                <div className={styles.inputGroup} style={{ flex: 1 }}>
                  <label>Orden numérico</label>
                  <input 
                    type="number" required className={styles.input} 
                    value={leccionEdit.orden}
                    onChange={(e) => setLeccionEdit({...leccionEdit, orden: parseInt(e.target.value)})}
                  />
                </div>
              </div>

              {/* CAMPOS DINÁMICOS SEGÚN EL TIPO */}
              <div className={styles.dynamicContent} style={{ marginTop: "20px", padding: "16px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                
                {/* VIDEO O ARCHIVO */}
                {(leccionEdit.tipo === "video" || leccionEdit.tipo === "archivo") && (
                  <div className={styles.inputGroup}>
                    <label>{leccionEdit.tipo === "video" ? "URL del Video (Youtube, Supabase, MP4)" : "URL del Archivo a Descargar"}</label>
                    
                    {leccionEdit.tipo === "video" && (
                      <div style={{ marginBottom: "12px", padding: "12px", border: "1px dashed #cbd5e1", borderRadius: "8px", background: "#fff" }}>
                        <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", color: "#64748b" }}>
                          Opción 1: Subir archivo de video (MP4)
                        </label>
                        <input 
                          type="file" 
                          accept="video/mp4,video/x-m4v,video/*" 
                          className={styles.input} 
                          onChange={handleFileUpload}
                          disabled={isUploading}
                          style={{ padding: "8px", fontSize: "14px" }}
                        />
                        {isUploading && <span style={{ fontSize: "13px", color: "#3b82f6", display: "block", marginTop: "4px" }}>Subiendo video... por favor espera.</span>}
                      </div>
                    )}
                    
                    {leccionEdit.tipo === "video" && (
                      <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", color: "#64748b" }}>
                        Opción 2: Pegar URL externa
                      </label>
                    )}

                    <input 
                      type="url" required className={styles.input} 
                      placeholder="https://..."
                      value={leccionEdit.contenido_url}
                      onChange={(e) => setLeccionEdit({...leccionEdit, contenido_url: e.target.value})}
                    />
                    {leccionEdit.tipo === "archivo" && (
                      <div className={styles.inputGroup} style={{ marginTop: "12px" }}>
                        <label>Instrucciones / Descripción del archivo</label>
                        <textarea className={styles.textarea} rows={3} value={leccionEdit.contenido_texto} onChange={(e) => setLeccionEdit({...leccionEdit, contenido_texto: e.target.value})}/>
                      </div>
                    )}
                  </div>
                )}

                {/* TEXTO */}
                {leccionEdit.tipo === "texto" && (
                  <div className={styles.inputGroup}>
                    <label>Contenido (Puede usar HTML básico)</label>
                    <textarea 
                      className={styles.textarea} rows={8} required
                      placeholder="<p>Escribe aquí el contenido de la lección...</p>"
                      value={leccionEdit.contenido_texto}
                      onChange={(e) => setLeccionEdit({...leccionEdit, contenido_texto: e.target.value})}
                    />
                  </div>
                )}

                {/* EVALUACIÓN */}
                {leccionEdit.tipo === "evaluacion" && (
                  <div>
                    <div className={styles.inputGroup} style={{ marginBottom: "20px" }}>
                      <label>Descripción / Instrucciones del examen</label>
                      <textarea 
                        className={styles.textarea} rows={2}
                        value={leccionEdit.contenido_texto}
                        onChange={(e) => setLeccionEdit({...leccionEdit, contenido_texto: e.target.value})}
                      />
                    </div>
                    
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <h4 style={{ margin: 0, color: "var(--primary)" }}>Preguntas ({leccionEdit.evaluacion_preguntas.length})</h4>
                      <button type="button" onClick={addPregunta} className={styles.actionBtn} style={{ padding: "4px 10px", fontSize: "12px" }}>
                        <Plus size={14}/> Añadir Pregunta
                      </button>
                    </div>

                    <div className={styles.preguntasList}>
                      {leccionEdit.evaluacion_preguntas.map((p: any, index: number) => (
                        <div key={p.id} className={styles.preguntaCard}>
                          <div className={styles.preguntaHeader}>
                            <strong>Pregunta {index + 1}</strong>
                            <button type="button" onClick={() => removePregunta(index)} className={styles.iconBtnDelete}>
                              <Trash2 size={14}/>
                            </button>
                          </div>
                          
                          <div className={styles.formRow}>
                            <div className={styles.inputGroup} style={{ flex: 2 }}>
                              <label>Tipo de pregunta</label>
                              <select 
                                className={styles.select} 
                                value={p.tipo}
                                onChange={(e) => updatePregunta(index, "tipo", e.target.value)}
                              >
                                <option value="opcion_multiple">Opción Múltiple (Radio)</option>
                                <option value="seleccion_multiple">Selección Múltiple (Radio)</option>
                                <option value="verdadero_falso">Verdadero / Falso</option>
                              </select>
                            </div>
                          </div>

                          <div className={styles.inputGroup} style={{ marginTop: "12px" }}>
                            <label>Enunciado de la pregunta</label>
                            <input 
                              type="text" required className={styles.input} 
                              value={p.texto}
                              onChange={(e) => updatePregunta(index, "texto", e.target.value)}
                            />
                          </div>

                          {(p.tipo === "opcion_multiple" || p.tipo === "seleccion_multiple") && (
                            <div className={styles.inputGroup} style={{ marginTop: "12px" }}>
                              <label>Opciones (Una por línea)</label>
                              <textarea 
                                className={styles.textarea} rows={4} required
                                value={(p.opciones || []).join("\n")}
                                onChange={(e) => updateOpciones(index, e.target.value)}
                                placeholder="Opción A\nOpción B\nOpción C"
                              />
                            </div>
                          )}

                          <div className={styles.inputGroup} style={{ marginTop: "12px" }}>
                            <label>Respuesta Correcta {p.tipo === "verdadero_falso" ? "(Verdadero o Falso)" : "(Debe coincidir EXACTAMENTE con una opción)"}</label>
                            {p.tipo === "verdadero_falso" ? (
                              <select className={styles.select} value={p.respuesta_correcta} onChange={(e) => updatePregunta(index, "respuesta_correcta", e.target.value)}>
                                <option value="Verdadero">Verdadero</option>
                                <option value="Falso">Falso</option>
                              </select>
                            ) : (
                              <input 
                                type="text" required className={styles.input} 
                                value={p.respuesta_correcta}
                                onChange={(e) => updatePregunta(index, "respuesta_correcta", e.target.value)}
                              />
                            )}
                          </div>

                          <div className={styles.formRow} style={{ marginTop: "12px" }}>
                            <div className={styles.inputGroup} style={{ flex: 1 }}>
                              <label>Feedback Acierto</label>
                              <input type="text" className={styles.input} value={p.retroalimentacion_correcta} onChange={(e) => updatePregunta(index, "retroalimentacion_correcta", e.target.value)} />
                            </div>
                            <div className={styles.inputGroup} style={{ flex: 1 }}>
                              <label>Feedback Error</label>
                              <input type="text" className={styles.input} value={p.retroalimentacion_incorrecta} onChange={(e) => updatePregunta(index, "retroalimentacion_incorrecta", e.target.value)} />
                            </div>
                          </div>
                        </div>
                      ))}
                      {leccionEdit.evaluacion_preguntas.length === 0 && (
                        <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "13px", padding: "20px" }}>Añade preguntas para el examen.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.modalActions} style={{ marginTop: "24px" }}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowLeccionModal(false)}>Cancelar</button>
                <button type="submit" className={styles.saveBtn}><Save size={18}/> Guardar Lección</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
