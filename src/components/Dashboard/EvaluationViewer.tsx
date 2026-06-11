"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import styles from "./EvaluationViewer.module.css";
import { CheckCircle, XCircle } from "lucide-react";

interface Question {
  id: number;
  texto: string;
  opciones: string[];
  respuesta_correcta: string;
}

interface EvaluationData {
  instrucciones: string;
  preguntas: Question[];
}

interface EvaluationViewerProps {
  data: string; // JSON string
  onComplete: () => void;
  completed: boolean;
}

export default function EvaluationViewer({ data, onComplete, completed }: EvaluationViewerProps) {
  const [evalData, setEvalData] = useState<any>(null);
  const params = useParams();

  React.useEffect(() => {
    try {
      if (data) setEvalData(JSON.parse(data));
    } catch (e) {
      console.error("Error parsing evaluation data", e);
    }
  }, [data]);

  if (!evalData) return <div className={styles.loading}>Cargando evaluación...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>{evalData.titulo || "Evaluación"}</h3>
        <p className={styles.instructions}>
          Esta lección contiene una evaluación que debes aprobar para continuar.
        </p>
      </div>
      
      <div className={styles.launchArea}>
        <CheckCircle size={48} className={completed ? styles.successIcon : styles.pendingIcon} />
        <h4 className={styles.statusTitle}>
          Estado: {completed ? "Completado" : "Pendiente"}
        </h4>
        <p className={styles.statusDesc}>
          {completed 
            ? "Ya has aprobado esta evaluación. Puedes revisarla nuevamente si lo deseas." 
            : "Haz clic en el botón inferior para abrir la evaluación en una nueva pestaña."}
        </p>
        
        <Link 
          href={`/cursos/${params.id}/evaluacion/${params.leccionId}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className={styles.submitBtn}
        >
          {completed ? "Revisar Evaluación" : "Comenzar Evaluación"}
        </Link>
      </div>
    </div>
  );
}
