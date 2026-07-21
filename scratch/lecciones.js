const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf8');
envContent.split('\n').forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
});
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const cursoId = '86eb9037-31d0-4914-bb03-56cabdf51229';

  const { data: lecciones, error } = await supabaseAdmin
    .schema('academia')
    .from('lecciones')
    .select('id, nombre, orden, tipo, modulos!inner(curso_id, orden, nombre)')
    .eq('modulos.curso_id', cursoId);
  console.log('LECCIONES:', JSON.stringify(lecciones, null, 2), error);

  const { count } = await supabaseAdmin
    .schema('academia')
    .from('calificaciones')
    .select('*', { count: 'exact', head: true })
    .eq('curso_id', cursoId);
  console.log('EXISTING CALIFICACIONES COUNT for curso:', count);

  const { data: inscripciones, error: insErr, count: insCount } = await supabaseAdmin
    .schema('academia')
    .from('inscripciones')
    .select('*', { count: 'exact' })
    .eq('curso_id', cursoId)
    .limit(1);
  console.log('INSCRIPCIONES sample:', JSON.stringify(inscripciones, null, 2), 'count:', insCount, insErr);
}

main();
