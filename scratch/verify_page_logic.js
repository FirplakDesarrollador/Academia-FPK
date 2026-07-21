const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf8');
envContent.split('\n').forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const CURSO_ID = '86eb9037-31d0-4914-bb03-56cabdf51229';

async function main() {
  // Use admin client since anon key is likely RLS-restricted the same way an authenticated admin session would be after login;
  // this just validates the query/merge logic, not RLS itself.
  const { data: usersData, error: usersError } = await supabaseAdmin.schema('academia').from('usuarios').select('id, empleado_id').limit(100000);
  if (usersError) throw usersError;
  const mappedIds = usersData.map(u => u.empleado_id).filter(Boolean);

  const { data: empsData } = await supabaseAdmin.from('empleados').select('id, nombreCompleto').in('id', mappedIds);
  const empsLookup = {};
  empsData.forEach(e => empsLookup[e.id] = e);

  const mappedUsers = usersData.map(u => {
    const emp = empsLookup[u.empleado_id];
    const partes = (emp?.nombreCompleto || 'Usuario Desconocido').trim().split(/\s+/);
    return { usuario_id: u.id, nombres: partes.slice(0, 2).join(' '), apellidos: partes.slice(2).join(' ') || '.', cedula: String(u.empleado_id) };
  });

  const { data: sinRelData, error: sinRelError } = await supabaseAdmin
    .schema('academia').from('calificaciones_sin_relacionar')
    .select('id, leccion_id, nombre, apellidos, correo, cedula, puntuacion, puntuacion_maxima')
    .eq('curso_id', CURSO_ID);
  if (sinRelError) throw sinRelError;

  const sinRelUsersMap = new Map();
  const lookup = {};
  sinRelData.forEach(r => {
    const key = `sr_${(r.nombre + '_' + r.apellidos + '_' + (r.correo || '')).toLowerCase().replace(/\s+/g, '_')}`;
    if (!sinRelUsersMap.has(key)) {
      sinRelUsersMap.set(key, { usuario_id: key, nombres: r.nombre, apellidos: r.apellidos, cedula: r.cedula || '', origen: 'sin_relacionar' });
    }
    lookup[`${key}_${r.leccion_id}`] = { id: r.id, puntuacion: r.puntuacion, puntuacion_maxima: r.puntuacion_maxima };
  });

  const sinRelUsers = Array.from(sinRelUsersMap.values());
  const allUsers = [...mappedUsers, ...sinRelUsers].sort((a, b) => `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`));

  console.log('Total usuarios relacionados (empleados):', mappedUsers.length);
  console.log('Total personas sin relacionar (sintéticas):', sinRelUsers.length);
  console.log('Total combinado en tabla:', allUsers.length);

  // check for key collisions between real usuario_id (uuid) and synthetic sr_ keys
  const collision = mappedUsers.find(u => sinRelUsersMap.has(u.usuario_id));
  console.log('Colisión de claves usuario_id vs sr_:', collision ? JSON.stringify(collision) : 'ninguna');

  // sample a few combined rows around alphabetical order to eyeball interleaving
  const sampleIdx = allUsers.findIndex(u => u.origen === 'sin_relacionar');
  console.log('Primer "sin relacionar" en el orden alfabético combinado, índice', sampleIdx, JSON.stringify(allUsers.slice(Math.max(0, sampleIdx - 2), sampleIdx + 3), null, 2));

  // verify grade lookup works for one sin_relacionar user with 3 lessons
  const target = sinRelUsers[0];
  const grades = Object.keys(lookup).filter(k => k.startsWith(target.usuario_id + '_'));
  console.log('Notas encontradas para', target.nombres, target.apellidos, ':', grades.map(k => lookup[k]));
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
