import ComingSoonPage from "@/components/ComingSoon/ComingSoonPage";
import { Settings } from "lucide-react";

export default function ConfiguracionPage() {
  return (
    <ComingSoonPage
      title="Configuración"
      description="Personaliza tu experiencia de aprendizaje: notificaciones, preferencias de idioma y opciones de privacidad."
      icon={Settings}
    />
  );
}
