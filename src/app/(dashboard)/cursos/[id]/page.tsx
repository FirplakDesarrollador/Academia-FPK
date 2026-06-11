"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, ChevronDown, ChevronUp, PlayCircle, FileText, Settings, Edit2, Plus, Move, MoreVertical, Eye, CheckCircle } from "lucide-react";
import { useAuth } from "@/components/Providers/AuthProvider";
import styles from "./page.module.css";
import ColaborativasContent from "@/components/Courses/ColaborativasContent";

import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Lesson {
  id: string;
  nombre: string;
  tipo: string;
  duracion_estimada: number;
  orden?: number;
  modulo_id?: string;
}

interface Module {
  id: string;
  nombre: string;
  lecciones: Lesson[];
  orden?: number;
}

interface Course {
  id: string;
  nombre: string;
  descripcion: string;
  imagen_url: string;
  categoria: any;
  modulos: Module[];
}

// Separate component for sortable lesson item
function SortableLesson({ 
  leccion, 
  courseId, 
  isEditing, 
  isCompleted,
  onRename 
}: { 
  leccion: Lesson; 
  courseId: string; 
  isEditing: boolean;
  isCompleted: boolean;
  onRename: (id: string, newName: string) => void;
}) {

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(leccion.nombre);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: leccion.id, disabled: !isEditing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSave = () => {
    if (tempName.trim() && tempName !== leccion.nombre) {
      onRename(leccion.id, tempName);
    }
    setIsEditingName(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setTempName(leccion.nombre);
      setIsEditingName(false);
    }
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`${styles.lessonRow} ${isDragging ? styles.dragging : ""}`}
    >
       <div className={styles.lessonLeftWrapper}>
          {isEditing && (
            <div className={styles.moveHandleSmall} {...attributes} {...listeners}>
              <Move size={16} />
            </div>
          )}
          <Link 
            href={`/cursos/${courseId}/lecciones/${leccion.id}`} 
            className={styles.lessonLink}
            onClick={(e) => isEditing && e.preventDefault()}
          >
            <div className={styles.lessonIconWrapper}>
               {leccion.tipo === 'video' ? (
                  <div className={styles.iconBox} style={{backgroundColor: '#9e7ab0'}}><PlayCircle size={16} color="white" /></div>
               ) : (
                  <div className={styles.iconBox} style={{backgroundColor: '#7ab09e'}}><FileText size={16} color="white" /></div>
               )}
            </div>
            
            {isEditingName ? (
              <input
                autoFocus
                className={styles.inlineInput}
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className={styles.lessonName}>
                 {leccion.nombre}
              </span>
            )}
          </Link>
          
          {isEditing && !isEditingName && (
             <Edit2 
                size={12} 
                className={styles.editIconInlineSmall} 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsEditingName(true);
                }} 
              />
          )}
       </div>
       
       <div className={styles.lessonRight}>
          <div className={styles.lessonActions}>
             {isEditing && (
               <button className={styles.editBtnSmall}>Editar <ChevronDown size={12} /></button>
             )}
          </div>
           <div className={`${styles.completionStatus} ${isCompleted ? styles.completedStatus : ''}`}>
              {isCompleted ? (
                <CheckCircle size={20} color="#4CAF50" />
              ) : (
                <div className={styles.checkPlaceholder} />
              )}
           </div>
       </div>
    </div>
  );
}

