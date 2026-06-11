"use client";

import { LucideIcon } from "lucide-react";
import styles from "./ComingSoonPage.module.css";

interface ComingSoonPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export default function ComingSoonPage({ title, description, icon: Icon }: ComingSoonPageProps) {
  return (
    <div className={`${styles.wrapper} animate-fade-in`}>
      <div className={styles.card}>
        <div className={styles.iconRing}>
          <Icon size={40} />
        </div>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
        <div className={styles.badge}>
          <span className={styles.dot} />
          Próximamente disponible
        </div>
      </div>
    </div>
  );
}
