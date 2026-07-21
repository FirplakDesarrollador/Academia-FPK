-- Tabla para guardar notas de personas del archivo que NO se pudieron
-- relacionar con ningún empleado/usuario existente en la plataforma.
-- Son solo para consulta administrativa (no aparecen para ningún login).

create table if not exists academia.calificaciones_sin_relacionar (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references academia.cursos(id) on delete cascade,
  leccion_id uuid not null references academia.lecciones(id) on delete cascade,
  nombre text not null,
  apellidos text not null,
  correo text,
  cedula text,
  puntuacion numeric,
  puntuacion_maxima numeric,
  estado text default 'Calificado',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_calificaciones_sin_relacionar_curso
  on academia.calificaciones_sin_relacionar (curso_id);
