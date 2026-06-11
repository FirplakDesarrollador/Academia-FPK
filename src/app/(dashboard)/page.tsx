"use client";

import { 
  BookOpen, 
  CheckCircle, 
  Award, 
  TrendingUp,
  Filter,
  ChevronDown,
  LayoutGrid
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Providers/AuthProvider";
import CourseCard from "@/components/Dashboard/CourseCard";
import styles from "./page.module.css";

interface Course {
  id: string;
  nombre: string;
  imagen_url: string;
  categoria: any;
  progreso?: number;
}




export default function Dashboard() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [realStats, setRealStats] = useState({ enCurso: 0, completados: 0, certificados: 0 });

  useEffect(() => {
    async function fetchCourses() {
      if (!profile?.empleado_id) return;
      try {
        // 1. Cursos activos
        const { data: cursosData, error } = await supabase
          .schema("academia")
          .from("cursos")
          .select(`id, nombre, imagen_url, categoria:categoria_id ( nombre )`)
          .eq("activo", true);

        if (error) throw error;
        const allCursos = cursosData || [];

        // 2. Inscripciones del usuario
        const { data: inscripciones } = await supabase
          .schema("academia")
          .from("inscripciones")
          .select("id, curso_id, metadata")
          .eq("empleado_id", profile.empleado_id);

        if (!inscripciones || inscripciones.length === 0) {
          setCourses(allCursos.map(c => ({ ...c, progreso: 0 })));
          setLoading(false);
          return;
        }

        const insIds = inscripciones.map(i => i.id);
        const cursoIds = allCursos.map(c => c.id);

        // 3. Lecciones vistas
        const { data: vistas } = await supabase
          .schema("academia")
          .from("lecciones_vistas")
          .select("inscripcion_id, leccion_id")
          .in("inscripcion_id", insIds);

        // 4. Total lecciones por curso (via modulos)
        const { data: modulosData } = await supabase
          .schema("academia")
          .from("modulos")
          .select("id, curso_id")
          .in("curso_id", cursoIds);

        const moduloIds = (modulosData || []).map(m => m.id);
        const moduloCursoMap: Record<string, string> = {};
        (modulosData || []).forEach(m => { moduloCursoMap[m.id] = m.curso_id; });

        const { data: leccionesData } = await supabase
          .schema("academia")
          .from("lecciones")
          .select("id, modulo_id")
          .in("modulo_id", moduloIds);

        const totalPorCurso: Record<string, number> = {};
        (leccionesData || []).forEach((l: any) => {
          const cid = moduloCursoMap[l.modulo_id];
          if (cid) totalPorCurso[cid] = (totalPorCurso[cid] || 0) + 1;
        });

        const vistasPorIns: Record<string, number> = {};
        (vistas || []).forEach(v => {
          vistasPorIns[v.inscripcion_id] = (vistasPorIns[v.inscripcion_id] || 0) + 1;
        });

        // 5. Calcular progreso por curso
        const progressMap: Record<string, number> = {};
        inscripciones.forEach(ins => {
          let total = totalPorCurso[ins.curso_id] || 0;
          let visto = vistasPorIns[ins.id] || 0;

          const c = allCursos.find(c => c.id === ins.curso_id);
          if (c && c.nombre.toLowerCase().includes("colaborativas")) {
             // 60 recursos interactivos + 1 test de planner + 1 evidencia
             total = 62; 
             const recursosVistos = ins.metadata?.completedResources ? ins.metadata.completedResources.length : 0;
             const tieneEvidencia = ins.metadata?.evidencias?.['Creación de tarea en planner'] ? 1 : 0;
             visto = recursosVistos + visto + tieneEvidencia;
          }

          let pct = total > 0 ? Math.round((visto / total) * 100) : 0;
          if (pct > 100) pct = 100;
          progressMap[ins.curso_id] = pct;
        });

        const cursosConProgreso = allCursos.map(c => ({
          ...c,
          progreso: progressMap[c.id] ?? 0
        }));

        // 6. Stats reales
        const enCurso = cursosConProgreso.filter(c => (c.progreso ?? 0) > 0 && (c.progreso ?? 0) < 100).length;
        const completados = cursosConProgreso.filter(c => (c.progreso ?? 0) === 100).length;
        setRealStats({ enCurso, completados, certificados: completados });

        setCourses(cursosConProgreso);
      } catch (err) {
        console.error("Error fetching courses:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchCourses();
  }, [profile]);

  const firstName = profile?.nombres?.split(" ")[0] || "";

  return (
    <div className={`${styles.dashboard} animate-fade-in`}>
      <section className={styles.welcome}>
        <div className={styles.welcomeContent}>
          <h1>¡Bienvenido de nuevo{firstName ? `, ${firstName}` : ""}!</h1>
          <p>
            Continúa con tus cursos de formación y potencia tus habilidades profesionales.
          </p>
        </div>
      </section>

      <section className={styles.statsGrid}>
        {[
          { label: "Cursos en curso", value: String(realStats.enCurso), icon: BookOpen, bg: "rgba(37, 65, 83, 0.1)", color: "#254153" },
          { label: "Cursos completados", value: String(realStats.completados), icon: CheckCircle, bg: "rgba(34, 197, 94, 0.1)", color: "#22c55e" },
          { label: "Certificados", value: String(realStats.certificados), icon: Award, bg: "rgba(234, 179, 8, 0.1)", color: "#eab308" },
          { label: "Puntos de nivel", value: "450", icon: TrendingUp, bg: "rgba(56, 189, 248, 0.1)", color: "#38bdf8" },
        ].map((stat, i) => (
          <div key={i} className={styles.statCard}>
            <div className={styles.statIcon} style={{ backgroundColor: stat.bg }}>
              <stat.icon size={24} color={stat.color} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{stat.value}</span>
              <span className={styles.statLabel}>{stat.label}</span>
            </div>
          </div>
        ))}
      </section>

      <section>
        <div className={styles.sectionHeader}>
          <h2>Vista general de curso</h2>
          
          <div className={styles.controlsRow}>
            <div className={styles.leftControls}>
              <div className={styles.dropdown}>
                <Filter size={16} />
                <span>Todos (a excepción de los eliminados de la vista)</span>
                <ChevronDown size={14} />
              </div>
            </div>

            <div className={styles.rightControls}>
              <div className={styles.dropdown}>
                <span>Nombre del curso</span>
                <ChevronDown size={14} />
              </div>
              <div className={styles.dropdown}>
                <LayoutGrid size={16} style={{ marginRight: '4px' }} />
                <span>Tarjeta</span>
                <ChevronDown size={14} />
              </div>
            </div>
          </div>
        </div>

        <div className={styles.coursesGrid}>
          {loading ? (
            <div className={styles.loading}>Cargando cursos...</div>
          ) : courses.length > 0 ? (
            courses.map((course) => (
              <CourseCard 
                key={course.id} 
                id={course.id}
                title={course.nombre}
                image={course.imagen_url}
                category={course.categoria?.nombre || "Sin categoría"}
                progress={course.progreso || 0}
              />
            ))
          ) : (
            <div className={styles.noCourses}>No se encontraron cursos disponibles.</div>
          )}
        </div>
      </section>
    </div>
  );
}
