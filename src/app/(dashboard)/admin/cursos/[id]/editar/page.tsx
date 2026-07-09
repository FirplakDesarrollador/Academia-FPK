"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, Plus, Edit, Trash2, Video, FileText, CheckSquare, 
  Save, X, GripVertical, FileBox, ImageIcon, Loader2
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
  const [uploadingOptionKey, setUploadingOptionKey] = useState<string | null>(null);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isVideo: boolean = true) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `cursos/${cursoId}/${fileName}`;
      const bucketName = isVideo ? 'videos' : 'evidencias'; // Usamos el bucket 'evidencias' para archivos ya que no tiene limite de tamano ni restriccion de formato

      const response = await fetch('/api/admin/upload-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: filePath, bucket: bucketName })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al obtener permiso de subida');
      }

      const { data: signedData } = await response.json();

      if (!signedData || !signedData.token) {
        throw new Error('No se pudo obtener el token de subida');
      }

      const { error } = await supabase.storage
        .from(bucketName)
        .uploadToSignedUrl(filePath, signedData.token, file);

      if (error) {
        throw error;
      }

      const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);

      setLeccionEdit((prev: any) => ({ ...prev, contenido_url: publicUrlData.publicUrl }));
    } catch (err: any) {
      console.error(err);
      alert("Error al subir el archivo: " + err.message);
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
          opciones: [
            { texto: "Opción 1", imagen_url: "" },
            { texto: "Opción 2", imagen_url: "" }
          ],
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
      let updatedPregunta = { ...newPreguntas[index], [key]: value };

      // Si se cambia el tipo, resetear las opciones y la respuesta correcta según el nuevo tipo
      if (key === "tipo") {
        if (value === "verdadero_falso") {
          updatedPregunta.opciones = ["Verdadero", "Falso"];
          updatedPregunta.respuesta_correcta = "Verdadero";
          updatedPregunta.subpreguntas = undefined;
          updatedPregunta.opciones_globales = undefined;
        } else if (value === "emparejamiento") {
          updatedPregunta.opciones = undefined;
          updatedPregunta.respuesta_correcta = undefined;
          updatedPregunta.subpreguntas = [
            { texto: "Elemento 1", respuesta_correcta: "Respuesta A" },
            { texto: "Elemento 2", respuesta_correcta: "Respuesta B" },
          ];
          updatedPregunta.opciones_globales = ["Respuesta A", "Respuesta B"];
        } else if (newPreguntas[index].tipo === "verdadero_falso" || newPreguntas[index].tipo === "emparejamiento") {
          updatedPregunta.opciones = [
            { texto: "Opción 1", imagen_url: "" },
            { texto: "Opción 2", imagen_url: "" }
          ];
          updatedPregunta.respuesta_correcta = "Opción 1";
          updatedPregunta.subpreguntas = undefined;
          updatedPregunta.opciones_globales = undefined;
        }
      }

      newPreguntas[index] = updatedPregunta;
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

  // Helper: obtener texto de una opción (soporta string legacy y objeto nuevo)
  const getOpcionTexto = (op: any): string => {
    if (typeof op === "string") return op;
    return op?.texto || "";
  };

  const updateOptionText = (pIndex: number, oIndex: number, newText: string) => {
    setLeccionEdit((prev: any) => {
      const newPreguntas = [...prev.evaluacion_preguntas];
      const newOpciones = [...newPreguntas[pIndex].opciones];
      const current = newOpciones[oIndex];
      newOpciones[oIndex] = typeof current === "string"
        ? { texto: newText, imagen_url: "" }
        : { ...current, texto: newText };
      newPreguntas[pIndex] = { ...newPreguntas[pIndex], opciones: newOpciones };
      return { ...prev, evaluacion_preguntas: newPreguntas };
    });
  };

  const updateOptionImage = (pIndex: number, oIndex: number, imageUrl: string) => {
    setLeccionEdit((prev: any) => {
      const newPreguntas = [...prev.evaluacion_preguntas];
      const newOpciones = [...newPreguntas[pIndex].opciones];
      const current = newOpciones[oIndex];
      newOpciones[oIndex] = typeof current === "string"
        ? { texto: current, imagen_url: imageUrl }
        : { ...current, imagen_url: imageUrl };
      newPreguntas[pIndex] = { ...newPreguntas[pIndex], opciones: newOpciones };
      return { ...prev, evaluacion_preguntas: newPreguntas };
    });
  };

  const addOption = (pIndex: number) => {
    setLeccionEdit((prev: any) => {
      const newPreguntas = [...prev.evaluacion_preguntas];
      const newOpciones = [...(newPreguntas[pIndex].opciones || [])];
      newOpciones.push({ texto: `Opción ${newOpciones.length + 1}`, imagen_url: "" });
      newPreguntas[pIndex] = { ...newPreguntas[pIndex], opciones: newOpciones };
      return { ...prev, evaluacion_preguntas: newPreguntas };
    });
  };

  const removeOption = (pIndex: number, oIndex: number) => {
    setLeccionEdit((prev: any) => {
      const newPreguntas = [...prev.evaluacion_preguntas];
      const newOpciones = [...newPreguntas[pIndex].opciones];
      newOpciones.splice(oIndex, 1);
      newPreguntas[pIndex] = { ...newPreguntas[pIndex], opciones: newOpciones };
      return { ...prev, evaluacion_preguntas: newPreguntas };
    });
  };

  const handleOptionImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    pIndex: number,
    oIndex: number,
    isPar: boolean = false
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const key = isPar ? `par-${pIndex}-${oIndex}` : `opt-${pIndex}-${oIndex}`;
    setUploadingOptionKey(key);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `cursos/${cursoId}/opciones/${Math.random().toString(36).substring(2, 10)}_${Date.now()}.${fileExt}`;
      const response = await fetch('/api/admin/upload-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, bucket: 'evidencias' })
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Error al obtener permiso');
      const { data: signedData } = await response.json();
      if (!signedData?.token) throw new Error('No se pudo obtener el token');
      const { error } = await supabase.storage.from('evidencias').uploadToSignedUrl(fileName, signedData.token, file);
      if (error) throw error;
      const { data: publicUrlData } = supabase.storage.from('evidencias').getPublicUrl(fileName);
      
      if (isPar) {
        updateParImage(pIndex, oIndex, publicUrlData.publicUrl);
      } else {
        updateOptionImage(pIndex, oIndex, publicUrlData.publicUrl);
      }
    } catch (err: any) {
      alert("Error al subir imagen: " + err.message);
    } finally {
      setUploadingOptionKey(null);
      // Reset input so same file can be re-selected
      e.target.value = "";
    }
  };

  const handleOptionImagePaste = async (pIndex: number, oIndex: number, isPar: boolean = false) => {
    try {
      const clipItems = await navigator.clipboard.read();
      for (const item of clipItems) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const ext = imageType.split('/')[1] || 'png';
          const fileName = `cursos/${cursoId}/opciones/paste_${Date.now()}.${ext}`;
          const key = isPar ? `par-${pIndex}-${oIndex}` : `opt-${pIndex}-${oIndex}`;
          setUploadingOptionKey(key);
          const response = await fetch('/api/admin/upload-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName, bucket: 'evidencias' })
          });
          if (!response.ok) throw new Error((await response.json()).error || 'Error al obtener permiso');
          const { data: signedData } = await response.json();
          if (!signedData?.token) throw new Error('No se pudo obtener el token');
          const { error } = await supabase.storage.from('evidencias').uploadToSignedUrl(fileName, signedData.token, blob);
          if (error) throw error;
          const { data: publicUrlData } = supabase.storage.from('evidencias').getPublicUrl(fileName);
          
          if (isPar) {
            updateParImage(pIndex, oIndex, publicUrlData.publicUrl);
          } else {
            updateOptionImage(pIndex, oIndex, publicUrlData.publicUrl);
          }
          setUploadingOptionKey(null);
          return;
        }
      }
      alert('No hay imagen en el portapapeles. Copia una imagen primero.');
    } catch (err: any) {
      setUploadingOptionKey(null);
      alert('Error al pegar imagen: ' + (err.message || 'Permisos de portapapeles denegados'));
    }
  };

  // ─── EMPAREJAMIENTO ──────────────────────────────────────────────
  const addPar = (pIndex: number) => {
    setLeccionEdit((prev: any) => {
      const newPreguntas = [...prev.evaluacion_preguntas];
      const subs = [...(newPreguntas[pIndex].subpreguntas || [])];
      const globals = [...(newPreguntas[pIndex].opciones_globales || [])];
      const newLabel = `Respuesta ${String.fromCharCode(65 + subs.length)}`;
      subs.push({ texto: `Elemento ${subs.length + 1}`, imagen_url: "", respuesta_correcta: newLabel });
      globals.push(newLabel);
      newPreguntas[pIndex] = { ...newPreguntas[pIndex], subpreguntas: subs, opciones_globales: globals };
      return { ...prev, evaluacion_preguntas: newPreguntas };
    });
  };

  const removePar = (pIndex: number, sIdx: number) => {
    setLeccionEdit((prev: any) => {
      const newPreguntas = [...prev.evaluacion_preguntas];
      const subs = [...(newPreguntas[pIndex].subpreguntas || [])];
      const removedResp = subs[sIdx]?.respuesta_correcta;
      subs.splice(sIdx, 1);
      const globals = (newPreguntas[pIndex].opciones_globales || []).filter((g: string) => g !== removedResp);
      newPreguntas[pIndex] = { ...newPreguntas[pIndex], subpreguntas: subs, opciones_globales: globals };
      return { ...prev, evaluacion_preguntas: newPreguntas };
    });
  };

  const updatePar = (pIndex: number, sIdx: number, field: 'texto' | 'respuesta_correcta', value: string) => {
    setLeccionEdit((prev: any) => {
      const newPreguntas = [...prev.evaluacion_preguntas];
      const subs = newPreguntas[pIndex].subpreguntas.map((s: any, i: number) =>
        i === sIdx ? { ...s, [field]: value } : s
      );
      // Recalcular opciones_globales desde las respuestas_correctas actuales
      const globals = subs.map((s: any) => s.respuesta_correcta);
      newPreguntas[pIndex] = { ...newPreguntas[pIndex], subpreguntas: subs, opciones_globales: globals };
      return { ...prev, evaluacion_preguntas: newPreguntas };
    });
  };

  const updateParImage = (pIndex: number, sIdx: number, imageUrl: string) => {
    setLeccionEdit((prev: any) => {
      const newPreguntas = [...prev.evaluacion_preguntas];
      const subs = newPreguntas[pIndex].subpreguntas.map((s: any, i: number) =>
        i === sIdx ? { ...s, imagen_url: imageUrl } : s
      );
      newPreguntas[pIndex] = { ...newPreguntas[pIndex], subpreguntas: subs };
      return { ...prev, evaluacion_preguntas: newPreguntas };
    });
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
                    <label>{leccionEdit.tipo === "video" ? "URL del Video (Youtube, Supabase, MP4)" : "URL del Archivo (PDF, Descargable)"}</label>
                    
                    <div style={{ marginBottom: "12px", padding: "12px", border: "1px dashed #cbd5e1", borderRadius: "8px", background: "#fff" }}>
                      <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", color: "#64748b" }}>
                        Opción 1: Subir archivo {leccionEdit.tipo === "video" ? "de video (MP4)" : "(PDF, etc)"}
                      </label>
                      <input 
                        type="file" 
                        accept={leccionEdit.tipo === "video" ? "video/mp4,video/x-m4v,video/*" : ".pdf,.doc,.docx,.xls,.xlsx,.zip"} 
                        className={styles.input} 
                        onChange={(e) => handleFileUpload(e, leccionEdit.tipo === "video")}
                        disabled={isUploading}
                        style={{ padding: "8px", fontSize: "14px" }}
                      />
                      {isUploading && <span style={{ fontSize: "13px", color: "#3b82f6", display: "block", marginTop: "4px" }}>Subiendo archivo... por favor espera.</span>}
                    </div>
                    
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", color: "#64748b" }}>
                      Opción 2: Pegar URL externa
                    </label>

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
                                <option value="emparejamiento">Emparejamiento (Arrastrar)</option>
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

                          {/* EMPAREJAMIENTO */}
                          {p.tipo === "emparejamiento" && (
                            <div className={styles.inputGroup} style={{ marginTop: "12px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                <label style={{ marginBottom: 0 }}>Pares de Emparejamiento</label>
                                <button type="button" onClick={() => addPar(index)} className={styles.actionBtn} style={{ padding: "4px 8px", fontSize: "12px" }}>
                                  <Plus size={12} style={{ marginRight: 4 }}/> Añadir Par
                                </button>
                              </div>

                              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto", gap: "8px", alignItems: "center", marginBottom: "6px" }}>
                                <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>ELEMENTO (izquierda)</span>
                                <span/>
                                <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>RESPUESTA (derecha)</span>
                                <span/>
                              </div>

                              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                {(p.subpreguntas || []).map((sub: any, sIdx: number) => {
                                  const isUploadingThis = uploadingOptionKey === `par-${index}-${sIdx}`;
                                  return (
                                  <div key={sIdx} className={styles.opcionRow}>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto", gap: "8px", alignItems: "flex-start" }}>
                                      <div className={styles.opcionInputs}>
                                        <input
                                          type="text" required className={styles.input}
                                          value={sub.texto}
                                          onChange={(e) => updatePar(index, sIdx, "texto", e.target.value)}
                                          placeholder={`Elemento ${sIdx + 1}`}
                                          style={{ margin: 0 }}
                                        />
                                        <div className={styles.opcionImageActions}>
                                          <label className={styles.imgUploadBtn} style={{ opacity: isUploadingThis ? 0.6 : 1, cursor: isUploadingThis ? 'not-allowed' : 'pointer' }}>
                                            {isUploadingThis ? <Loader2 size={15} className={styles.spinIcon} /> : <ImageIcon size={15} />}
                                            <span>Subir</span>
                                            <input
                                              type="file" accept="image/*" style={{ display: 'none' }} disabled={isUploadingThis}
                                              onChange={(e) => handleOptionImageUpload(e, index, sIdx, true)}
                                            />
                                          </label>
                                          <button type="button" className={styles.imgUploadBtn} disabled={isUploadingThis} onClick={() => handleOptionImagePaste(index, sIdx, true)}>
                                            {isUploadingThis ? <Loader2 size={15} className={styles.spinIcon} /> : <span style={{ fontSize: 14 }}>📋</span>}
                                            <span>Pegar</span>
                                          </button>
                                          {sub.imagen_url && (
                                            <button type="button" className={styles.imgRemoveBtn} onClick={() => updateParImage(index, sIdx, "")}>
                                              <X size={13}/> Quitar
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                      
                                      <span style={{ color: "#94a3b8", fontSize: "18px", textAlign: "center", paddingTop: "8px" }}>↔</span>
                                      
                                      <input
                                        type="text" required className={styles.input}
                                        value={sub.respuesta_correcta}
                                        onChange={(e) => updatePar(index, sIdx, "respuesta_correcta", e.target.value)}
                                        placeholder={`Respuesta ${sIdx + 1}`}
                                        style={{ margin: 0 }}
                                      />
                                      
                                      <button
                                        type="button"
                                        onClick={() => removePar(index, sIdx)}
                                        className={styles.iconBtnDelete}
                                        style={{ padding: "8px", margin: 0, marginTop: "2px" }}
                                        title="Eliminar par"
                                      >
                                        <Trash2 size={16}/>
                                      </button>
                                    </div>
                                    
                                    {sub.imagen_url && (
                                      <div className={styles.opcionImagePreview} style={{ marginTop: "8px" }}>
                                        <img src={sub.imagen_url} alt={`Imagen elemento ${sIdx + 1}`} />
                                      </div>
                                    )}
                                  </div>
                                  );
                                })}
                              </div>

                              <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "8px" }}>
                                ⚠️ El estudiante verá los elementos en orden y las respuestas mezcladas en un menú desplegable para seleccionar.
                              </p>
                            </div>
                          )}

                          {/* OPCIONES PARA TIPO MULTIPLES */}
                          {(p.tipo === "opcion_multiple" || p.tipo === "seleccion_multiple") && (
                            <div className={styles.inputGroup} style={{ marginTop: "12px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                <label style={{ marginBottom: 0 }}>Opciones</label>
                                <button type="button" onClick={() => addOption(index)} className={styles.actionBtn} style={{ padding: "4px 8px", fontSize: "12px" }}>
                                  <Plus size={12} style={{ marginRight: 4 }}/> Añadir Opción
                                </button>
                              </div>
                              
                              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                {(p.opciones || []).map((op: any, oIndex: number) => {
                                  const opKey = `opt-${index}-${oIndex}`;
                                  const opTexto = getOpcionTexto(op);
                                  const opImagen = typeof op === "object" ? op.imagen_url : "";
                                  const isUploadingThis = uploadingOptionKey === opKey;
                                  return (
                                  <div key={oIndex} className={styles.opcionRow}>
                                    <div className={styles.opcionInputs}>
                                      <input 
                                        type="text" required className={styles.input} 
                                        value={opTexto}
                                        onChange={(e) => updateOptionText(index, oIndex, e.target.value)}
                                        placeholder={`Texto opción ${oIndex + 1}`}
                                        style={{ margin: 0 }}
                                      />
                                      <div className={styles.opcionImageActions}>
                                        <label
                                          className={styles.imgUploadBtn}
                                          title="Subir imagen para esta opción"
                                          style={{ opacity: isUploadingThis ? 0.6 : 1, cursor: isUploadingThis ? 'not-allowed' : 'pointer' }}
                                        >
                                          {isUploadingThis
                                            ? <Loader2 size={15} className={styles.spinIcon} />
                                            : <ImageIcon size={15} />}
                                          <span>Subir</span>
                                          <input
                                            type="file"
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            disabled={isUploadingThis}
                                            onChange={(e) => handleOptionImageUpload(e, index, oIndex)}
                                          />
                                        </label>
                                        <button
                                          type="button"
                                          className={styles.imgUploadBtn}
                                          title="Pegar imagen del portapapeles (Ctrl+V)"
                                          disabled={isUploadingThis}
                                          onClick={() => handleOptionImagePaste(index, oIndex)}
                                        >
                                          {isUploadingThis
                                            ? <Loader2 size={15} className={styles.spinIcon} />
                                            : <span style={{ fontSize: 14 }}>📋</span>}
                                          <span>Pegar</span>
                                        </button>
                                        {opImagen && (
                                          <button
                                            type="button"
                                            className={styles.imgRemoveBtn}
                                            title="Quitar imagen"
                                            onClick={() => updateOptionImage(index, oIndex, "")}
                                          >
                                            <X size={13}/> Quitar img
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    {opImagen && (
                                      <div className={styles.opcionImagePreview}>
                                        <img src={opImagen} alt={`Imagen opción ${oIndex + 1}`} />
                                      </div>
                                    )}
                                    <button 
                                      type="button" 
                                      onClick={() => removeOption(index, oIndex)} 
                                      className={styles.iconBtnDelete}
                                      style={{ padding: "8px", margin: 0, flexShrink: 0 }}
                                      title="Eliminar opción"
                                    >
                                      <Trash2 size={16}/>
                                    </button>
                                  </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {p.tipo !== "emparejamiento" && (
                            <div className={styles.inputGroup} style={{ marginTop: "12px" }}>
                              <label>Respuesta Correcta {p.tipo === "verdadero_falso" ? "(Verdadero o Falso)" : "(Selecciona la opción correcta)"}</label>
                              {p.tipo === "verdadero_falso" ? (
                                <select className={styles.select} value={p.respuesta_correcta} onChange={(e) => updatePregunta(index, "respuesta_correcta", e.target.value)}>
                                  <option value="Verdadero">Verdadero</option>
                                  <option value="Falso">Falso</option>
                                </select>
                              ) : (
                                <select className={styles.select} value={p.respuesta_correcta} onChange={(e) => updatePregunta(index, "respuesta_correcta", e.target.value)} required>
                                  <option value="">Selecciona la respuesta correcta...</option>
                                  {(p.opciones || []).map((op: any, oIndex: number) => {
                                    const txt = getOpcionTexto(op);
                                    return (
                                      <option key={oIndex} value={txt}>{txt || `Opción ${oIndex + 1}`}</option>
                                    );
                                  })}
                                </select>
                              )}
                            </div>
                          )}

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
