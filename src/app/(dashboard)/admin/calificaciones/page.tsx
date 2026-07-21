"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./page.module.css";

interface Curso {
  id: string;
  nombre: string;
}

interface Leccion {
  id: string;
  nombre: string;
  modulos: { orden: number };
  orden: number;
}

interface Usuario {
  usuario_id: string; // ID en auth.users, o clave sintética "sr_..." si no está relacionado
  nombres: string;
  apellidos: string;
  cedula: string;
  origen?: "sin_relacionar";
}

interface Calificacion {
  id?: string;
  usuario_id: string;
  leccion_id: string;
  puntuacion: number;
  puntuacion_maxima: number;
  retroalimentacion?: string;
  origen?: "sin_relacionar";
}

export default function ReporteCalificador() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [selectedCurso, setSelectedCurso] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [lecciones, setLecciones] = useState<any[]>([]);
  const [calificaciones, setCalificaciones] = useState<Record<string, Calificacion>>({});
  const [vistas, setVistas] = useState<Record<string, boolean | string>>({});
  const [maxScores, setMaxScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [modalEvidence, setModalEvidence] = useState<{ url: string, usuarioId: string, leccionId: string, puntuacion: string, retroalimentacion: string } | null>(null);

  // 1. Cargar lista de cursos
  useEffect(() => {
    async function loadCursos() {
        try {
          const { data, error } = await supabase.schema("academia").from("cursos").select("id, nombre").order("created_at");
          if (error) {
            console.error("Error al cargar cursos:", error.message || error.details || error);
            setLoading(false);
            return;
          }
          if (data) {
            setCursos(data);
            if (data.length > 0) {
              setSelectedCurso(data[0].id);
            } else {
              setLoading(false); // No courses found, stop loading
            }
          }
        } catch (err) {
          console.error("Excepción al cargar cursos:", err);
          setLoading(false);
        }
    }
    loadCursos();
  }, []);

  // 2. Cargar Matriz cuando se selecciona un curso
  useEffect(() => {
    if (!selectedCurso) return;

    async function fetchMatrix() {
      setLoading(true);
      try {
        // A. Cargar usuarios (Alumnos) vinculados a la academia
        const { data: usersData, error: usersError } = await supabase
          .schema("academia")
          .from("usuarios")
          .select(`id, empleado_id`)
          .limit(100000);

        if (usersError) {
          console.error("Error loading users:", usersError);
          setLoading(false);
          return;
        }
        
        const mappedIds = usersData ? usersData.map(u => u.empleado_id).filter(id => id) : [];

        // Obtener detalles de los empleados
        let empsData: any[] = [];
        if (mappedIds.length > 0) {
          const { data, error: empsError } = await supabase
            .from("empleados")
            .select("id, nombreCompleto")
            .in("id", mappedIds);
            
          if (empsError) console.error("Error loading empleados:", empsError);
          if (data) empsData = data;
        }

        const empsLookup = empsData.reduce((acc: any, emp: any) => {
          acc[emp.id] = emp;
          return acc;
        }, {});

        const mappedUsers: Usuario[] = (usersData || []).map(u => {
          const emp = empsLookup[u.empleado_id];
          const partes = (emp?.nombreCompleto || "Usuario Desconocido").trim().split(/\s+/);
          return {
            usuario_id: u.id,
            nombres: partes.slice(0, 2).join(" "),
            apellidos: partes.slice(2).join(" ") || ".",
            cedula: String(u.empleado_id)
          };
        });
        
        // B. Cargar actividades del curso a evaluar (todas las lecciones)
        const { data: actsData, error: actsError } = await supabase
          .schema("academia")
          .from("lecciones")
          .select("id, nombre, orden, tipo, modulos!inner(curso_id, orden)")
          .eq("modulos.curso_id", selectedCurso)
          .order("orden", { referencedTable: "modulos", ascending: true });
          
        if (actsError) console.error("Error loading lecciones:", actsError);

        let sortedActs = (actsData as any[] || []).sort((a,b) => {
          if(a.modulos?.orden === b.modulos?.orden) return a.orden - b.orden;
          return (a.modulos?.orden || 0) - (b.modulos?.orden || 0);
        });

        // C. Cargar calificaciones cruzadas en chunks para evitar límites de API (max-rows de Supabase)
        // C. Cargar calificaciones cruzadas en chunks para evitar límites de API (max-rows de Supabase)
        const lookup: Record<string, Calificacion> = {};
        const lessonMaxScores: Record<string, number> = {};
        const chunkSize = 50;
        const usuarioIds = mappedUsers.map(u => u.usuario_id);
        
        for (let i = 0; i < usuarioIds.length; i += chunkSize) {
          const chunk = usuarioIds.slice(i, i + chunkSize);
          const { data: califData, error: califError } = await supabase
            .schema("academia")
            .from("calificaciones")
            .select("id, usuario_id, leccion_id, puntuacion, puntuacion_maxima, retroalimentacion")
            .eq("curso_id", selectedCurso)
            .in("usuario_id", chunk);
            
          if (califError) console.error("Error loading calificaciones:", califError);
          
          califData?.forEach(c => {
            lookup[`${c.usuario_id}_${c.leccion_id}`] = c;

            // Determinar la puntuación máxima para cada lección
            const cMax = Number(c.puntuacion_maxima) || 0;
            if (cMax > (lessonMaxScores[c.leccion_id] || 0)) {
              lessonMaxScores[c.leccion_id] = cMax;
            }
          });
        }

        // C2. Cargar calificaciones de personas que no se pudieron relacionar con ningún usuario/empleado
        const { data: sinRelData, error: sinRelError } = await supabase
          .schema("academia")
          .from("calificaciones_sin_relacionar")
          .select("id, leccion_id, nombre, apellidos, correo, cedula, puntuacion, puntuacion_maxima")
          .eq("curso_id", selectedCurso);

        if (sinRelError) console.error("Error loading calificaciones_sin_relacionar:", sinRelError);

        const sinRelUsersMap = new Map<string, Usuario>();
        sinRelData?.forEach(r => {
          const key = `sr_${(r.nombre + "_" + r.apellidos + "_" + (r.correo || "")).toLowerCase().replace(/\s+/g, "_")}`;
          if (!sinRelUsersMap.has(key)) {
            sinRelUsersMap.set(key, {
              usuario_id: key,
              nombres: r.nombre,
              apellidos: r.apellidos,
              cedula: r.cedula || "",
              origen: "sin_relacionar",
            });
          }
          lookup[`${key}_${r.leccion_id}`] = {
            id: r.id,
            usuario_id: key,
            leccion_id: r.leccion_id,
            puntuacion: r.puntuacion,
            puntuacion_maxima: r.puntuacion_maxima,
            origen: "sin_relacionar",
          };
          const cMax = Number(r.puntuacion_maxima) || 0;
          if (cMax > (lessonMaxScores[r.leccion_id] || 0)) {
            lessonMaxScores[r.leccion_id] = cMax;
          }
        });

        const sinRelUsers = Array.from(sinRelUsersMap.values());

        // D. Cargar visualizaciones de lecciones (Visto/No Visto)
        const { data: insData, error: insError } = await supabase
          .schema("academia")
          .from("inscripciones")
          .select("id, empleado_id, usuario_id, metadata")
          .eq("curso_id", selectedCurso)
          .limit(100000);

        if (insError) {
          console.error("Error loading inscripciones:", insError);
        }

        const insToUser: Record<string, string> = {};
        insData?.forEach(ins => {
            if (ins.usuario_id) {
                insToUser[ins.id] = ins.usuario_id;
            } else {
                const u = usersData?.find(u => String(u.empleado_id) === String(ins.empleado_id));
                if (u) insToUser[ins.id] = u.id;
            }
        });

        let vistasLookup: Record<string, boolean | string> = {};
        
        // Custom logic for Herramientas Colaborativas Firplak
        if (selectedCurso === "283c7f14-4c73-47df-a0be-ad8e19ab8c3a") {
            sortedActs = [
              { id: 'progreso_colab', nombre: 'Recursos Completados', tipo: 'progreso' },
              { id: 'fe3761db-ff07-4315-a7f6-aed6c1305c0e', nombre: 'Test Políticas Planner', tipo: 'evaluacion' },
              { id: '11111111-1111-1111-1111-111111111111', nombre: 'Evidencia Tarea Planner', tipo: 'evidencia' },
              { id: '80e922db-35a1-43e5-8292-6d2c8fbab05e', nombre: 'Nota Final (Herramientas Colaborativas)', tipo: 'evaluacion' }
            ];

            insData?.forEach(ins => {
                const uId = insToUser[ins.id];
                if (uId && ins.metadata) {
                    if (Array.isArray(ins.metadata.completedResources)) {
                        vistasLookup[`${uId}_progreso_colab`] = `${ins.metadata.completedResources.length} / 60`;
                    }
                    if (ins.metadata.evidencias && ins.metadata.evidencias['Creación de tarea en planner']) {
                        vistasLookup[`${uId}_11111111-1111-1111-1111-111111111111`] = ins.metadata.evidencias['Creación de tarea en planner'];
                    }
                }
            });
        }

        if (insData && insData.length > 0 && selectedCurso !== "283c7f14-4c73-47df-a0be-ad8e19ab8c3a") {
            const insIds = insData.map(i => i.id);
            for (let i = 0; i < insIds.length; i += chunkSize) {
              const chunk = insIds.slice(i, i + chunkSize);
              const { data: vistasData, error: vistasError } = await supabase
                .schema("academia")
                .from("lecciones_vistas")
                .select("inscripcion_id, leccion_id")
                .in("inscripcion_id", chunk);
                
              if (vistasError) {
                console.error("Error loading lecciones_vistas:", vistasError);
              }

              vistasData?.forEach(v => {
                  const uId = insToUser[v.inscripcion_id];
                  if (uId) {
                      vistasLookup[`${uId}_${v.leccion_id}`] = true;
                  }
              });
            }
        }

        const allUsers = [...mappedUsers, ...sinRelUsers].sort((a, b) =>
          `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`)
        );

        setUsuarios(allUsers);
        setLecciones(sortedActs);
        setCalificaciones(lookup);
        setMaxScores(lessonMaxScores);
        // Guardamos vistasLookup en el estado
        setVistas(vistasLookup);
      } catch (err) {
        console.error("Exception in fetchMatrix:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchMatrix();
  }, [selectedCurso]);

  // Actualizar una nota al hacer blur o desde el modal
  const handleGradeUpdate = async (usuarioId: string, leccionId: string, value: string, retroalimentacion?: string) => {
    if (!value || isNaN(Number(value))) return;

    const key = `${usuarioId}_${leccionId}`;
    const score = Number(value);
    const existing = calificaciones[key];

    if (existing && existing.puntuacion === score && existing.retroalimentacion === retroalimentacion) return; // Nada cambió

    // Personas sin cuenta relacionada: se guardan en una tabla separada, sin retroalimentación
    if (usuarioId.startsWith("sr_") || existing?.origen === "sin_relacionar") {
      if (existing && existing.id) {
        await supabase.schema("academia").from("calificaciones_sin_relacionar")
          .update({ puntuacion: score, updated_at: new Date().toISOString() })
          .eq("id", existing.id);

        setCalificaciones(prev => ({...prev, [key]: { ...existing, puntuacion: score }}));
      } else {
        const persona = usuarios.find(u => u.usuario_id === usuarioId);
        const { data, error } = await supabase.schema("academia").from("calificaciones_sin_relacionar")
          .insert({
            curso_id: selectedCurso,
            leccion_id: leccionId,
            nombre: persona?.nombres || "",
            apellidos: persona?.apellidos || "",
            cedula: persona?.cedula || null,
            puntuacion: score,
            puntuacion_maxima: 100
          }).select("id").single();

        if (error) {
          console.error("Error inserting grade:", error);
          alert("Hubo un error al guardar la calificación. Por favor intenta de nuevo.");
        }

        if (data) {
          setCalificaciones(prev => ({...prev, [key]: { id: data.id, usuario_id: usuarioId, leccion_id: leccionId, puntuacion: score, puntuacion_maxima: 100, origen: "sin_relacionar" }}));
        }
      }
      return;
    }

    // Guardar en la DB
    if (existing && existing.id) {
       await supabase.schema("academia").from("calificaciones")
         .update({ puntuacion: score, retroalimentacion, updated_at: new Date().toISOString() })
         .eq("id", existing.id);
         
       setCalificaciones(prev => ({...prev, [key]: { ...existing, puntuacion: score, retroalimentacion }}));
    } else {
       const { data, error } = await supabase.schema("academia").from("calificaciones")
         .insert({ 
           curso_id: selectedCurso, 
           usuario_id: usuarioId, 
           leccion_id: leccionId, 
           puntuacion: score, 
           retroalimentacion,
           puntuacion_maxima: 100 
         }).select("id").single();

       if (error) {
         console.error("Error inserting grade:", error);
         alert("Hubo un error al guardar la calificación. Por favor intenta de nuevo.");
       }

       if (data) {
         setCalificaciones(prev => ({...prev, [key]: { id: data.id, usuario_id: usuarioId, leccion_id: leccionId, puntuacion: score, puntuacion_maxima: 100, retroalimentacion }}));
       }
    }
  };

  const filteredUsuarios = usuarios.filter(u => {
    if (!searchTerm) return true;
    const lowerTerm = searchTerm.toLowerCase();
    return u.nombres.toLowerCase().includes(lowerTerm) || 
           u.apellidos.toLowerCase().includes(lowerTerm) || 
           u.cedula.toLowerCase().includes(lowerTerm);
  });

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Reporte del Calificador</h1>
        <p className={styles.subtitle}>
          Visualización global y edición rápida de notas. 
          Haz clic en cualquier celda para ingresar una puntuación (0 a 100).
        </p>
      </header>

      <div className={styles.filters}>
        <select 
          className={styles.select}
          value={selectedCurso} 
          onChange={(e) => setSelectedCurso(e.target.value)}
        >
          {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <input
          type="text"
          placeholder="Buscar estudiante por nombre o cédula..."
          className={styles.searchInput}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className={styles.loading}>Cargando libro de calificaciones...</div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.graderTable}>
            <thead>
              <tr>
                <th className={styles.userCol}>Estudiante</th>
                {lecciones.map(l => (
                  <th key={l.id}>{l.nombre}</th>
                ))}
                <th style={{ background: '#e2e8f0', color: 'var(--primary)' }}>TOTAL CURSO</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsuarios.map(u => {
                // Pre-compute totals: normalize every gradeable lesson to /100 scale
                // This ensures a test scored 4/4 counts the same as 100/100
                let userTotal = 0;
                let userMax = 0;
                lecciones.forEach(l => {
                  const isGradeable = l.tipo === 'evaluacion' || l.tipo === 'evidencia';
                  if (isGradeable) {
                    const c = calificaciones[`${u.usuario_id}_${l.id}`];
                    const rawMax = maxScores[l.id] || 100;
                    // Normalize: always count each lesson as /100
                    userMax += 100;
                    if (c) {
                      const normalizedScore = (Number(c.puntuacion || 0) / rawMax) * 100;
                      userTotal += normalizedScore;
                    }
                  }
                });
                const pct = userMax > 0 ? ((userTotal / userMax) * 100).toFixed(0) : 0;

                return (
                  <tr key={u.usuario_id}>
                    <td className={styles.userCol}>
                      {u.nombres} {u.apellidos}
                      {u.cedula && <div style={{ fontSize: '11px', color: '#64748b' }}>{u.cedula}</div>}
                      {u.origen === "sin_relacionar" && (
                        <div style={{
                          display: 'inline-block', marginTop: 4,
                          padding: '1px 8px', borderRadius: 10, fontSize: '10px', fontWeight: 600,
                          background: '#fef3c7', color: '#92400e'
                        }}>
                          Sin relacionar
                        </div>
                      )}
                    </td>
                    
                    {lecciones.map(l => {
                      const c = calificaciones[`${u.usuario_id}_${l.id}`];

                      return (
                        <td key={l.id}>
                          {l.tipo === 'evaluacion' ? (
                            <input 
                              type="text"
                              placeholder="-"
                              className={styles.gradeInput}
                              defaultValue={c ? c.puntuacion : ""}
                              onBlur={(e) => handleGradeUpdate(u.usuario_id, l.id, e.target.value)}
                            />
                          ) : l.tipo === 'evidencia' ? (
                            <div style={{ textAlign: 'center' }}>
                              {vistas[`${u.usuario_id}_${l.id}`] ? (
                                <button 
                                  onClick={() => {
                                    const fileName = vistas[`${u.usuario_id}_${l.id}`] as string;
                                    const { data } = supabase.storage.from('evidencias').getPublicUrl(fileName);
                                    setModalEvidence({
                                      url: data.publicUrl,
                                      usuarioId: u.usuario_id,
                                      leccionId: l.id,
                                      puntuacion: c ? String(c.puntuacion) : "",
                                      retroalimentacion: c?.retroalimentacion || ""
                                    });
                                  }}
                                  className={styles.btnEvidence}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
                                  Ver entrega
                                  {c && <span className={styles.notaBadge}>{c.puntuacion}/100</span>}
                                </button>
                              ) : (
                                <span style={{ color: '#cbd5e1', fontSize: '12px', fontStyle: 'italic' }}>Sin entrega</span>
                              )}
                            </div>
                          ) : l.tipo === 'progreso' ? (
                            <div style={{ textAlign: 'center', color: '#10b981', fontWeight: '500' }}>
                              {vistas[`${u.usuario_id}_${l.id}`] || "0 / 60"}
                            </div>
                          ) : (
                            <div style={{ textAlign: 'center', color: vistas[`${u.usuario_id}_${l.id}`] ? '#10b981' : '#cbd5e1', fontWeight: vistas[`${u.usuario_id}_${l.id}`] ? '500' : 'normal' }}>
                              {vistas[`${u.usuario_id}_${l.id}`] ? "✓ Visto" : "-"}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    
                    <td style={{ fontWeight: 'bold', background: '#f8fafc', textAlign: 'center' }}>
                       <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                         {pct}%
                       </div>
                       <div style={{ 
                         display: 'inline-block', marginTop: 4,
                         padding: '2px 10px', borderRadius: 20, fontSize: '11px', fontWeight: 600,
                         background: Number(pct) >= 80 ? '#d1fae5' : Number(pct) >= 50 ? '#fef3c7' : '#fee2e2',
                         color: Number(pct) >= 80 ? '#065f46' : Number(pct) >= 50 ? '#92400e' : '#991b1b'
                       }}>
                         {userTotal.toFixed(0)} / {userMax} pts
                       </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredUsuarios.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
              {usuarios.length === 0 ? "No hay estudiantes inscritos/registrados." : "No se encontraron estudiantes que coincidan con la búsqueda."}
            </div>
          )}
        </div>
      )}

      {modalEvidence && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>Calificar Evidencia</h2>
              <button onClick={() => setModalEvidence(null)} className={styles.closeButton}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.evidencePreview}>
                <iframe src={modalEvidence.url} title="Evidencia del estudiante" />
              </div>

              <div className={styles.gradeSection}>
                <div className={styles.inputGroup}>
                  <label>Puntuación</label>
                  <input 
                    type="number" 
                    min="0" max="100" 
                    value={modalEvidence.puntuacion} 
                    onChange={(e) => setModalEvidence({...modalEvidence, puntuacion: e.target.value})}
                    className={styles.numberInput}
                    placeholder="0-100"
                  />
                </div>
                
                <div className={styles.inputGroup}>
                  <label>Retroalimentación</label>
                  <textarea 
                    value={modalEvidence.retroalimentacion}
                    onChange={(e) => setModalEvidence({...modalEvidence, retroalimentacion: e.target.value})}
                    className={styles.textAreaInput}
                    placeholder="Escribe comentarios o sugerencias sobre la entrega..."
                  />
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button 
                onClick={() => setModalEvidence(null)} 
                className={styles.btnCancel}
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  handleGradeUpdate(modalEvidence.usuarioId, modalEvidence.leccionId, modalEvidence.puntuacion, modalEvidence.retroalimentacion);
                  setModalEvidence(null);
                }}
                className={styles.btnSave}
              >
                Guardar Calificación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
