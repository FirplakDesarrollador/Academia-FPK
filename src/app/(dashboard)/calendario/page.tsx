"use client";

import ComingSoonPage from "@/components/ComingSoon/ComingSoonPage";
import { Calendar } from "lucide-react";

export default function CalendarioPage() {
  return (
    <ComingSoonPage
      title="Calendario"
      description="Aquí podrás visualizar tus eventos de formación, fechas límite de cursos y programaciones de capacitaciones."
      icon={Calendar}
    />
  );
}
