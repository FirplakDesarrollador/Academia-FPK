"use client";

import { useState } from "react";
import { Search, Bell, Mail, ChevronDown, LogOut } from "lucide-react";
import { useAuth } from "@/components/Providers/AuthProvider";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const { profile, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const getInitials = () => {
    if (!profile?.nombres) return "AC";
    const partes = profile.nombres.trim().split(/\s+/);
    const apellPartes = profile.apellidos?.trim().split(/\s+/) || [];
    const inicial1 = partes[0]?.charAt(0) || "";
    const inicial2 = apellPartes[0]?.charAt(0) || partes[1]?.charAt(0) || "";
    return `${inicial1}${inicial2}`.toUpperCase();
  };

  const getFullName = () => {
    if (!profile) return "Usuario Plataforma";
    const primerNombre = profile.nombres.trim().split(/\s+/)[0] || "";
    const primerApellido = profile.apellidos?.trim().split(/\s+/)[0] || "";
    return `${primerNombre}${primerApellido ? " " + primerApellido : ""}`.trim();
  };

  const getRoleLabel = () => {
    const rolMap: Record<string, string> = { "1": "Administrador", "2": "Administrativo", "3": "Operario" };
    return profile?.rol_id ? (rolMap[profile.rol_id] || "Académico") : "Estudiante";
  };

  return (
    <header className={styles.navbar}>
      <div className={styles.searchWrapper}>
        <Search size={18} opacity={0.5} />
        <input type="text" placeholder="Buscar cursos, lecciones, recursos..." />
      </div>

      <div className={styles.actions}>
        <button className={styles.iconButton}>
          <Mail size={20} />
          <span className={styles.badge}></span>
        </button>
        <button className={styles.iconButton}>
          <Bell size={20} />
          <span className={styles.badge}></span>
        </button>

        <div className={styles.profileContainer}>
          <div 
            className={styles.userProfile} 
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <div className={styles.avatar}>{getInitials()}</div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{getFullName()}</span>
              {/* Nota: Idealmente rol de BD, pero operario es lo predeterminado para estudiantes */}
              <span className={styles.userRole}>
                {getRoleLabel()}
              </span>
            </div>
            <ChevronDown size={16} opacity={0.5} style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>

          {menuOpen && (
            <div className={styles.dropdownMenu}>
              <button onClick={() => logout()} className={styles.dropdownItem}>
                <LogOut size={16} /> Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
