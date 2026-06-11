"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, PlayCircle, FileText, CheckCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/components/Providers/AuthProvider";
import EvaluationViewer from "@/components/Dashboard/EvaluationViewer";
import styles from "./page.module.css";

interface Lesson {
  id: string;
  nombre: string;
  tipo: string;
  duracion_estimada: number;
  orden: number;
  contenido?: string;
}

interface Module {
  id: string;
  nombre: string;
  lecciones: Lesson[];
  orden: number;
}

interface Course {
  id: string;
  nombre: string;
  imagen_url?: string;
  modulos: Module[];
}

export default function LessonViewer({ params: paramsPromise }: { params: Promise<{ id: string; leccionId: string }> }) {
  const params = React.use(paramsPromise);
  const { profile } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [inscriptionId, setInscriptionId] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set());


  useEffect(() => {
    async function fetchLessonData() {
      if (!params?.id || !params?.leccionId) return;

      try {
        setCompleted(false); // Reset completion status at start
        const { data, error } = await supabase
          .schema("academia")
          .from("cursos")
          .select(`
            id,
            nombre,
            modulos (
              id,
              nombre,
              orden,
              lecciones (
                id,
                nombre,
                tipo,
                duracion_estimada,
                orden,
                contenido
              )
            )
          `)
          .eq("id", params.id)
          .single();

        if (error) throw error;

        // Sort data
        if (data && data.modulos) {
          data.modulos.forEach((m: Module) => {
            if (m.lecciones) {
              m.lecciones.sort((a: Lesson, b: Lesson) => (a.orden || 0) - (b.orden || 0));
            }
          });
          data.modulos.sort((a: Module, b: Module) => (a.orden || 0) - (b.orden || 0));
        }

        // Get current user and inscription
        if (profile?.empleado_id) {
            // Get or create inscription using upsert for atomic safety
            const { data: insData, error: insError } = await supabase
              .schema("academia")
              .from("inscripciones")
              .upsert({
                curso_id: params.id as string,
                empleado_id: profile.empleado_id,
                status: 'en_progreso'
              }, { onConflict: 'curso_id, empleado_id' })
              .select("id")
              .maybeSingle();

            if (insError) {
              console.error("Error with inscription:", JSON.stringify(insError));
            }

            if (insData) {
              setInscriptionId(insData.id);
              // Check if already completed
              const { data: viewData } = await supabase
                .schema("academia")
                .from("lecciones_vistas")
                .select("id")
                .eq("inscripcion_id", insData.id)
                .eq("leccion_id", params.leccionId)
                .maybeSingle();
              
              if (viewData) setCompleted(true);

              // Fetch ALL completed lessons for sidebar
              const { data: allViews } = await supabase
                .schema("academia")
                .from("lecciones_vistas")
                .select("leccion_id")
                .eq("inscripcion_id", insData.id);
              
              if (allViews) {
                setCompletedLessonIds(new Set(allViews.map(v => v.leccion_id)));
              }
            }
        }

        setCourse(data as Course);

        // Find current lesson and expand its parent module
        let activeLesson = null;
        const expanded: Record<string, boolean> = {};

        data.modulos.forEach((m: Module) => {
          const found = m.lecciones?.find(l => l.id === params.leccionId);
          if (found) {
            activeLesson = found;
            expanded[m.id] = true; // Auto-expand the module containing the active lesson
          }
        });

        setCurrentLesson(activeLesson);
        setExpandedModules(expanded);

        // insData is handled inside the profile block now

      } catch (err) {
        console.error("Error fetching lesson:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchLessonData();
  }, [params?.id, params?.leccionId, profile]);

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  const handleComplete = async () => {
    try {
      let currentInsId = inscriptionId;

      // Fallback: If for some reason inscriptionId wasn't set, try to find it again
      if (!currentInsId) {
        console.log("Fallback identification started...");
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Sesión no encontrada.");
        
        let empId = profile?.empleado_id;

        if (!empId) {
          const { data: fb } = await supabase.schema("academia").from("usuarios").select("empleado_id").eq("id", user.id).maybeSingle();
          if (fb?.empleado_id) empId = fb.empleado_id;
        }

        if (!empId) {
          throw new Error("Tu cuenta no está vinculada a un perfil de empleado.");
        }

        const { data: insData, error: insError } = await supabase
          .schema("academia")
          .from("inscripciones")
          .upsert({
            curso_id: params.id,
            empleado_id: empId,
            status: 'en_progreso'
          }, { onConflict: 'curso_id, empleado_id' })
          .select("id")
          .maybeSingle();

        if (insError) throw insError;

        if (insData) {
          currentInsId = insData.id;
          setInscriptionId(insData.id);
        }
      }

      if (!currentInsId) {
        throw new Error("No se pudo obtener el ID de inscripción.");
      }
      
      if (!params?.leccionId) {
        throw new Error("ID de lección no encontrado en la URL.");
      }

      const { error } = await supabase
        .schema("academia")
        .from("lecciones_vistas")
        .upsert({
          inscripcion_id: currentInsId,
          leccion_id: params.leccionId as string,
          completada_at: new Date().toISOString()
        }, { onConflict: 'inscripcion_id, leccion_id' });

      if (error) throw error;
      setCompleted(true);
      setCompletedLessonIds(prev => new Set([...Array.from(prev), params.leccionId as string]));
    } catch (err: any) {
      console.error("Error saving progress:", JSON.stringify(err));
      alert("Error al guardar el progreso: " + (err.message || "Inténtalo de nuevo."));
    }
  };

  if (loading) {
    return <div className={styles.loading}>Cargando lección...</div>;
  }

  if (!course || !currentLesson) {
    return (
      <div className={styles.loading}>
        <p>Lección no encontrada.</p>
        <Link href={`/cursos/${params?.id}`} className={styles.backBtn}>
          <ArrowLeft size={16} /> Volver al curso
        </Link>
      </div>
    );
  }

  return (
    <div className={`${styles.layout} animate-fade-in`}>
      {/* Video / Content Main Area */}
      <div className={styles.mainContent}>
        {currentLesson.tipo === 'evaluacion' ? (
          <div className={styles.evalSection}>
            <EvaluationViewer 
              data={currentLesson.contenido || ""} 
              onComplete={handleComplete} 
              completed={completed} 
            />
          </div>
        ) : (
          <div className={styles.videoSection}>
            {currentLesson.tipo === 'video' ? (
              currentLesson.contenido ? (
                <video 
                  key={currentLesson.id}
                  controls 
                  className={styles.videoPlayer}
                  poster={course?.imagen_url || ""}
                  onEnded={() => setVideoEnded(true)}
                >
                  <source src={currentLesson.contenido} type="video/mp4" />
                  Tu navegador no soporta el elemento de video.
                </video>
              ) : (
                <div className={styles.videoPlaceholder}>
                  <PlayCircle size={64} opacity={0.8} />
                  <p>El reproductor de vídeo aparecerá aquí</p>
                </div>
              )
            ) : currentLesson.contenido ? (
              currentLesson.contenido.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <div className={styles.imageContainer}>
                  <img src={currentLesson.contenido} alt={currentLesson.nombre} className={styles.contentImage} />
                </div>
              ) : currentLesson.contenido.endsWith('.pdf') ? (
                <iframe src={currentLesson.contenido} className={styles.pdfViewer} title={currentLesson.nombre} />
              ) : (
                <div className={styles.documentContent}>
                   {currentLesson.contenido}
                </div>
              )
            ) : (
              <div className={styles.videoPlaceholder}>
                <FileText size={64} opacity={0.8} />
                <p>El visor de documentos se mostrará aquí</p>
              </div>
            )}
          </div>
        )}
        
        <div className={styles.videoInfo}>
          <h1 className={styles.videoTitle}>{currentLesson.nombre}</h1>
          <div className={styles.videoMeta}>
            {currentLesson.duracion_estimada && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} /> {currentLesson.duracion_estimada} min
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'capitalize' }}>
              {currentLesson.tipo === 'video' ? <PlayCircle size={16} /> : <FileText size={16} />} 
              {currentLesson.tipo}
            </span>
          </div>

          {(currentLesson.tipo !== 'video' && currentLesson.tipo !== 'evaluacion' || videoEnded || completed) && (
            <button 
              className={`${styles.completeBtn} ${completed ? styles.completed : ''}`}
              onClick={handleComplete}
              disabled={completed}
            >
              <CheckCircle size={18} />
              {completed ? 'Completado' : 'Marcar como completado'}
            </button>
          )}
        </div>
      </div>

      {/* Sidebar Navigation */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Link href={`/cursos/${course.id}`} className={styles.backBtn}>
            <ArrowLeft size={16} /> Volver al detalle
          </Link>
          <h2 className={styles.courseTitle}>{course.nombre}</h2>
        </div>

        <div className={styles.modulesList}>
          {course.modulos.map((modulo, index) => (
            <div key={modulo.id} className={styles.module}>
              <button 
                className={styles.moduleHeader}
                onClick={() => toggleModule(modulo.id)}
              >
                <span>Módulo {index + 1}: {modulo.nombre}</span>
                {expandedModules[modulo.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              
              {expandedModules[modulo.id] && modulo.lecciones && (
                <div className={styles.lessonsList}>
                  {modulo.lecciones.map((leccion) => {
                    const isActive = currentLesson.id === leccion.id;
                    return (
                      <Link 
                        href={`/cursos/${course.id}/lecciones/${leccion.id}`} 
                        key={leccion.id}
                        className={styles.lessonLink}
                      >
                        <div className={`${styles.lesson} ${isActive ? styles.active : ''}`}>
                          <div className={styles.lessonIcon}>
                            {completedLessonIds.has(leccion.id) ? (
                              <CheckCircle size={16} className={styles.checkIcon} />
                            ) : (
                              leccion.tipo === 'video' ? <PlayCircle size={16} /> : <FileText size={16} />
                            )}
                          </div>
                          <span className={styles.lessonName}>
                            {leccion.nombre}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