export default function CourseDetail() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [inscriptionId, setInscriptionId] = useState<string | null>(null);
  const [inscriptionMetadata, setInscriptionMetadata] = useState<any>({});

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const isAdmin = profile?.rol_id === "1";

  useEffect(() => {
    async function fetchCourseDetails() {
      if (!params?.id) return;
      
      try {
        const { data, error } = await supabase
          .schema("academia")
          .from("cursos")
          .select(`
            id,
            nombre,
            descripcion,
            imagen_url,
            categoria:categoria_id ( nombre ),
            modulos (
              id,
              nombre,
              lecciones (
                id,
                nombre,
                tipo,
                duracion_estimada,
                orden,
                modulo_id
              )
            )
          `)
          .eq("id", params.id)
          .single();

        if (error) throw error;
        
        if (data && data.modulos) {
          data.modulos.forEach((m: any) => {
            if (m.lecciones) {
              m.lecciones.sort((a: any, b: any) => (a.orden || 0) - (b.orden || 0));
            }
          });
          // Sort modules as well
          data.modulos.sort((a: any, b: any) => (a.orden || 0) - (b.orden || 0));
        }

        setCourse(data as Course);
        
        // Fetch completion status
        if (profile?.empleado_id) {
          // 1. Get or Create inscription (using upsert for safety)
          const { data: insData, error: insError } = await supabase
            .schema("academia")
            .from("inscripciones")
            .upsert({
              curso_id: params.id as string,
              empleado_id: profile.empleado_id,
              status: 'en_progreso'
            }, { onConflict: 'curso_id, empleado_id' })
            .select("id, metadata")
            .maybeSingle();

          if (insError) {
            console.error("Error with inscription:", insError);
          }

          if (insData) {
            setInscriptionId(insData.id);
            setInscriptionMetadata(insData.metadata || {});
            
            const newCompleted = new Set<string>();

            // 2. Get views for this inscription (regular lessons)
            const { data: progData } = await supabase
              .schema("academia")
              .from("lecciones_vistas")
              .select("leccion_id")
              .eq("inscripcion_id", insData.id);
            
            if (progData) {
              progData.forEach(p => newCompleted.add(p.leccion_id));
            }

            // 3. Add custom progress from metadata (for Colaborativas course)
            if (insData.metadata && Array.isArray(insData.metadata.completedResources)) {
              insData.metadata.completedResources.forEach((res: string) => newCompleted.add(res));
            }

            setCompletedLessons(newCompleted);
          }
        }
        
        if (data?.modulos && data.modulos.length > 0) {
          setExpandedModules({ [data.modulos[0].id]: true });
        }
      } catch (err) {
        console.error("Error fetching course details:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchCourseDetails();
  }, [params?.id, profile]);

  const handleDragEnd = async (event: DragEndEvent, moduleId: string) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setCourse(prev => {
        if (!prev) return null;
        
        const newModulos = prev.modulos.map(mod => {
          if (mod.id !== moduleId) return mod;
          
          const oldIndex = mod.lecciones.findIndex(l => l.id === active.id);
          const newIndex = mod.lecciones.findIndex(l => l.id === over.id);
          
          const reorderedLecciones = arrayMove(mod.lecciones, oldIndex, newIndex);
          
          // Optional: Update order property
          const updatedLecciones = reorderedLecciones.map((l, i) => ({
            ...l,
            orden: i + 1
          }));

          // Trigger background update to Supabase
          updateLeccionesOrder(updatedLecciones);
          
          return { ...mod, lecciones: updatedLecciones };
        });
        
        return { ...prev, modulos: newModulos };
      });
    }
  };

  const updateLeccionesOrder = async (lecciones: Lesson[]) => {
    try {
      const updates = lecciones.map((l, i) => ({
        id: l.id,
        orden: i + 1
      }));

      // Bulk update using a trick or multiple calls if no RPC
      // For now, let's assume multiple to keep it simple, or better, 
      // in a real app use an RPC for batch updates
      for (const update of updates) {
        await supabase
          .schema("academia")
          .from("lecciones")
          .update({ orden: update.orden })
          .eq("id", update.id);
      }
    } catch (err) {
      console.error("Error updating order in database:", err);
    }
  };

  const handleRenameLeccion = async (leccionId: string, newName: string) => {
    try {
      const { error } = await supabase
        .schema("academia")
        .from("lecciones")
        .update({ nombre: newName })
        .eq("id", leccionId);

      if (error) throw error;

      setCourse(prev => {
        if (!prev) return null;
        return {
          ...prev,
          modulos: prev.modulos.map(m => ({
            ...m,
            lecciones: m.lecciones.map(l => 
              l.id === leccionId ? { ...l, nombre: newName } : l
            )
          }))
        };
      });
    } catch (err) {
      console.error("Error renaming lesson:", err);
    }
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  if (loading) {
    return <div className={styles.loading}>Cargando detalles del curso...</div>;
  }

  if (!course) {
    return (
      <div className={styles.container}>
        <button className={styles.backBtn} onClick={() => router.back()}>
          <ArrowLeft size={16} /> Volver
        </button>
        <div className={styles.loading}>Curso no encontrado</div>
      </div>
    );
  }

  if (course.id === "283c7f14-4c73-47df-a0be-ad8e19ab8c3a") {
    return (
      <div className={`${styles.container} animate-fade-in`}>
        <button className={styles.backBtn} onClick={() => router.push('/cursos')}>
          <ArrowLeft size={16} /> Volver a Mis Cursos
        </button>

        {/* Admin Controls */}
        {isAdmin && (
          <div className={styles.adminControls}>
            <button 
              className={`${styles.editToggleBtn} ${isEditing ? styles.editActive : ""}`}
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? (
                <>Desactivar edición</>
              ) : (
                <>Activar edición</>
              )}
            </button>
          </div>
        )}

        <ColaborativasContent 
          completedLessons={completedLessons} 
          onToggleComplete={async (title, metadata) => {
            const newCompleted = new Set(completedLessons);
            let updatedResources = inscriptionMetadata.completedResources || [];
            let newEvidencias = { ...(inscriptionMetadata.evidencias || {}) };

            if (newCompleted.has(title)) {
              newCompleted.delete(title);
              updatedResources = updatedResources.filter((r: string) => r !== title);
            } else {
              newCompleted.add(title);
              updatedResources = [...updatedResources, title];
              if (metadata?.evidenceFileName) {
                 newEvidencias[title] = metadata.evidenceFileName;
              }
            }
            
            setCompletedLessons(newCompleted);
            
            // Persist to DB
            if (inscriptionId) {
              try {
                const newMetadata = {
                  ...inscriptionMetadata,
                  completedResources: updatedResources,
                  evidencias: newEvidencias
                };
                
                const { error } = await supabase
                  .schema("academia")
                  .from("inscripciones")
                  .update({ metadata: newMetadata })
                  .eq("id", inscriptionId);
                
                if (error) throw error;
                setInscriptionMetadata(newMetadata);
              } catch (err) {
                console.error("Error saving resource progress:", err);
              }
            }
          }}
          isEditing={isEditing} 
        />
      </div>
    );
  }

  return (
    <div className={`${styles.container} animate-fade-in`}>
      <button className={styles.backBtn} onClick={() => router.push('/cursos')}>
        <ArrowLeft size={16} /> Volver a Mis Cursos
      </button>

      {/* Admin Controls */}
      {isAdmin && (
        <div className={styles.adminControls}>
          <button 
            className={`${styles.editToggleBtn} ${isEditing ? styles.editActive : ""}`}
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? (
              <>Desactivar edición</>
            ) : (
              <>Activar edición</>
            )}
          </button>
        </div>
      )}

      {/* Course Banner / General Section */}
      <section className={styles.generalSection}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleMain}>
            <h2>General</h2>
            {isEditing && <Edit2 size={14} className={styles.editIcon} />}
          </div>
          <div className={styles.sectionActions}>
            {isEditing && (
              <button className={styles.editBtn}>Editar <ChevronDown size={14} /></button>
            )}
          </div>
        </div>
        
        <div className={styles.bannerContainer}>
          <div className={styles.banner}>
             <div className={styles.bannerContent}>
                <div className={styles.bannerIllustration}>
                   {/* This would be the image from the reference */}
                   <img src="/banner_induccion.png" alt="Inducción Virtual" className={styles.bannerImg} />
                </div>
             </div>
          </div>
        </div>

        {isEditing && (
          <div className={styles.addActivityContainer}>
             <button className={styles.addActivityBtn}>
                <Plus size={16} /> Añade actividad o recursos
             </button>
          </div>
        )}
      </section>

      {/* Main Content Sections */}
      <section className={styles.contentSections}>
        {course.modulos && course.modulos.length > 0 ? (
          <div className={styles.modulesList}>
            {course.modulos.map((modulo, index) => (
              <div key={modulo.id} className={styles.moduleWrapper}>
                 <div
                   className={styles.moduleHeaderRow}
                   onClick={() => setExpandedModules(prev => ({ ...prev, [modulo.id]: !prev[modulo.id] }))}
                   role="button"
                   tabIndex={0}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter' || e.key === ' ') {
                       e.preventDefault();
                       setExpandedModules(prev => ({ ...prev, [modulo.id]: !prev[modulo.id] }));
                     }
                   }}
                 >
                    <div className={styles.moduleInfo}>
                       {isEditing && <Move size={18} className={styles.moveHandle} />}
                       <h3 className={styles.moduleName}>
                          {modulo.nombre}
                          {isEditing && <Edit2 size={14} className={styles.editIconInline} />}
                       </h3>
                    </div>
                    <div className={styles.moduleActions}>
                       {isEditing && (
                         <button className={styles.editBtn} onClick={e => e.stopPropagation()}>Editar <ChevronDown size={14} /></button>
                       )}
                       {expandedModules[modulo.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                 </div>

                 {expandedModules[modulo.id] && (
                 <div className={styles.lessonsContainer}>
                   <DndContext 
                     sensors={sensors}
                     collisionDetection={closestCenter}
                     onDragEnd={(e) => handleDragEnd(e, modulo.id)}
                   >
                     <SortableContext 
                       items={modulo.lecciones.map(l => l.id)}
                       strategy={verticalListSortingStrategy}
                     >
                       {modulo.lecciones.map((leccion) => (
                         <SortableLesson 
                           key={leccion.id} 
                           leccion={leccion} 
                           courseId={course.id} 
                           isEditing={isEditing}
                           isCompleted={completedLessons.has(leccion.id)}
                           onRename={handleRenameLeccion}
                         />
                       ))}
                     </SortableContext>
                   </DndContext>
                 </div>
                 )}

                {isEditing && (
                  <div className={styles.addActivityContainerModule}>
                     <button className={styles.addActivityBtn}>
                        <Plus size={16} /> Añade actividad o recursos
                     </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>
            Aún no hay contenido disponible para este curso.
          </p>
        )}

        {isEditing && (
          <div className={styles.addSectionContainer}>
             <button className={styles.addSectionBtn}>
                <Plus size={16} /> Añadir secciones
             </button>
          </div>
        )}
      </section>
    </div>
  );
}
