const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf8');
envContent.split('\n').forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
});
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: usuarios, error } = await supabaseAdmin
    .schema('academia').from('usuarios')
    .select('id, empleado_id, nombre_completo')
    .eq('tipo', 'empleado')
    .is('nombre_completo', null)
    .not('empleado_id', 'is', null);
  if (error) throw new Error(error.message);

  console.log('Usuarios tipo empleado sin nombre_completo:', usuarios.length);

  const empleadoIds = usuarios.map(u => u.empleado_id);
  const { data: emps, error: empErr } = await supabaseAdmin
    .from('empleados').select('id, nombreCompleto').in('id', empleadoIds);
  if (empErr) throw new Error(empErr.message);

  const empById = new Map(emps.map(e => [e.id, e.nombreCompleto]));

  let updated = 0, skipped = 0;
  for (const u of usuarios) {
    const nombre = empById.get(u.empleado_id);
    if (!nombre) { skipped++; continue; }
    const { error: updErr } = await supabaseAdmin
      .schema('academia').from('usuarios')
      .update({ nombre_completo: nombre.trim() })
      .eq('id', u.id);
    if (updErr) { console.error('error actualizando', u.id, updErr.message); continue; }
    updated++;
  }

  console.log('Actualizados:', updated, '| sin empleado encontrado:', skipped);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
