"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  BookOpen, 
  Calendar, 
  MessageSquare, 
  Settings, 
  GraduationCap,
  LifeBuoy,
  Users,
  Award,
  ClipboardList,
  PlusCircle
} from "lucide-react";
import { useAuth } from "@/components/Providers/AuthProvider";
import styles from "./Sidebar.module.css";

const menuItems = [
  { icon: LayoutDashboard, label: "Página principal", href: "/" },
  { icon: BookOpen, label: "Mis Cursos", href: "/cursos" },
  { icon: Award, label: "Calificaciones", href: "/calificaciones" },
  { icon: PlusCircle, label: "Gestión de Cursos", href: "/admin/cursos", requireAdmin: true },
  { icon: Users, label: "Gestión de Usuarios", href: "/admin/usuarios", requireAdmin: true },
  { icon: ClipboardList, label: "Reporte Calificador", href: "/admin/calificaciones", requireAdmin: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { profile } = useAuth();
  
  // Solo rol_id 1 = ADMINISTRADOR
  const isAdmin = profile?.rol_id === "1";

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <div style={{ background: "var(--primary)", padding: "8px", borderRadius: "10px" }}>
          <BookOpen color="white" size={24} />
        </div>
        <span className={styles.logoText}>Academia</span>
      </div>

      <nav className={styles.nav}>
        {menuItems.map((item) => {
          if (item.requireAdmin && !isAdmin) return null;
          
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.active : ""}`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>


    </aside>
  );
}
