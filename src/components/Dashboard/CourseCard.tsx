import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import styles from "./CourseCard.module.css";

interface CourseCardProps {
  id: string;
  title: string;
  progress: number;
  category: string;
  image: string;
}

export default function CourseCard({ 
  id,
  title, 
  progress, 
  category, 
  image
}: CourseCardProps) {
  return (
    <Link href={`/cursos/${id}`} className={styles.cardLink}>
      <div className={styles.card}>
      <div 
        className={styles.image} 
        style={{ backgroundImage: `url(${image})` }}
      />
      
      <div className={styles.content}>
        <div className={styles.header}>
          <span className={styles.category}>{category}</span>
          <button className={styles.menuBtn}>
            <MoreHorizontal size={18} />
          </button>
        </div>
        
        <h3 className={styles.title}>{title}</h3>
        
        <div className={styles.progressContainer}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className={styles.progressText}>
            {progress}% completado
          </div>
        </div>
      </div>
    </div>
    </Link>
  );
}
