"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Award, FileText, PlayCircle, BarChart } from "lucide-react";
import styles from "./page.module.css";

interface Calificacion {
  id: string;
  puntuacion: number;
  puntuacion_maxima: number;
  retroalimentacion: string;
  estado: string;
  fecha: string;
  curso: { id: string; nombre: string };
  leccion: { id: string; nombre: string; tipo: string };
}

interface ReporteCurso {
  cursoId: string;
  cursoNombre: string;
  actividades: Calificacion[];
  total: number;
  maxTotal: number;
}

export default function MisCalificaciones() {
  const [reporte, setReporte] = useState<ReporteCurso[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGrades() {
      // 1. Obtener la sesion
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setLoading(false);
        return;
      }

      // 2. Extraer calificaciones
      const { data, error } = await supabase
        .schema("academia")
        .from("calificaciones")
        .select(`
          id, puntuacion, puntuacion_maxima, retroalimentacion, estado, updated_at,
          curso:cursos(id, nombre),
          leccion:lecciones(id, nombre, tipo)
        `)
        .eq("usuario_id", session.user.id)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Error al cargar calificaciones:", error);
        setLoading(false);
        return;
      }

      // Agrupar por curso (al estilo "Gradebook" de Moodle)
      const agrupado = (data as any[]).reduce((acc: Record<string, ReporteCurso>, item) => {
        const cId = item.curso.id;
        if (!acc[cId]) {
          acc[cId] = {
            cursoId: cId,
            cursoNombre: item.curso.nombre,
            actividades: [],
            total: 0,
            maxTotal: 0
          };
        }
        acc[cId].actividades.push(item);
        acc[cId].total += Number(item.puntuacion || 0);
        acc[cId].maxTotal += Number(item.puntuacion_maxima || 100);
        return acc;
      }, {});

      setReporte(Object.values(agrupado));
      setLoading(false);
    }

    loadGrades();
  }, []);

  const getGradeClass = (grade: number, max: number) => {
    const ratio = grade / max;
    if (ratio >= 0.8) return styles.gradeHigh;
    if (ratio >= 0.6) return styles.gradeMedium;
    return styles.gradeLow;
  };

  if (loading) return <div className={styles.emptyState}>Cargando reporte de calificaciones...</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Reporte de Calificaciones</h1>
        <p className={styles.subtitle}>Resumen de evaluación de tus actividades formativas (Modelo de Calificador)</p>
      </header>

      {reporte.length === 0 ? (
        <div className={styles.emptyState}>
          <Award size={48} opacity={0.5} />
          <p>Aún no tienes calificaciones registradas en la plataforma.</p>
        </div>
      ) : (
        reporte.map(curso => {
          const coursePercentage = curso.maxTotal > 0 ? ((curso.total / curso.maxTotal) * 100).toFixed(1) : 0;
          
          return (
            <div key={curso.cursoId} className={styles.courseCard}>
              <div className={styles.courseHeader}>
                <h2 className={styles.courseTitle}>{curso.cursoNombre}</h2>
                <div className={styles.courseTotal}>
                  Total del Curso: {curso.total} / {curso.maxTotal} ({coursePercentage}%)
                </div>
              </div>
              <table className={styles.gradeTable}>
                <thead>
                  <tr>
                    <th>Ítem de calificación</th>
                    <th>Calificación</th>
                    <th>Rango</th>
                    <th>Porcentaje</th>
                    <th>Retroalimentación</th>
                  </tr>
                </thead>
                <tbody>
                  {curso.actividades.map(act => (
                    <tr key={act.id}>
                      <td>
                        <div className={styles.itemInfo}>
                          <div className={styles.itemIcon}>
                            {act.leccion?.tipo === 'video' ? <PlayCircle size={16} /> : 
                             act.leccion?.tipo === 'prueba' ? <BarChart size={16} /> : 
                             <FileText size={16} />}
                          </div>
                          <span>{act.leccion?.nombre || 'General del Curso'}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.gradeValue} ${getGradeClass(act.puntuacion, act.puntuacion_maxima)}`}>
                          {act.puntuacion}
                        </span>
                      </td>
                      <td>0 - {act.puntuacion_maxima}</td>
                      <td>{((act.puntuacion / act.puntuacion_maxima) * 100).toFixed(0)} %</td>
                      <td className={styles.feedback}>{act.retroalimentacion || "-"}</td>
                    </tr>
                  ))}
                  {/* Fila de Total (Footer simulado de Moodle) */}
                  <tr style={{ background: '#f8fafc', fontWeight: 600 }}>
                    <td>Total acumulado del curso</td>
                    <td className={`${styles.gradeValue} ${getGradeClass(curso.total, curso.maxTotal)}`}>
                      {curso.total}
                    </td>
                    <td>0 - {curso.maxTotal}</td>
                    <td>{coursePercentage} %</td>
                    <td>-</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )
        })
      )}
    </div>
  );
}
