import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Users, 
  Calendar, 
  Cloud, 
  Layout, 
  CheckSquare, 
  FileText, 
  Download, 
  ClipboardList,
  HelpCircle,
  Briefcase,
  Plus,
  Edit2,
  ChevronDown,
  ChevronUp,
  Move,
  File,
  X,
  ExternalLink,
  Check,
  PlayCircle,
  CheckCircle,
  Globe,
  ArrowLeft
} from 'lucide-react';
import styles from './ColaborativasContent.module.css';

interface Resource {
  title: string;
  type?: 'video' | 'link' | 'download' | 'quiz' | 'template' | 'pdf' | 'task' | 'upload';
  url?: string;
  description?: string;
  isHidden?: boolean;
}

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
  logo?: string;
  color: string;
  description?: string;
  resources: Resource[];
  subSections?: {
    title: string;
    description: string;
    resources: Resource[];
  }[];
}

interface ColaborativasContentProps {
  completedLessons: Set<string>;
  onToggleComplete?: (title: string, metadata?: any) => void;
  isEditing?: boolean;
}

function UploadActivity({ resource, onComplete, isCompleted }: { resource: Resource; onComplete: (fileName?: string) => void; isCompleted: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(isCompleted);
  const [error, setError] = useState('');

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: { user } } = await supabase.auth.getUser();
      const ext = file.name.split('.').pop();
      
      const safeTitle = resource.title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '_');
        
      const fileName = `${user?.id || 'anon'}/${safeTitle}_${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('evidencias')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;
      
      setUploaded(true);
      onComplete(fileName);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem', gap: '1.5rem', textAlign: 'center' }}>
      <ClipboardList size={64} style={{ color: '#eab308', marginBottom: '0.5rem' }} />
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1e293b' }}>{resource.title}</h2>
      {resource.description && (
        <p style={{ whiteSpace: 'pre-wrap', color: '#475569', maxWidth: '600px', lineHeight: '1.7', fontSize: '0.95rem', background: '#f8fafc', borderRadius: '10px', padding: '1.25rem 1.5rem', border: '1px solid #e2e8f0', textAlign: 'left' }}>
          {resource.description}
        </p>
      )}
      {uploaded ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#dcfce7', color: '#166534', padding: '1rem 1.5rem', borderRadius: '10px', fontWeight: 600 }}>
          <CheckCircle size={22} />
          Evidencia enviada correctamente
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%', maxWidth: '480px' }}>
          <label style={{ width: '100%', border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '2rem', cursor: 'pointer', background: file ? '#f0fdf4' : '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', color: '#64748b', transition: 'all 0.2s' }}>
            <Download size={36} style={{ color: file ? '#22c55e' : '#94a3b8' }} />
            {file ? (
              <span style={{ color: '#166534', fontWeight: 600 }}>{file.name}</span>
            ) : (
              <>
                <span style={{ fontWeight: 600, color: '#334155' }}>Haz clic o arrastra tu archivo aquí</span>
                <span style={{ fontSize: '0.82rem' }}>PNG, JPG, PDF — evidencia de la tarea</span>
              </>
            )}
            <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)} />
          </label>
          {error && <p style={{ color: '#ef4444', fontSize: '0.875rem' }}>{error}</p>}
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            style={{ background: file ? '#eab308' : '#cbd5e1', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.75rem 2rem', fontWeight: 700, fontSize: '1rem', cursor: file ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
          >
            {uploading ? 'Enviando...' : 'Enviar evidencia'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ColaborativasContent({ completedLessons, onToggleComplete, isEditing }: ColaborativasContentProps) {
  const [mounted, setMounted] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'outlook': true,
    'teams': true,
    'planner': true,
    'evaluacion': true
  });
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [videoFinished, setVideoFinished] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const getResourceIcon = (type: string | undefined) => {
    switch (type) {
      case 'video': return { icon: <PlayCircle size={18} color="white" />, bg: '#9e7ab0' };
      case 'link': return { icon: <Globe size={18} color="white" />, bg: '#7ab09e' };
      case 'pdf': return { icon: <FileText size={18} color="white" />, bg: '#e17a7a' };
      case 'template': return { icon: <FileText size={18} color="white" />, bg: '#7ab09e' };
      case 'download': return { icon: <Download size={18} color="white" />, bg: '#7a8bb0' };
      case 'quiz': return { icon: <ClipboardList size={18} color="white" />, bg: '#b09e7a' };
      case 'task': return { icon: <CheckSquare size={18} color="white" />, bg: '#31752f' };
      default: return { icon: <FileText size={18} color="white" />, bg: '#7ab09e' };
    }
  };

  const sections: Section[] = [
    {
      id: 'outlook',
      title: 'Outlook',
      icon: <Mail />,
      logo: '/logos/outlook.png',
      color: '#0078d4',
      description: 'Gestión de correos electrónicos y comunicación.',
      resources: [
        { title: '¿Qué es Outlook?', type: 'link', url: 'https://support.microsoft.com/es-es/office/-qu%C3%A9-es-outlook-10f1fa35-f33a-4cb7-838c-a7f3e6228b20' },
        { title: 'Crear y enviar correo electrónico', type: 'link', url: 'https://support.microsoft.com/es-es/office/crear-y-enviar-correo-electr%C3%B3nico-en-outlook-19c32deb-08b6-4f90-a211-02bc5f77f360' },
        { title: 'Bienvenid@ a tu bandeja de entrada', type: 'link', url: 'https://support.microsoft.com/es-es/office/le-damos-la-bienvenida-a-su-correo-electr%C3%B3nico-c6c261e3-d50a-43a6-816f-35fe1e53acc6' },
        { title: 'Crear, enviar y responder a un correo electrónico', type: 'link', url: 'https://support.microsoft.com/es-es/office/crear-y-responder-a-correos-electr%C3%B3nicos-af51a804-70f1-4fc1-a9f1-a568e7fd5d85' },
        { title: 'Crear una firma de correo electrónico', type: 'link', url: 'https://support.microsoft.com/es-es/office/crear-una-firma-de-correo-electr%C3%B3nico-a-partir-de-una-plantilla-5b02c5ed-1e85-4d2a-a098-9628fe3231d8' },
        { title: 'Plantilla Firma Corporativa Firplak', type: 'template', url: '/templates/Firma_de_correo_Firplak_2025.pptx' },
        { title: 'Enviar y recibir datos adjuntos', type: 'link', url: 'https://support.microsoft.com/es-es/office/enviar-y-recibir-datos-adjuntos-d32cd5ad-c7c5-49df-814d-4c17a5d3beb0' },
        { title: 'Reemplazar o recuperar un correo electrónico enviado', type: 'link', url: 'https://support.microsoft.com/es-es/office/recuerdos-o-reemplazar-un-correo-electr%C3%B3nico-enviado-en-outlook-8e564127-15a0-4cf6-b974-f2101f5e256e' },
        { title: 'Buscar y filtrar en el correo electrónico', type: 'link', url: 'https://support.microsoft.com/es-es/office/buscar-y-filtrar-correos-electr%C3%B3nicos-3e32b06d-a2d9-4a66-922f-78b77c41b97f' },
        { title: 'Organizar el correo electrónico mediante carpetas', type: 'link', url: 'https://support.microsoft.com/es-es/office/organizar-el-correo-electr%C3%B3nico-mediante-carpetas-en-outlook-0616c259-4bc1-4f35-807d-61eb59ac79c1' },
        { title: 'Limpiar la bandeja de entrada', type: 'link', url: 'https://support.microsoft.com/es-es/office/organizar-la-bandeja-de-entrada-con-archivo-limpiar-y-otras-herramientas-de-outlook-en-la-web-49b26f63-6399-4b4a-a580-14b9b1efe96d' },
        { title: 'Crear tareas y una lista de tareas pendientes', type: 'link', url: 'https://support.microsoft.com/es-es/office/asignar-y-realizar-un-seguimiento-de-tareas-en-la-versi%C3%B3n-cl%C3%A1sica-de-outlook-bcf25093-82f6-47f1-a7ec-cf9915186a99' },
        { title: 'Guardar correos de outlook en formato PDF', type: 'pdf', url: '/templates/GuardarCorreosDeOutlookEnFormatoPDF.pdf' },
        { title: 'Acuerdos Outlook', type: 'pdf', url: '/templates/Acuerdos_Outlook.pdf' },
        { title: 'Contenido completo de Formación en videos de Microsoft Outlook', type: 'link', url: 'https://support.microsoft.com/es-es/office/aprendizaje-de-outlook-8a5b816d-9052-4190-a5eb-494512343cca', isHidden: true },
      ],
      subSections: [
        {
          title: 'Calendario',
          description: 'Gestión de citas y reuniones.',
          resources: [
            { title: 'Le damos la bienvenida al calendario', type: 'link', url: 'https://support.microsoft.com/es-es/office/le-damos-la-bienvenida-al-calendario-de-outlook-6fb9225d-9f9d-456d-8c81-8437bfcd3ebf' },
            { title: 'Crear citas y reuniones', type: 'link', url: 'https://support.microsoft.com/es-es/office/crear-citas-y-reuniones-6e6ddec6-5983-4c42-9652-b99e120206fb' },
            { title: 'Buscar elementos de calendario', type: 'link', url: 'https://support.microsoft.com/es-es/office/buscar-elementos-de-calendario-en-outlook-11f6c52d-9a72-4bfb-9cd2-c1857156dc5b' },
            { title: 'Usar categorías y avisos de calendario', type: 'link', url: 'https://support.microsoft.com/es-es/office/usar-categor%C3%ADas-de-calendarios-y-avisos-en-outlook-59230c47-6fe9-46bd-8646-e1118e9eb973' },
            { title: 'Calendario Outlook', type: 'link', url: 'https://support.microsoft.com/es-es/office/le-damos-la-bienvenida-al-calendario-de-outlook-6fb9225d-9f9d-456d-8c81-8437bfcd3ebf', isHidden: true },
          ]
        }
      ]
    },
    {
      id: 'teams',
      title: 'Teams',
      icon: <Users />,
      logo: '/logos/teams.png',
      color: '#6264a7',
      resources: [
        { title: 'Secuencia de aprendizaje teams', type: 'download', url: '/templates/Microsoft-Teams-Educacion-Secuencia-de-Aprendizaje-SPA.pdf' },
        { title: 'Introducción a Teams', type: 'link', url: 'https://support.microsoft.com/es-es/office/v%C3%ADdeo-qu%C3%A9-es-microsoft-teams-422bf3aa-9ae8-46f1-83a2-e65720e1a34d' },
        { title: 'Iniciar sesión y comenzar a usar Teams', type: 'link', url: 'https://support.microsoft.com/es-es/office/iniciar-sesi%C3%B3n-y-comenzar-a-usar-teams-6723dc43-dbc0-46e6-af49-8a2d1c5cb937' },
        { title: 'Guardar y compartir archivos en Teams', type: 'link', url: 'https://support.microsoft.com/es-es/office/chatear-y-compartir-archivos-en-teams-d7978db0-33b5-4ad3-93ac-ef0bd3c2a670' },
        { title: 'Crear una publicación y darle formato', type: 'link', url: 'https://support.microsoft.com/es-es/office/crear-una-publicaci%C3%B3n-y-darle-formato-e66777da-636b-49eb-9408-b0d88b212885' },
        { title: 'Publicar un mensaje en varios canales', type: 'link', url: 'https://support.microsoft.com/es-es/office/publicar-un-mensaje-en-varios-canales-2cdaa17e-d548-46e7-907d-4e50b7e8f8b9' },
        { title: 'Cargar y compartir archivos', type: 'link', url: 'https://support.microsoft.com/es-es/office/cargar-y-compartir-archivos-57b669db-678e-424e-b0a0-15d19215cb12' },
        { title: 'Realizar llamadas', type: 'link', url: 'https://support.microsoft.com/es-es/office/realizar-una-llamada-en-microsoft-teams-gratis-6ea0bc65-f6bd-46ab-bd35-7ee5e2104e3a' },
        { title: 'Programar una reunión en línea', type: 'link', url: 'https://support.microsoft.com/es-es/office/programar-una-reuni%C3%B3n-en-microsoft-teams-943507a9-8583-4c58-b5d2-8ec8265e04e5' },
        { title: 'Unirse a una reunión en Teams', type: 'link', url: 'https://support.microsoft.com/es-es/office/unirse-a-una-reuni%C3%B3n-de-teams-078e9868-f1aa-4414-8bb9-ee88e9236ee4' },
        { title: 'Iniciar una reunión instantánea', type: 'link', url: 'https://support.microsoft.com/es-es/office/iniciar-una-reuni%C3%B3n-instant%C3%A1nea-en-microsoft-teams-ff95e53f-8231-4739-87fa-00b9723f4ef5' },
        { title: 'Mostrar la pantalla durante una reunión', type: 'link', url: 'https://support.microsoft.com/es-es/office/mostrar-la-pantalla-durante-una-reuni%C3%B3n-90c84e5a-b6fe-4ed4-9687-5923d230d3a7' },
        { title: 'Contenido completo Formación en video de Microsoft Teams', type: 'link', url: 'https://support.microsoft.com/es-es/office/formaci%c3%b3n-en-v%c3%addeo-de-microsoft-teams-4f108e54-240b-4351-8084-b1089f0d21d7?ui=es-ES&rs=es-CO&ad=CO', isHidden: true },
      ]
    },
    {
      id: 'planner',
      title: 'Planner',
      icon: <CheckSquare />,
      logo: '/logos/planner.png',
      color: '#31752f',
      resources: [
        { title: 'Generalidades de Planner', type: 'link', url: 'https://support.microsoft.com/es-es/office/introducci%C3%B3n-a-planner-en-teams-7a5e58f1-2cee-41b0-a41d-55d512c4a59c' },
        { title: 'Planear un evento en Planner', type: 'link', url: 'https://support.microsoft.com/es-es/office/planear-un-evento-en-microsoft-planner-1c38ad8d-9201-42de-8a7b-1e68fcef1769' },
        { title: 'Crear un plan con Planner en Teams', type: 'link', url: 'https://support.microsoft.com/es-es/office/crear-su-plan-en-microsoft-planner-6f358ec8-cc6c-4bd8-9ea3-27b7f4f9e525' },
        { title: 'Políticas de planner', type: 'video', url: 'https://jdtjtkncptwqdhlxmzds.supabase.co/storage/v1/object/public/videos/Politicas_de_planner.mp4' },
        { title: 'Buenas prácticas en Planner', type: 'video', url: 'https://jdtjtkncptwqdhlxmzds.supabase.co/storage/v1/object/public/videos/Buenas_Practicas_de_Uso_de_Planner.mp4' },
        { title: 'Aprendizaje en vídeo de Microsoft Planner', type: 'link', url: 'https://support.microsoft.com/es-es/office/aprendizaje-en-v%C3%ADdeo-de-microsoft-planner-4d71390f-08d8-4db0-84ea-92fb078687c7', isHidden: true },
        { title: 'Test de políticas de uso de planner', type: 'quiz', url: '/cursos/283c7f14-4c73-47df-a0be-ad8e19ab8c3a/evaluacion/fe3761db-ff07-4315-a7f6-aed6c1305c0e' },
      ]
    },
    {
      id: 'onedrive',
      title: 'OneDrive',
      icon: <Cloud />,
      logo: '/logos/onedrive.png',
      color: '#0078d4',
      description: 'En esta nube podrás almacenar todos tus archivos y demás información necesaria, la ventaja es que podrás sincronizarlo con cualquier dispositivo y acceder a ellos cuando lo necesites. Además te permite editar en equipo archivos en línea de manera segura.\n\n¡Da clic y conoce más beneficios de utilizar la nube!',
      resources: [
        { title: '¿Qué es OneDrive?', type: 'link', url: 'https://support.microsoft.com/es-es/office/v%C3%ADdeo-qu%C3%A9-es-onedrive-ffd8c365-e199-41e0-9d93-1a853e4baa38' },
        { title: 'Cargue, guarde archivos y carpetas en OneDrive', type: 'link', url: 'https://support.microsoft.com/es-es/office/-qu%C3%A9-es-onedrive-profesional-o-educativo-187f90af-056f-47c0-9656-cc0ddca7fdc2' },
        { title: 'Administrar archivos y carpetas', type: 'link', url: 'https://support.microsoft.com/es-es/office/administrar-archivos-y-carpetas-en-onedrive-20d7bb65-425a-4209-9b71-4cad046cfdc8' },
        { title: 'Colaborar en OneDrive', type: 'link', url: 'https://support.microsoft.com/es-es/office/colaborar-en-onedrive-586df57b-fdae-439c-ae5b-71cbe5bb0d4c' },
        { title: 'Eliminar o restaurar archivos de OneDrive', type: 'link', url: 'https://support.microsoft.com/es-es/office/restaurar-archivos-eliminados-o-carpetas-en-onedrive-949ada80-0026-4db3-a953-c99083e6a84f' },
        { title: 'Activar la copia de seguridad de OneDrive', type: 'link', url: 'https://support.microsoft.com/es-es/office/hacer-una-copia-de-seguridad-de-las-carpetas-con-onedrive-d61a7930-a6fb-4b95-b28a-6552e77c3057' },
        { title: 'Sincronizar archivos y carpetas', type: 'link', url: 'https://support.microsoft.com/es-es/office/elegir-qu%C3%A9-carpetas-de-onedrive-se-sincronizar%C3%A1n-con-su-equipo-98b8b011-8b94-419b-aa95-a14ff2415e85' },
        { title: 'Vídeo de aprendizaje de OneDrive', type: 'link', url: 'https://support.microsoft.com/es-es/office/v%C3%ADdeo-de-aprendizaje-de-onedrive-1f608184-b7e6-43ca-8753-2ff679203132', isHidden: true },
      ]
    },
    {
      id: 'sharepoint',
      title: 'Intranet y Sharepoint',
      icon: <Globe />,
      logo: '/logos/sharepoint.png',
      color: '#0078d4',
      description: '¡Gestiona, documenta tu trabajo y crea sitios web!\n\nEn esta biblioteca de documentación empresarial, podrás almacenar toda la información que consideres pertinente, necesaria y de uso público a nivel organizacional, de esta misma manera, lograrás visualizar la información de otras áreas de la empresa.',
      resources: [
        { title: '¿Qué es SharePoint?', type: 'link', url: 'https://support.microsoft.com/es-es/office/qu%C3%A9-es-sharepoint-97b915e6-651b-43b2-827d-fb25777f446f' },
        { title: 'Iniciar sesión en SharePoint', type: 'link', url: 'https://support.microsoft.com/es-es/office/iniciar-sesi%C3%B3n-en-sharepoint-324a89ec-e77b-4475-b64a-13a0c14c45ec' },
        { title: 'Descubrir información en SharePoint', type: 'link', url: 'https://support.microsoft.com/es-es/office/descubrir-informaci%C3%B3n-en-sharepoint-21722d7d-bcb1-4ee0-b86a-6c107bf646c7' },
        { title: 'Colaborar en SharePoint', type: 'link', url: 'https://support.microsoft.com/es-es/office/colaborar-en-sharepoint-0c5c3345-0a61-4532-971c-5a1e0970fde3' },
        { title: 'Crear un sitio en SharePoint', type: 'link', url: 'https://support.microsoft.com/es-es/office/crear-un-sitio-en-sharepoint-4d1e11bf-8ddc-499d-b889-2b48d10b1ce8' },
        { title: 'Buscar y seguir sitios y noticias', type: 'link', url: 'https://support.microsoft.com/es-es/office/buscar-y-seguir-sitios-noticias-y-contenido-4411e38f-9bc5-4ecc-bd33-3dbe939ac84c' },
        { title: 'Exportar a Excel desde SharePoint o listas', type: 'link', url: 'https://support.microsoft.com/es-es/office/exportar-a-excel-desde-sharepoint-o-listas-de-microsoft-bfb2ea48-6118-4fa9-abb6-cced9424e5d9' },
        { title: 'Vídeo de aprendizaje de SharePoint', type: 'link', url: 'https://support.microsoft.com/es-es/office/aprendizaje-en-v%C3%ADdeo-de-sharepoint-cb8ef501-84db-4427-ac77-ec2009fb8e23', isHidden: true },
      ]
    },
    {
      id: 'fpknet',
      title: 'FPKNET',
      icon: <Globe />,
      logo: '/logos/fpknet.png',
      color: '#1d6fb8',
      resources: [
        { title: 'Inducción portal fpknet', type: 'video', url: 'https://jdtjtkncptwqdhlxmzds.supabase.co/storage/v1/object/public/videos/Induccion_Portal_PFKnet.mp4' },
        { title: 'Mesa de ayuda en Freshdesk', type: 'video', url: 'https://jdtjtkncptwqdhlxmzds.supabase.co/storage/v1/object/public/videos/Mesa%20de%20ayuda%20en%20Freshdesk.mp4' },
      ]
    },
    {
      id: 'evaluacion',
      title: 'ACTIVIDAD EVALUATIVA',
      icon: <ClipboardList />,
      logo: '/logos/eval.png',
      color: '#eab308',
      resources: [
        { title: 'Creación de tarea en planner', type: 'upload', description: 'Por favor cree una tarea en planner donde asigne a una persona.\n\nDebes colocar título de la tarea, fecha de inicio y finalización, describir de qué se trata la tarea.\n\nTómele un pantallazo y adjunta la evidencia.' },
        { title: 'Herramientas colaborativas', type: 'quiz', url: '/cursos/283c7f14-4c73-47df-a0be-ad8e19ab8c3a/evaluacion/80e922db-35a1-43e5-8292-6d2c8fbab05e' },
      ]
    }
  ];

  const allVisibleResources = sections.flatMap(s => [
    ...s.resources.filter(r => !r.isHidden || isEditing),
    ...(s.subSections?.flatMap(sub => sub.resources.filter(r => !r.isHidden || isEditing)) || [])
  ]);

  const totalResources = allVisibleResources.length;
  const completedCount = allVisibleResources.filter(r => completedLessons.has(r.title)).length;

  const toggleSection = (id: string) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenResource = (resource: Resource) => {
    setSelectedResource(resource);
    setVideoFinished(false);
    if (resource.url) {
      const isDownloadable = resource.type === 'template' || resource.type === 'download' || resource.url.endsWith('.pptx');
      const isExternalLink = resource.url.includes('support.microsoft.com');
      if (isDownloadable || isExternalLink) window.open(resource.url, '_blank', 'noopener,noreferrer');
    }
  };

  if (!mounted) return null;

  // If no resource is selected, show the Course Outline (Landing Page)
  if (!selectedResource) {
    return (
      <div className={styles.container}>
        <div className={styles.banner}>
           <div className={styles.bannerContent}>
             <div className={styles.bannerText}>
               <span className={styles.categoryLabel}>FORMACIÓN CORPORATIVA</span>
               <h1>Herramientas Colaborativas</h1>
               <p>Domina el ecosistema de Microsoft 365 para optimizar tu trabajo en equipo.</p>
             </div>
             <div className={styles.bannerIllustration}>
               <div className={styles.rocketWrapper}>🚀</div>
             </div>
           </div>
        </div>

        <div className={styles.progressContainer}>
           <div className={styles.progressText}>
             Tu progreso: {completedCount} de {totalResources} lecciones completadas
           </div>
           <div className={styles.progressBar}>
             <div 
               className={styles.progressFill} 
               style={{ width: `${(completedCount / Math.max(1, totalResources)) * 100}%` }}
             />
           </div>
        </div>

        <div className={styles.sectionsList}>
          {sections.map((section, sIdx) => (
            <div key={sIdx} className={styles.outlineSection}>
               <button
                 className={styles.outlineSectionHeader}
                 style={{ borderLeftColor: section.color }}
                 onClick={() => toggleSection(section.id)}
               >
                 <div className={styles.outlineSectionTitle}>
                   <div className={styles.sectionIcon} style={{ color: section.color }}>{section.icon}</div>
                   <h2>{section.title}</h2>
                 </div>
                 <div className={styles.outlineSectionRight}>
                   {isEditing && <div className={styles.editLink}>Editar <ChevronDown size={14} /></div>}
                   {expandedSections[section.id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                 </div>
               </button>

              {expandedSections[section.id] && (
               <div className={styles.outlineResources}>
                 {section.description && (
                   <p className={styles.sectionDescription} style={{ padding: '0 2rem 1rem 3.5rem', color: '#475569', fontSize: '0.95rem', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                     {section.description}
                   </p>
                 )}
                 {section.resources.map((res, rIdx) => {
                   if (res.isHidden && !isEditing) return null;
                   const isCompleted = completedLessons.has(res.title);
                   const iconData = getResourceIcon(res.type);

                   return (
                     <div 
                       key={rIdx} 
                       className={styles.outlineResourceItem}
                       onClick={() => handleOpenResource(res)}
                     >
                       <div className={styles.outlineResourceLeft}>
                         <div className={styles.outlineIconBox} style={{ backgroundColor: iconData.bg }}>
                           {iconData.icon}
                         </div>
                         <span className={styles.outlineResourceTitle}>{res.title}</span>
                       </div>
                       <div className={styles.outlineResourceRight}>
                         {isEditing && <span className={styles.editLinkSmall}>Editar <ChevronDown size={12} /></span>}
                         {isCompleted ? (
                           <CheckCircle size={20} className={styles.completedIcon} />
                         ) : (
                           <div className={styles.pendingCircle} />
                         )}
                       </div>
                     </div>
                   );
                 })}

                 {section.subSections?.map((sub, subIdx) => (
                   <div key={subIdx} className={styles.outlineSubSection}>
                     <h3 className={styles.outlineSubTitle}>{sub.title}</h3>
                     {sub.resources.map((res, rIdx) => {
                        const isCompleted = completedLessons.has(res.title);
                        const iconData = getResourceIcon(res.type);
                        
                        if (res.isHidden && !isEditing) return null;

                        return (
                          <div 
                            key={rIdx} 
                            className={styles.outlineResourceItem}
                            onClick={() => handleOpenResource(res)}
                          >
                            <div className={styles.outlineResourceLeft}>
                              <div className={styles.outlineIconBox} style={{ backgroundColor: iconData.bg }}>
                                {iconData.icon}
                              </div>
                              <span className={styles.outlineResourceTitle}>{res.title}</span>
                            </div>
                            <div className={styles.outlineResourceRight}>
                              {isCompleted ? (
                                <CheckCircle size={20} className={styles.completedIcon} />
                              ) : (
                                <div className={styles.pendingCircle} />
                              )}
                            </div>
                          </div>
                        );
                     })}
                   </div>
                 ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // If a resource is selected, show the Player View
  return (
    <div className={styles.playerLayout}>
      {/* Main Content Area (Left) */}
      <div className={styles.mainContent}>
        <div className={styles.viewerContainer}>
           <div className={styles.viewerHeader}>
              <div className={styles.viewerTopBar}>
                <a href="/cursos" className={styles.dashboardLink}>
                  <ArrowLeft size={16} />
                  <span>Volver a Mis Cursos</span>
                </a>
                <button className={styles.backButton} onClick={() => setSelectedResource(null)}>
                  <span>Volver al contenido del curso</span>
                </button>
              </div>
              <div className={styles.viewerTitleInfo}>
                <div className={styles.iconBox} style={{ backgroundColor: getResourceIcon(selectedResource.type).bg }}>
                  {getResourceIcon(selectedResource.type).icon}
                </div>
                <div>
                  <h1 className={styles.viewerTitle}>{selectedResource.title}</h1>
                  <span className={styles.resourceTypeLabel}>{selectedResource.type || 'Documento'}</span>
                </div>
              </div>
           </div>

           <div className={styles.viewerBody}>
              {selectedResource.type === 'video' ? (
                <video 
                  key={selectedResource.url} 
                  controls 
                  className={styles.videoPlayer} 
                  autoPlay
                  onEnded={() => setVideoFinished(true)}
                >
                  <source src={selectedResource.url} type="video/mp4" />
                  Tu navegador no soporta el video.
                </video>
              ) : (selectedResource.type === 'template' || selectedResource.type === 'download' || selectedResource.url?.endsWith('.pptx') || selectedResource.url?.includes('support.microsoft.com')) ? (
                <div className={styles.downloadPlaceholder}>
                  {selectedResource.url?.includes('support.microsoft.com') ? (
                    <>
                      <ExternalLink size={64} />
                      <h2>Enlace Seguro de Microsoft</h2>
                      <p>Este recurso se ha abierto en una pestaña segura de Microsoft Support.</p>
                      <a href={selectedResource.url} target="_blank" rel="noopener noreferrer" className={styles.downloadBtnLarge}>
                        Abrir de nuevo
                      </a>
                    </>
                  ) : (
                    <>
                      <Download size={64} />
                      <h2>Archivo listo para descargar</h2>
                      <p>Este archivo no se puede previsualizar directamente.</p>
                      <a href={selectedResource.url} target="_blank" rel="noopener noreferrer" className={styles.downloadBtnLarge}>
                        Descargar archivo
                      </a>
                    </>
                  )}
                </div>
              ) : selectedResource.type === 'upload' ? (
                <UploadActivity
                  resource={selectedResource}
                  onComplete={(fileName) => onToggleComplete?.(selectedResource.title, { evidenceFileName: fileName })}
                  isCompleted={completedLessons.has(selectedResource.title)}
                />
              ) : selectedResource.type === 'quiz' && selectedResource.url ? (
                <div className={styles.emptyState}>
                  <ClipboardList size={64} style={{ marginBottom: '1rem', color: '#b09e7a' }} />
                  <h2>{selectedResource.title}</h2>
                  <p style={{ maxWidth: '600px', margin: '1rem auto', color: '#64748b' }}>
                    Esta es una actividad evaluativa. Al hacer clic en el botón de abajo, se abrirá una nueva pestaña para que puedas realizar el intento de evaluación.
                  </p>
                  <a href={selectedResource.url} target="_blank" rel="noreferrer" style={{ background: '#b09e7a', color: '#fff', padding: '12px 24px', borderRadius: '6px', textDecoration: 'none', display: 'inline-block', fontWeight: '500', marginTop: '1rem', transition: 'opacity 0.2s' }}>
                    Realizar intento
                  </a>
                </div>
              ) : selectedResource.url ? (
                <iframe 
                  key={selectedResource.url}
                  src={selectedResource.url} 
                  className={styles.iframe} 
                  title={selectedResource.title}
                />
              ) : (
                <div className={styles.emptyState}>
                  <HelpCircle size={64} />
                  <h2>Contenido en construcción</h2>
                  <p>Esta actividad estará disponible próximamente.</p>
                </div>
              )}
           </div>

           <div className={styles.viewerFooter}>
              {(!selectedResource.type || selectedResource.type !== 'video' || videoFinished || completedLessons.has(selectedResource.title)) && (
                <button 
                  className={`${styles.markCompleteBtn} ${completedLessons.has(selectedResource.title) ? styles.completed : ''}`}
                  onClick={() => onToggleComplete?.(selectedResource.title)}
                >
                  <CheckCircle size={18} />
                  {completedLessons.has(selectedResource.title) ? 'Completado' : 'Marcar como completado'}
                </button>
              )}
           </div>
        </div>
      </div>

      {/* Sidebar Area (Right) */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
           <div className={styles.categoryLabel}>FORMACIÓN CORPORATIVA</div>
           <h2 className={styles.courseTitle}>Herramientas Colaborativas</h2>
           
           <div className={styles.progressSection}>
             <div className={styles.progressText}>
               Progreso: {completedCount} de {totalResources}
             </div>
             <div className={styles.progressBar}>
               <div 
                 className={styles.progressFill} 
                 style={{ width: `${(completedCount / Math.max(1, totalResources)) * 100}%` }}
               />
             </div>
           </div>
        </div>

        <div className={styles.sidebarContent}>
          {sections.map((section, sIdx) => (
            <div key={sIdx} className={styles.sidebarSection}>
              <button 
                className={styles.sidebarSectionHeader}
                onClick={() => toggleSection(section.id)}
              >
                <div className={styles.sectionHeaderLeft}>
                  <div className={styles.sectionIcon} style={{ color: section.color }}>
                    {section.icon}
                  </div>
                  <span>{section.title}</span>
                </div>
                {expandedSections[section.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {expandedSections[section.id] && (
                <div className={styles.sidebarResources}>
                  {section.resources.map((res, rIdx) => {
                    const isActive = selectedResource?.title === res.title;
                    const isCompleted = completedLessons.has(res.title);
                    const iconData = getResourceIcon(res.type);
                    
                    if (res.isHidden && !isEditing) return null;

                    return (
                      <div 
                        key={rIdx} 
                        className={`${styles.sidebarResourceItem} ${isActive ? styles.active : ''}`}
                        onClick={() => handleOpenResource(res)}
                      >
                        <div className={styles.sidebarResourceLeft}>
                           <div className={styles.sidebarIconBox} style={{ backgroundColor: iconData.bg }}>
                             {iconData.icon}
                           </div>
                           <span className={styles.sidebarResourceTitle}>{res.title}</span>
                        </div>
                        {isCompleted && <CheckCircle size={16} className={styles.sidebarCheck} />}
                      </div>
                    );
                  })}

                  {section.subSections?.map((sub, subIdx) => (
                    <div key={subIdx} className={styles.sidebarSubSection}>
                       <div className={styles.sidebarSubTitle}>{sub.title}</div>
                       {sub.resources.map((res, rIdx) => {
                         const isActive = selectedResource?.title === res.title;
                         const isCompleted = completedLessons.has(res.title);
                         const iconData = getResourceIcon(res.type);

                         if (res.isHidden && !isEditing) return null;

                         return (
                           <div 
                             key={rIdx} 
                             className={`${styles.sidebarResourceItem} ${isActive ? styles.active : ''}`}
                             onClick={() => handleOpenResource(res)}
                           >
                             <div className={styles.sidebarResourceLeft}>
                                <div className={styles.sidebarIconBox} style={{ backgroundColor: iconData.bg }}>
                                  {iconData.icon}
                                </div>
                                <span className={styles.sidebarResourceTitle}>{res.title}</span>
                             </div>
                             {isCompleted && <CheckCircle size={16} className={styles.sidebarCheck} />}
                           </div>
                         );
                       })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
