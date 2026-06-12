"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import {
  UserPlus,
  Search,
  CheckCircle,
  AlertCircle,
  BookOpen,
  X,
  UserCheck,
  Users,
} from "lucide-react";
import styles from "./page.module.css";

interface Empleado {
  id: number;
  nombreCompleto: string;
  cargo: string;
}

interface UsuarioExterno {
  id: string;
  nombre_completo: string;
  email_visible: string;
  cargo: string | null;
  created_at: string;
}

interface Curso {
  id: string;
  nombre: string;
  categoria: string;
}

export default function GestionUsuarios() {
  const [tab, setTab] = useState<"empleados" | "externos">("empleados");

  // ── Empleados ──────────────────────────────────────────────────
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [usuariosAcademia, setUsuariosAcademia] = useState<string[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal: crear cuenta empleado
  const [selectedEmpleado, setSelectedEmpleado] = useState<Empleado | null>(null);
  const [defaultPassword, setDefaultPassword] = useState("Academia2026*");
  const [isCreating, setIsCreating] = useState(false);

  // Modal: gestionar cursos
  const [cursoEmpleado, setCursoEmpleado] = useState<Empleado | null>(null);
  const [cursosAsignados, setCursosAsignados] = useState<Set<string>>(new Set());
  const [savingCursos, setSavingCursos] = useState(false);

  // ── Externos ──────────────────────────────────────────────────
  const [externos, setExternos] = useState<UsuarioExterno[]>([]);
  const [searchExterno, setSearchExterno] = useState("");
  const [showExternoModal, setShowExternoModal] = useState(false);
  const [externoForm, setExternoForm] = useState({
    nombreCompleto: "",
    email: "",
    cargo: "",
    password: "Academia2026*",
  });
  const [creatingExterno, setCreatingExterno] = useState(false);
  const [externoError, setExternoError] = useState("");

  // Modal: gestionar cursos de externo
  const [cursoExterno, setCursoExterno] = useState<UsuarioExterno | null>(null);
  const [cursosExterno, setCursosExterno] = useState<Set<string>>(new Set());
  const [savingCursosExterno, setSavingCursosExterno] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empRes, usuRes, cursosRes, externosRes] = await Promise.all([
        supabase
          .from("empleados")
          .select('id, "nombreCompleto", cargo')
          .eq("activo", true)
          .order('"nombreCompleto"', { ascending: true })
          .limit(3000),
        supabase.schema("academia").from("usuarios").select("empleado_id").eq("tipo", "empleado"),
        supabase
          .schema("academia")
          .from("cursos")
          .select("id, nombre, categoria:categoria_id(nombre)")
          .eq("activo", true)
          .order("nombre"),
        supabase
          .schema("academia")
          .from("usuarios")
          .select("id, nombre_completo, email_visible, cargo, created_at")
          .eq("tipo", "externo")
          .order("nombre_completo"),
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
      setExternos((externosRes.data || []) as UsuarioExterno[]);
    } catch (error) {
      console.error("Error cargando datos:", error);
    } finally {
      setLoading(false);
    }
  };

  // ── Crear cuenta empleado ──────────────────────────────────────
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

  // ── Crear cuenta externa ───────────────────────────────────────
  const handleCrearExterno = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingExterno(true);
    setExternoError("");
    try {
      const res = await fetch("/api/admin/create-external-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: externoForm.email.trim().toLowerCase(),
          password: externoForm.password,
          nombreCompleto: externoForm.nombreCompleto,
          cargo: externoForm.cargo,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear cuenta externa");

      // Recargar lista de externos
      const { data: updated } = await supabase
        .schema("academia")
        .from("usuarios")
        .select("id, nombre_completo, email_visible, cargo, created_at")
        .eq("tipo", "externo")
        .order("nombre_completo");

      setExternos((updated || []) as UsuarioExterno[]);
      setShowExternoModal(false);
      setExternoForm({ nombreCompleto: "", email: "", cargo: "", password: "Academia2026*" });
      alert(`Cuenta externa creada: ${externoForm.email}`);
    } catch (error: any) {
      setExternoError(error.message);
    } finally {
      setCreatingExterno(false);
    }
  };

  // ── Cursos modal externo ───────────────────────────────────────
  const openCursosExterno = async (usuario: UsuarioExterno) => {
    setCursoExterno(usuario);
    const { data } = await supabase
      .schema("academia")
      .from("inscripciones")
      .select("curso_id")
      .eq("usuario_id", usuario.id);
    setCursosExterno(new Set((data || []).map((i: any) => i.curso_id)));
  };

  const toggleCursoExterno = (cursoId: string) => {
    setCursosExterno((prev) => {
      const next = new Set(prev);
      if (next.has(cursoId)) next.delete(cursoId);
      else next.add(cursoId);
      return next;
    });
  };

  const saveCursosExterno = async () => {
    if (!cursoExterno) return;
    setSavingCursosExterno(true);
    try {
      const { data: existing } = await supabase
        .schema("academia")
        .from("inscripciones")
        .select("id, curso_id")
        .eq("usuario_id", cursoExterno.id);

      const existingIds = new Set((existing || []).map((i: any) => i.curso_id));
      const toAdd = [...cursosExterno].filter((id) => !existingIds.has(id));
      const toRemove = (existing || []).filter((i: any) => !cursosExterno.has(i.curso_id));

      if (toAdd.length > 0) {
        await supabase.schema("academia").from("inscripciones").insert(
          toAdd.map((curso_id) => ({
            curso_id,
            usuario_id: cursoExterno.id,
            empleado_id: null,
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

      setCursoExterno(null);
      alert(`Cursos actualizados para ${cursoExterno.nombre_completo}.`);
    } catch (err: any) {
      console.error(err);
      alert("Error al guardar: " + err.message);
    } finally {
      setSavingCursosExterno(false);
    }
  };

  // ── Cursos modal empleado ──────────────────────────────────────
  const openCursosModal = async (emp: Empleado) => {
    setCursoEmpleado(emp);
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
      const { data: existing } = await supabase
        .schema("academia")
        .from("inscripciones")
        .select("id, curso_id")
        .eq("empleado_id", cursoEmpleado.id);

      const existingIds = new Set((existing || []).map((i: any) => i.curso_id));
      const toAdd = [...cursosAsignados].filter((id) => !existingIds.has(id));
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

  const filteredExternos = externos.filter(
    (u) =>
      u.nombre_completo?.toLowerCase().includes(searchExterno.toLowerCase()) ||
      u.email_visible?.toLowerCase().includes(searchExterno.toLowerCase())
  );

  return (
    <div className={`${styles.container} animate-fade-in`}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Gestión de Cuentas Formativas</h1>
          <p className={styles.subtitle}>
            Crea accesos a la Academia y asigna cursos a empleados y usuarios externos.
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button
          onClick={() => setTab("empleados")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "10px",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "14px",
            transition: "all 0.2s",
            background: tab === "empleados" ? "var(--primary)" : "#f1f5f9",
            color: tab === "empleados" ? "#fff" : "#475569",
          }}
        >
          <Users size={16} />
          Empleados ({empleados.length})
        </button>
        <button
          onClick={() => setTab("externos")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "10px",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "14px",
            transition: "all 0.2s",
            background: tab === "externos" ? "var(--primary)" : "#f1f5f9",
            color: tab === "externos" ? "#fff" : "#475569",
          }}
        >
          <UserCheck size={16} />
          Externos ({externos.length})
        </button>
      </div>

      {/* ═══════ TAB EMPLEADOS ═══════ */}
      {tab === "empleados" && (
        <>
          <div className={styles.controls}>
            <Search
              size={20}
              color="#64748b"
              style={{ position: "absolute", marginTop: "10px", marginLeft: "12px" }}
            />
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
                          <td>
                            <strong>{emp.nombreCompleto}</strong>
                          </td>
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
                              <button
                                className={styles.createBtn}
                                onClick={() => setSelectedEmpleado(emp)}
                              >
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
        </>
      )}

      {/* ═══════ TAB EXTERNOS ═══════ */}
      {tab === "externos" && (
        <>
          <div className={styles.controls} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search
                size={20}
                color="#64748b"
                style={{ position: "absolute", top: "50%", left: "12px", transform: "translateY(-50%)" }}
              />
              <input
                type="text"
                placeholder="Buscar por nombre o email..."
                className={styles.searchInput}
                style={{ paddingLeft: "40px", width: "100%", boxSizing: "border-box" }}
                value={searchExterno}
                onChange={(e) => setSearchExterno(e.target.value)}
              />
            </div>
            <button
              className={styles.createBtn}
              onClick={() => setShowExternoModal(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                whiteSpace: "nowrap",
                padding: "10px 20px",
              }}
            >
              <UserPlus size={16} /> Registrar Externo
            </button>
          </div>

          <div className={styles.tableContainer}>
            {loading ? (
              <div className={styles.loading}>Cargando registros...</div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nombre Completo</th>
                    <th>Email (usuario)</th>
                    <th>Cargo / Descripción</th>
                    <th>Fecha Registro</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExternos.length > 0 ? (
                    filteredExternos.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <strong>{u.nombre_completo || "—"}</strong>
                        </td>
                        <td style={{ fontFamily: "monospace", fontSize: "13px" }}>
                          {u.email_visible}
                        </td>
                        <td>{u.cargo || "Sin especificar"}</td>
                        <td style={{ fontSize: "13px", color: "#64748b" }}>
                          {u.created_at
                            ? new Date(u.created_at).toLocaleDateString("es-CO")
                            : "—"}
                        </td>
                        <td>
                          <span className={`${styles.status} ${styles.statusActive}`}>
                            <CheckCircle size={14} /> Activa
                          </span>
                        </td>
                        <td>
                          <button
                            className={styles.createBtn}
                            style={{ background: "var(--primary)", opacity: 0.85 }}
                            onClick={() => openCursosExterno(u)}
                          >
                            <BookOpen size={16} /> Cursos
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", color: "#64748b" }}>
                        No hay usuarios externos registrados.{" "}
                        <button
                          onClick={() => setShowExternoModal(true)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--primary)",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          Registrar el primero →
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          Modal: Crear cuenta empleado
      ══════════════════════════════════════════════════════════ */}
      {selectedEmpleado &&
        typeof document !== "undefined" &&
        createPortal(
          <div className={styles.overlay}>
            <div className={styles.modal}>
              <h3>Generar Cuenta: {selectedEmpleado.nombreCompleto}</h3>
              <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "20px" }}>
                El empleado ingresará usando su cédula (
                <strong>{selectedEmpleado.id}</strong>) y la contraseña establecida.
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
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={() => setSelectedEmpleado(null)}
                    disabled={isCreating}
                  >
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

      {/* ══════════════════════════════════════════════════════════
          Modal: Registrar Usuario Externo
      ══════════════════════════════════════════════════════════ */}
      {showExternoModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div className={styles.overlay}>
            <div className={styles.modal} style={{ maxWidth: "480px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                  <UserCheck size={20} color="var(--primary)" />
                  Registrar Usuario Externo
                </h3>
                <button
                  onClick={() => {
                    setShowExternoModal(false);
                    setExternoError("");
                  }}
                  style={{ background: "none", border: "none", cursor: "pointer" }}
                >
                  <X size={20} />
                </button>
              </div>
              <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "20px" }}>
                Registra personas que no están en la lista de empleados (proveedores,
                contratistas, personal temporal, etc.).
              </p>

              <form onSubmit={handleCrearExterno}>
                <div className={styles.inputGroup}>
                  <label>Nombre Completo *</label>
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Ej: Juan Carlos Pérez"
                    value={externoForm.nombreCompleto}
                    onChange={(e) =>
                      setExternoForm((f) => ({ ...f, nombreCompleto: e.target.value }))
                    }
                    style={{ width: "100%", boxSizing: "border-box" }}
                    required
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Correo Electrónico (usuario de ingreso) *</label>
                  <input
                    type="email"
                    className={styles.searchInput}
                    placeholder="Ej: jperez@proveedor.com"
                    value={externoForm.email}
                    onChange={(e) =>
                      setExternoForm((f) => ({ ...f, email: e.target.value }))
                    }
                    style={{ width: "100%", boxSizing: "border-box" }}
                    required
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Cargo o Descripción</label>
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Ej: Proveedor, Contratista, Auditor..."
                    value={externoForm.cargo}
                    onChange={(e) =>
                      setExternoForm((f) => ({ ...f, cargo: e.target.value }))
                    }
                    style={{ width: "100%", boxSizing: "border-box" }}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Contraseña Temporal *</label>
                  <input
                    type="text"
                    className={styles.searchInput}
                    value={externoForm.password}
                    onChange={(e) =>
                      setExternoForm((f) => ({ ...f, password: e.target.value }))
                    }
                    style={{ width: "100%", boxSizing: "border-box" }}
                    required
                    minLength={8}
                  />
                </div>

                {externoError && (
                  <div
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fca5a5",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      fontSize: "13px",
                      color: "#dc2626",
                      marginBottom: "16px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <AlertCircle size={14} />
                    {externoError}
                  </div>
                )}

                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={() => {
                      setShowExternoModal(false);
                      setExternoError("");
                    }}
                    disabled={creatingExterno}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className={styles.createBtn} disabled={creatingExterno}>
                    {creatingExterno ? "Registrando..." : "Registrar Cuenta"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ══════════════════════════════════════════════════════════
          Modal: Gestionar cursos
      ══════════════════════════════════════════════════════════ */}
      {cursoEmpleado &&
        typeof document !== "undefined" &&
        createPortal(
          <div className={styles.overlay}>
            <div
              className={styles.modal}
              style={{ maxWidth: "520px", maxHeight: "80vh", display: "flex", flexDirection: "column" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <h3 style={{ margin: 0 }}>Cursos de {cursoEmpleado.nombreCompleto}</h3>
                <button
                  onClick={() => setCursoEmpleado(null)}
                  style={{ background: "none", border: "none", cursor: "pointer" }}
                >
                  <X size={20} />
                </button>
              </div>
              <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "16px" }}>
                Marca los cursos que quieres asignar a este empleado. Los cambios se guardan al
                presionar &quot;Guardar&quot;.
              </p>

              <div
                style={{
                  overflowY: "auto",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  marginBottom: "16px",
                }}
              >
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
                        style={{
                          width: "16px",
                          height: "16px",
                          accentColor: "var(--primary)",
                          cursor: "pointer",
                        }}
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
                <button
                  className={styles.cancelBtn}
                  onClick={() => setCursoEmpleado(null)}
                  disabled={savingCursos}
                >
                  Cancelar
                </button>
                <button
                  className={styles.createBtn}
                  onClick={saveCursos}
                  disabled={savingCursos}
                >
                  {savingCursos ? "Guardando..." : "Guardar asignaciones"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ══════════════════════════════════════════════════════════
          Modal: Gestionar cursos de usuario EXTERNO
      ══════════════════════════════════════════════════════════ */}
      {cursoExterno &&
        typeof document !== "undefined" &&
        createPortal(
          <div className={styles.overlay}>
            <div
              className={styles.modal}
              style={{
                maxWidth: "520px",
                maxHeight: "80vh",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "4px",
                }}
              >
                <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                  <BookOpen size={18} color="var(--primary)" />
                  Cursos de {cursoExterno.nombre_completo}
                </h3>
                <button
                  onClick={() => setCursoExterno(null)}
                  style={{ background: "none", border: "none", cursor: "pointer" }}
                >
                  <X size={20} />
                </button>
              </div>
              <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "16px" }}>
                Selecciona los cursos que tendrá disponibles este usuario externo.
              </p>

              <div
                style={{
                  overflowY: "auto",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  marginBottom: "16px",
                }}
              >
                {cursos.length === 0 ? (
                  <p style={{ color: "#64748b", textAlign: "center", fontSize: "14px" }}>
                    No hay cursos activos disponibles.
                  </p>
                ) : (
                  cursos.map((curso) => {
                    const checked = cursosExterno.has(curso.id);
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
                          onChange={() => toggleCursoExterno(curso.id)}
                          style={{
                            width: "16px",
                            height: "16px",
                            accentColor: "var(--primary)",
                            cursor: "pointer",
                          }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "14px" }}>{curso.nombre}</div>
                          <div style={{ fontSize: "12px", color: "#64748b" }}>{curso.categoria}</div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>

              <div className={styles.modalActions}>
                <button
                  className={styles.cancelBtn}
                  onClick={() => setCursoExterno(null)}
                  disabled={savingCursosExterno}
                >
                  Cancelar
                </button>
                <button
                  className={styles.createBtn}
                  onClick={saveCursosExterno}
                  disabled={savingCursosExterno}
                >
                  {savingCursosExterno ? "Guardando..." : "Guardar asignaciones"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
