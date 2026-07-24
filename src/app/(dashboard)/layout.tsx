"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar/Sidebar";
import Navbar from "@/components/Navbar/Navbar";
import styles from "./layout.module.css";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className={styles.content}>
        <Navbar onMenuClick={() => setSidebarOpen((v) => !v)} />
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
