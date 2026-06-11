"use client";

import ComingSoonPage from "@/components/ComingSoon/ComingSoonPage";
import { MessageSquare } from "lucide-react";

export default function MensajesPage() {
  return (
    <ComingSoonPage
      title="Mensajes"
      description="El sistema de mensajería interna te permitirá comunicarte con tus instructores y compañeros de formación."
      icon={MessageSquare}
    />
  );
}
