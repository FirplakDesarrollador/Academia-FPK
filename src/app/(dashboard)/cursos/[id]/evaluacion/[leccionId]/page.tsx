"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Providers/AuthProvider";
import { ArrowLeft, CheckCircle, AlertTriangle } from "lucide-react";
import styles from "./page.module.css";
import Link from "next/link";

interface Question {
  id: number;
  tipo: string;
  texto: string;
  opciones?: string[];
  opciones_globales?: string[];
  subpreguntas?: {texto: string, respuesta_correcta: string}[];
  respuesta_correcta?: string;
}

export default function FullQuizPage({ params: paramsPromise }: { params: Promise<{ id: string; leccionId: string }> }) {
  const params = React.use(paramsPromise);
  const router = useRouter();
  const { profile } = useAuth();
  
  const getOpcionTexto = (op: any): string => {
    if (typeof op === "string") return op;
    return op?.texto || "";
  };
  
  const [evalData, setEvalData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [inscriptionId, setInscriptionId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .schema("academia")
          .from("lecciones")
          .select("contenido")
          .eq("id", params.leccionId)
          .single();

        if (error) throw error;
        if (data?.contenido) {
          setEvalData(JSON.parse(data.contenido));
        }

        if (profile?.empleado_id) {
          const { data: insData } = await supabase
            .schema("academia")
            .from("inscripciones")
            .select("id")
            .eq("curso_id", params.id)
            .eq("empleado_id", profile.empleado_id)
            .maybeSingle();

          if (insData) {
            setInscriptionId(insData.id);
            // check if already completed
            const { data: viewData } = await supabase
              .schema("academia")
              .from("lecciones_vistas")
              .select("id")
              .eq("inscripcion_id", insData.id)
              .eq("leccion_id", params.leccionId)
              .maybeSingle();
            
            if (viewData) {
              setSubmitted(true);
              // Fetch previous score and answers
              const { data: scoreData } = await supabase
                .schema("academia")
                .from("calificaciones")
                .select("puntuacion, respuestas")
                .eq("leccion_id", params.leccionId)
                .eq("usuario_id", profile.id)
                .maybeSingle();
              
              if (scoreData) {
                setScore(Number(scoreData.puntuacion));
                if (scoreData.respuestas) {
                  setAnswers(scoreData.respuestas);
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("Error", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id, params.leccionId, profile]);

  const handleSelectAnswer = (qId: number, subIndex: number | null, value: string | string[]) => {
    if (submitted) return;
    setAnswers(prev => {
      const copy = { ...prev };
      if (subIndex !== null) {
        if (!copy[qId]) copy[qId] = {};
        copy[qId][subIndex] = value;
      } else {
        copy[qId] = value;
      }
      return copy;
    });
  };

  const calculateScore = () => {
    let totalScore = 0;
    evalData.preguntas.forEach((q: Question) => {
      if (q.tipo === 'emparejamiento') {
        let correctSub = 0;
        const subCount = q.subpreguntas?.length || 1;
        q.subpreguntas?.forEach((sub, i) => {
          if (answers[q.id]?.[i] === sub.respuesta_correcta) correctSub++;
        });
        totalScore += (correctSub / subCount);
      } else {
        if (Array.isArray(q.respuesta_correcta)) {
          const userAns = Array.isArray(answers[q.id]) ? answers[q.id] : [];
          let correctSelected = 0;
          let incorrectSelected = 0;
          userAns.forEach((a: string) => {
            if (q.respuesta_correcta?.includes(a)) correctSelected++;
            else incorrectSelected++;
          });
          const partialScore = Math.max(0, (correctSelected - incorrectSelected) / (q.respuesta_correcta?.length || 1));
          totalScore += partialScore;
        } else {
          if (answers[q.id] === q.respuesta_correcta) totalScore++;
        }
      }
    });
    return parseFloat(totalScore.toFixed(2));
  };

  const handleSubmit = async () => {
    const rawScore = calculateScore();
    const finalScore = totalQuestions > 0 ? parseFloat(((rawScore / totalQuestions) * 100).toFixed(2)) : 0;
    
    setScore(finalScore);
    setSubmitted(true);

    if (inscriptionId) {
      // 1. Marcar como completada en lecciones_vistas
      await supabase
        .schema("academia")
        .from("lecciones_vistas")
        .upsert({
          inscripcion_id: inscriptionId,
          leccion_id: params.leccionId as string,
          completada_at: new Date().toISOString()
        }, { onConflict: 'inscripcion_id, leccion_id' });

      // 2. Guardar la calificación en academia.calificaciones
      if (profile?.id) {
        await supabase
          .schema("academia")
          .from("calificaciones")
          .upsert({
            curso_id: params.id,
            leccion_id: params.leccionId,
            usuario_id: profile.id,
            puntuacion: finalScore,
            puntuacion_maxima: 100,
            respuestas: answers,
            estado: 'Calificado',
            updated_at: new Date().toISOString()
          }, { onConflict: 'usuario_id, leccion_id' });
      }
    }
  };

  if (loading) return <div className={styles.loading}>Cargando evaluación...</div>;
  if (!evalData) return <div className={styles.loading}>No se encontró la evaluación.</div>;

  const totalQuestions = evalData.preguntas.length;

  return (
    <div className={styles.quizLayout}>
      <div className={styles.quizHeader}>
        <Link href={`/cursos/${params.id}/lecciones/${params.leccionId}`} className={styles.backBtn}>
          <ArrowLeft size={16} /> Volver a la lección
        </Link>
        <h1>{evalData.titulo || "Evaluación"}</h1>
        {evalData.descripcion && <p className={styles.quizDescription} style={{ marginTop: '10px', color: '#4b5563' }}>{evalData.descripcion}</p>}
      </div>

      <div className={styles.quizContent}>
        {evalData.preguntas.map((q: Question, i: number) => {
          const isAnswered = q.tipo === 'emparejamiento' 
            ? (Object.keys(answers[q.id] || {}).length === q.subpreguntas?.length)
            : !!answers[q.id];

          return (
            <div key={q.id} className={styles.questionBlock}>
              <div className={styles.questionSidebar}>
                <div className={styles.qNumber}>Pregunta <strong>{i + 1}</strong></div>
                <div className={styles.qStatus}>
                  {isAnswered ? "Respuesta guardada" : "Sin responder aún"}
                </div>
                <div className={styles.qPoints}>Se puntúa como 1.00</div>
              </div>

              <div className={styles.questionMain}>
                <p className={styles.qText} style={{ whiteSpace: 'pre-wrap' }}>{q.texto}</p>

                {q.tipo === 'emparejamiento' && q.subpreguntas && (
                  <div className={styles.matchingGrid}>
                    {q.subpreguntas.map((sub, sIdx) => {
                      const selectedVal = answers[q.id]?.[sIdx] || "";
                      return (
                        <div key={sIdx} className={styles.matchingRow}>
                          <div className={styles.matchingText}>{sub.texto}</div>
                          <select 
                            className={styles.matchingSelect}
                            value={selectedVal}
                            onChange={(e) => handleSelectAnswer(q.id, sIdx, e.target.value)}
                            disabled={submitted}
                          >
                            <option value="" disabled>Elegir...</option>
                            {q.opciones_globales?.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                          {submitted && (
                            <span className={styles.feedbackIcon}>
                              {selectedVal === sub.respuesta_correcta ? <CheckCircle color="#22c55e" size={18}/> : <AlertTriangle color="#ef4444" size={18}/>}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {(q.tipo === 'opcion_multiple' || q.tipo === 'seleccion_multiple' || q.tipo === 'verdadero_falso') && q.opciones && (
                  <div className={styles.radioGroup}>
                    {q.opciones.map((opt: any, oIndex: number) => {
                      const optText = getOpcionTexto(opt);
                      const optImage = typeof opt === "object" ? opt.imagen_url : "";
                      const isMulti = Array.isArray(q.respuesta_correcta);
                      const isSelected = isMulti ? (answers[q.id] || []).includes(optText) : answers[q.id] === optText;
                      const isCorrectOpt = isMulti ? q.respuesta_correcta?.includes(optText) : optText === q.respuesta_correcta;

                      return (
                        <label key={oIndex} className={styles.radioLabel}>
                          <input 
                            type={isMulti ? "checkbox" : "radio"} 
                            name={`q_${q.id}`} 
                            value={optText}
                            checked={isSelected}
                            onChange={(e) => {
                              if (isMulti) {
                                const currentAnswers = answers[q.id] || [];
                                if (e.target.checked) {
                                  handleSelectAnswer(q.id, null, [...currentAnswers, optText]);
                                } else {
                                  handleSelectAnswer(q.id, null, currentAnswers.filter((a: string) => a !== optText));
                                }
                              } else {
                                handleSelectAnswer(q.id, null, optText);
                              }
                            }}
                            disabled={submitted}
                          />
                          <div className={styles.optContent}>
                            <span>{optText}</span>
                            {optImage && (
                              <img src={optImage} alt={`Opción ${oIndex + 1}`} className={styles.optImage} />
                            )}
                          </div>
                          {submitted && isSelected && (
                            <span className={styles.feedbackIcon}>
                              {isCorrectOpt ? <CheckCircle color="#22c55e" size={18}/> : <AlertTriangle color="#ef4444" size={18}/>}
                            </span>
                          )}
                          {submitted && !isSelected && isCorrectOpt && (
                            <span className={styles.correctText}>(Respuesta correcta)</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {!submitted ? (
          <div className={styles.submitArea}>
            <button className={styles.finishBtn} onClick={handleSubmit}>
              Terminar intento...
            </button>
          </div>
        ) : (
          <div className={styles.resultsArea}>
            <h2>Revisión del intento</h2>
            <p>Puntuación: <strong>{score}</strong> / 100</p>
            <Link href={`/cursos/${params.id}`} className={styles.finishBtn}>
              Finalizar revisión y volver al curso
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
