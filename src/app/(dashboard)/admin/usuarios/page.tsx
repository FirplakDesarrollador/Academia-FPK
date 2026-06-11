"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { UserPlus, Search, CheckCircle, AlertCircle, BookOpen, X } from "lucide-react";
import styles from "./page.module.css";

interface Empleado {
  id: number;
  nombreCompleto: string;
  cargo: string;
}

interface Curso {
  id: string;
  nombre: string;
  categoria: string;
}

export default function GestionUsuarios() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [usuariosAcademia, setUsuariosAcademia] = useState<string[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal: crear cuenta
  const [selectedEmpleado, setSelectedEmpleado] = useState<Empleado | null>(null);
  const [defaultPassword, setDefaultPassword] = useState("Academia2026*");
  const [isCreating, setIsCreating] = useState(false);

  // Modal: gestionar cursos
  const [cursoEmpleado, setCursoEmpleado] = useState<Empleado | null>(null);
  const [cursosAsignados, setCursosAsignados] = useState<Set<string>>(new Set());
  const [savingCursos, setSavingCursos] = useState(false);



  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empRes, usuRes, cursosRes] = await Promise.all([
        supabase
          .from("empleados")
          .select('id, "nombreCompleto", cargo')
          .eq("activo", true)
          .order('"nombreCompleto"', { ascending: true })
          .limit(3000),
        supabase.schema("academia").from("usuarios").select("empleado_id"),
        supabase
          .schema("academia")
          .from("cursos")
          .select("id, nombre, categoria:categoria_id(nombre)")
          .eq("activo", true)
          .order("nombre"),
      ]);

      if (empRes.error) throw empRes.error;
      if (usuRes.error) throw usuRes.error;

      setEmpleados(empRes.data || []);
      setUsuariosAcademia((usuRes.data || []).map((u) => String(u.empleado_id)));

      const mappedCursos = (cursosRes.data || []).map((c: any) => ({
        id: c.id,
        nombre: c.nombre,
        categoria: c.categoria?.nombre || "General",
      }));
      setCursos(mappedCursos);
    } catch (error) {
      console.error("Error cargando datos:", error);
    } finally {
      setLoading(false);
    }
  };

  // ── Crear cuenta ──────────────────────────────────────────────
  const handleCrearCuenta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpleado) return;
    setIsCreating(true);
    try {
      const partes = (selectedEmpleado.nombreCompleto || "").trim().split(/\s+/);
      const nombres = partes.slice(0, 2).join(" ");
      const apellidos = partes.slice(2).join(" ") || ".";

      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: `${selectedEmpleado.id}@empleado.academia.local`,
          password: defaultPassword,
          cedula: String(selectedEmpleado.id),
          nombres,
          apellidos,
          empleadoId: selectedEmpleado.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear cuenta");

      setUsuariosAcademia((prev) => [...prev, String(selectedEmpleado.id)]);
      setSelectedEmpleado(null);
      alert("Cuenta creada con éxito.");
    } catch (error: any) {
      console.error(error);
      alert(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  // ── Abrir modal de cursos ─────────────────────────────────────
  const openCursosModal = async (emp: Empleado) => {
    setCursoEmpleado(emp);
    // Obtener inscripciones actuales del empleado
    const { data } = await supabase
      .schema("academia")
      .from("inscripciones")
      .select("curso_id")
      .eq("empleado_id", emp.id);
    setCursosAsignados(new Set((data || []).map((i: any) => i.curso_id)));
  };

  const toggleCurso = (cursoId: string) => {
    setCursosAsignados((prev) => {
      const next = new Set(prev);
      if (next.has(cursoId)) next.delete(cursoId);
      else next.add(cursoId);
      return next;
    });
  };

  const saveCursos = async () => {
    if (!cursoEmpleado) return;
    setSavingCursos(true);
    try {
      // Estado actual en BD
      const { data: existing } = await supabase
        .schema("academia")
        .from("inscripciones")
        .select("id, curso_id")
        .eq("empleado_id", cursoEmpleado.id);

      const existingIds = new Set((existing || []).map((i: any) => i.curso_id));

      // Cursos a agregar (en UI pero no en BD)
      const toAdd = [...cursosAsignados].filter((id) => !existingIds.has(id));
      // Cursos a quitar (en BD pero no en UI)
      const toRemove = (existing || []).filter((i: any) => !cursosAsignados.has(i.curso_id));

      if (toAdd.length > 0) {
        await supabase.schema("academia").from("inscripciones").insert(
          toAdd.map((curso_id) => ({
            curso_id,
            empleado_id: cursoEmpleado.id,
            status: "asignado",
            fecha_inscripcion: new Date().toISOString(),
          }))
        );
      }

      for (const ins of toRemove) {
        await supabase
          .schema("academia")
          .from("inscripciones")
          .delete()
          .eq("id", ins.id);
      }

      setCursoEmpleado(null);
      alert(`Cursos actualizados para ${cursoEmpleado.nombreCompleto}.`);
    } catch (err: any) {
      console.error(err);
      alert("Error al guardar: " + err.message);
    } finally {
      setSavingCursos(false);
    }
  };

  const filteredEmpleados = empleados.filter(
    (emp) =>
      emp.nombreCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(emp.id).includes(searchTerm)
  );

  return (
    <div className={`${styles.container} animate-fade-in`}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Gestión de Cuentas Formativas</h1>
          <p className={styles.subtitle}>
            Crea accesos a la Academia y asigna cursos a los empleados.
          </p>
        </div>
      </header>

      <div className={styles.controls}>
        <Search size={20} color="#64748b" style={{ position: "absolute", marginTop: "10px", marginLeft: "12px" }} />
        <input
          type="text"
          placeholder="Buscar empleado por nombre o cédula..."
          className={styles.searchInput}
          style={{ paddingLeft: "40px" }}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className={styles.tableContainer}>
        {loading ? (
          <div className={styles.loading}>Cargando registros...</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Documento</th>
                <th>Cargo</th>
                <th>Estado Academia</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmpleados.length > 0 ? (
                filteredEmpleados.map((emp) => {
                  const isRegistered = usuariosAcademia.includes(String(emp.id));
                  return (
                    <tr key={emp.id}>
                      <td><strong>{emp.nombreCompleto}</strong></td>
                      <td>{emp.id}</td>
                      <td>{emp.cargo || "Sin asignar"}</td>
                      <td>
                        {isRegistered ? (
                          <span className={`${styles.status} ${styles.statusActive}`}>
                            <CheckCircle size={14} /> Activa
                          </span>
                        ) : (
                          <span className={`${styles.status} ${styles.statusPending}`}>
                            <AlertCircle size={14} /> Sin cuenta
                          </span>
                        )}
                      </td>
                      <td style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {!isRegistered && (
                          <button className={styles.createBtn} onClick={() => setSelectedEmpleado(emp)}>
                            <UserPlus size={16} /> Generar
                          </button>
                        )}
                        {isRegistered && (
                          <button
                            className={styles.createBtn}
                            style={{ background: "var(--primary)", opacity: 0.85 }}
                            onClick={() => openCursosModal(emp)}
                          >
                            <BookOpen size={16} /> Cursos
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#64748b" }}>
                    No se encontraron empleados con ese término de búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: Crear cuenta */}
      {selectedEmpleado && typeof document !== "undefined" && createPortal(
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h3>Generar Cuenta: {selectedEmpleado.nombreCompleto}</h3>
            <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "20px" }}>
              El empleado ingresará usando su cédula (<strong>{selectedEmpleado.id}</strong>) y la contraseña establecida.
            </p>
            <form onSubmit={handleCrearCuenta}>
              <div className={styles.inputGroup}>
                <label>Contraseña Global Temporal</label>
                <input
                  type="text"
                  className={styles.searchInput}
                  value={defaultPassword}
                  onChange={(e) => setDefaultPassword(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box" }}
                  required
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setSelectedEmpleado(null)} disabled={isCreating}>
                  Cancelar
                </button>
                <button type="submit" className={styles.createBtn} disabled={isCreating}>
                  {isCreating ? "Creando..." : "Confirmar y Crear Cuenta"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: Gestionar cursos */}
      {cursoEmpleado && typeof document !== "undefined" && createPortal(
        <div className={styles.overlay}>
          <div className={styles.modal} style={{ maxWidth: "520px", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h3 style={{ margin: 0 }}>Cursos de {cursoEmpleado.nombreCompleto}</h3>
              <button onClick={() => setCursoEmpleado(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "16px" }}>
              Marca los cursos que quieres asignar a este empleado. Los cambios se guardan al presionar "Guardar".
            </p>

            <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
              {cursos.map((curso) => {
                const checked = cursosAsignados.has(curso.id);
                return (
                  <label
                    key={curso.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: `1.5px solid ${checked ? "var(--primary)" : "#e2e8f0"}`,
                      background: checked ? "rgba(37,65,83,0.06)" : "#fff",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCurso(curso.id)}
                      style={{ width: "16px", height: "16px", accentColor: "var(--primary)", cursor: "pointer" }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "14px" }}>{curso.nombre}</div>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>{curso.categoria}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setCursoEmpleado(null)} disabled={savingCursos}>
                Cancelar
              </button>
              <button className={styles.createBtn} onClick={saveCursos} disabled={savingCursos}>
                {savingCursos ? "Guardando..." : "Guardar asignaciones"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
