"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Providers/AuthProvider";
import { Search, LayoutGrid, List, BookOpen, Clock, CheckCircle } from "lucide-react";
import CourseCard from "@/components/Dashboard/CourseCard";
import styles from "./page.module.css";

interface Course {
  id: string;
  nombre: string;
  descripcion: string;
  imagen_url: string;
  activo: boolean;
  categoria: string;
  total_modulos: number;
  total_lecciones: number;
}

const FILTERS = ["Todos", "En Curso", "Completados", "Sin Iniciar"];

export default function MisCursosPage() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [categorias, setCategorias] = useState<string[]>([]);
  const [activeCategoria, setActiveCategoria] = useState("Todas");
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});

  useEffect(() => {
    async function fetchAll() {
      if (!profile?.empleado_id) return;
      setLoading(true);
      try {
        // 1. Inscripciones del empleado
        const { data: inscripciones, error: insError } = await supabase
          .schema("academia")
          .from("inscripciones")
          .select("id, curso_id, metadata")
          .eq("empleado_id", profile.empleado_id);

        if (insError) throw insError;
        if (!inscripciones || inscripciones.length === 0) {
          setCourses([]);
          setProgressMap({});
          return;
        }

        const cursoIds = inscripciones.map((i: any) => i.curso_id);
        const insIds = inscripciones.map((i: any) => i.id);

        // 2. Detalles de los cursos asignados (en paralelo con el resto)
        const [cursosRes, vistasRes, modulosRes] = await Promise.all([
          supabase
            .schema("academia")
            .from("cursos")
            .select("id, nombre, descripcion, imagen_url, activo, categoria:categoria_id(nombre)")
            .in("id", cursoIds)
            .eq("activo", true),
          supabase
            .schema("academia")
            .from("lecciones_vistas")
            .select("inscripcion_id, leccion_id")
            .in("inscripcion_id", insIds),
          supabase
            .schema("academia")
            .from("modulos")
            .select("id, curso_id")
            .in("curso_id", cursoIds),
        ]);

        // 3. Mapear cursos
        const courseList = (cursosRes.data || []).map((c: any) => ({
          id: c.id,
          nombre: c.nombre,
          descripcion: c.descripcion,
          imagen_url: c.imagen_url,
          activo: c.activo,
          categoria: c.categoria?.nombre || "General",
          total_modulos: 0,
          total_lecciones: 0,
        }));

        setCourses(courseList);
        setCategorias([...new Set(courseList.map((c) => c.categoria))]);

        // 4. Calcular progreso
        const modulosData = modulosRes.data || [];
        const moduloIds = modulosData.map((m: any) => m.id);
        const moduloCursoMap: Record<string, string> = {};
        modulosData.forEach((m: any) => { moduloCursoMap[m.id] = m.curso_id; });

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
        (vistasRes.data || []).forEach((v: any) => {
          vistasPorIns[v.inscripcion_id] = (vistasPorIns[v.inscripcion_id] || 0) + 1;
        });

        const newMap: Record<string, number> = {};
        inscripciones.forEach((ins: any) => {
          let total = totalPorCurso[ins.curso_id] || 0;
          let visto = vistasPorIns[ins.id] || 0;
          
          // Soporte para cursos como "Herramientas Colaborativas" que guardan progreso en metadata
          const c = courseList.find((c: any) => c.id === ins.curso_id);
          if (c && c.nombre.toLowerCase().includes("colaborativas")) {
             // 60 recursos interactivos + 1 test de planner + 1 evidencia
             total = 62; 
             const recursosVistos = ins.metadata?.completedResources ? ins.metadata.completedResources.length : 0;
             const tieneEvidencia = ins.metadata?.evidencias?.['Creación de tarea en planner'] ? 1 : 0;
             visto = recursosVistos + visto + tieneEvidencia;
          }

          let pct = total > 0 ? Math.round((visto / total) * 100) : 0;
          if (pct > 100) pct = 100; // Cap at 100 to prevent overflow visually
          newMap[ins.curso_id] = pct;
        });

        setProgressMap(newMap);
      } catch (err) {
        console.error("Error cargando cursos:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [profile]);



  // Computed filtered list (no useEffect needed - derived data)
  const filtered = useMemo(() => {
    let result = courses;

    if (activeCategoria !== "Todas") {
      result = result.filter((c) => c.categoria === activeCategoria);
    }
    if (search.trim()) {
      result = result.filter((c) =>
        c.nombre.toLowerCase().includes(search.toLowerCase()) ||
        c.descripcion?.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (activeFilter === "En Curso") {
      result = result.filter((c) => { const p = progressMap[c.id] ?? 0; return p > 0 && p < 100; });
    } else if (activeFilter === "Completados") {
      result = result.filter((c) => (progressMap[c.id] ?? 0) === 100);
    } else if (activeFilter === "Sin Iniciar") {
      result = result.filter((c) => (progressMap[c.id] ?? 0) === 0);
    }

    return result;
  }, [search, activeCategoria, activeFilter, courses, progressMap]);


  const getProgress = (courseId: string) => progressMap[courseId] ?? 0;

  const totalCursos = courses.length;
  const enCurso = courses.filter((c) => { const p = getProgress(c.id); return p > 0 && p < 100; }).length;
  const completados = courses.filter((c) => getProgress(c.id) === 100).length;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Mis Cursos</h1>
          <p className={styles.subtitle}>Gestiona y continúa tu formación profesional</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className={styles.statsBar}>
        <div className={styles.statItem}>
          <BookOpen size={18} color="var(--primary)" />
          <span><strong>{totalCursos}</strong> cursos asignados</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <Clock size={18} color="#f59e0b" />
          <span><strong>{enCurso}</strong> en progreso</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <CheckCircle size={18} color="#22c55e" />
          <span><strong>{completados}</strong> completados</span>
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        {/* Search */}
        <div className={styles.searchBox}>
          <Search size={16} opacity={0.5} />
          <input
            type="text"
            placeholder="Buscar curso..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Category pills */}
        <div className={styles.pills}>
          <button
            className={`${styles.pill} ${activeCategoria === "Todas" ? styles.pillActive : ""}`}
            onClick={() => setActiveCategoria("Todas")}
          >
            Todas
          </button>
          {categorias.map((cat) => (
            <button
              key={cat}
              className={`${styles.pill} ${activeCategoria === cat ? styles.pillActive : ""}`}
              onClick={() => setActiveCategoria(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className={styles.filterTabs}>
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`${styles.filterTab} ${activeFilter === f ? styles.filterTabActive : ""}`}
              onClick={() => setActiveFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewBtn} ${viewMode === "grid" ? styles.viewBtnActive : ""}`}
            onClick={() => setViewMode("grid")}
            title="Vista tarjetas"
          >
            <LayoutGrid size={18} />
          </button>
          <button
            className={`${styles.viewBtn} ${viewMode === "list" ? styles.viewBtnActive : ""}`}
            onClick={() => setViewMode("list")}
            title="Vista lista"
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {/* Course grid / list */}
      {loading ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Cargando tus cursos...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <BookOpen size={48} opacity={0.3} />
          <p>No se encontraron cursos con ese criterio.</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className={styles.grid}>
          {filtered.map((course) => (
            <CourseCard
              key={course.id}
              id={course.id}
              title={course.nombre}
              image={course.imagen_url}
              category={course.categoria}
              progress={getProgress(course.id)}
            />
          ))}
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map((course) => {
            const progress = getProgress(course.id);
            return (
              <a key={course.id} href={`/cursos/${course.id}`} className={styles.listItem}>
                <div
                  className={styles.listThumb}
                  style={{ backgroundImage: `url(${course.imagen_url})` }}
                />
                <div className={styles.listInfo}>
                  <span className={styles.listCategory}>{course.categoria}</span>
                  <h3 className={styles.listTitle}>{course.nombre}</h3>
                  <p className={styles.listDesc}>{course.descripcion}</p>
                </div>
                <div className={styles.listProgress}>
                  <div className={styles.listProgressBar}>
                    <div className={styles.listProgressFill} style={{ width: `${progress}%` }} />
                  </div>
                  <span className={styles.listProgressText}>{progress}%</span>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
