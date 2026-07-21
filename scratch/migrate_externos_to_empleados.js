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
  const { data: externos, error } = await supabaseAdmin
    .schema('academia').from('usuarios').select('*').eq('tipo', 'externo');
  if (error) throw new Error(error.message);

  console.log('Usuarios externos a migrar:', externos.length);

  for (const u of externos) {
    const cedula = parseInt(u.cedula, 10);
    if (!cedula) { console.error('Cedula invalida para', u.nombre_completo, u.cedula); continue; }

    const { data: existingEmp } = await supabaseAdmin.from('empleados').select('id').eq('id', cedula).maybeSingle();
    if (existingEmp) { console.error('Ya existe un empleado con esa cedula:', cedula, u.nombre_completo); continue; }

    const { error: insertErr } = await supabaseAdmin.from('empleados').insert({
      id: cedula,
      nombreCompleto: u.nombre_completo,
      cargo: u.cargo,
      empresa: 'Firplak',
      activo: true,
      correo_electronico: u.email_visible,
      correo_personal: u.email_visible,
    });
    if (insertErr) { console.error('Error creando empleado para', u.nombre_completo, insertErr.message); continue; }

    const { error: updateErr } = await supabaseAdmin
      .schema('academia').from('usuarios')
      .update({ empleado_id: cedula, tipo: 'empleado' })
      .eq('id', u.id);
    if (updateErr) { console.error('Error vinculando usuario para', u.nombre_completo, updateErr.message); continue; }

    console.log('Migrado:', u.nombre_completo, '-> empleado', cedula);
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
