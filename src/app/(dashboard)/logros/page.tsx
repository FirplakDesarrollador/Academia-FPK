import ComingSoonPage from "@/components/ComingSoon/ComingSoonPage";
import { GraduationCap } from "lucide-react";

export default function LogrosPage() {
  return (
    <ComingSoonPage
      title="Logros y Certificados"
      description="Aquí encontrarás todos tus logros desbloqueados, insignias ganadas y certificados de formación completados."
      icon={GraduationCap}
    />
  );
}
