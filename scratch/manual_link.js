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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Manually confirmed matches (by the course admin), not auto-detected — avoids the
// false-positive risk of fuzzy-matching across the whole company directory.
const TARGETS = [
  { empleadoId: 1037638203, correoFilter: 'camilajimenez8a@gmail.com', label: 'Maria Camila Jiménez -> Maria Camila Jiménez Ochoa' },
  { empleadoId: 4574385, correoFilter: 'johanser24@gmail.com', label: 'Johanser Sthormes -> Johanser Manuel Sthormes Olivares' },
];

async function main() {
  const { data: roleData, error: roleErr } = await supabaseAdmin
    .schema('academia').from('roles').select('id').eq('nombre', 'OPERARIO').single();
  if (roleErr) throw new Error('rol: ' + roleErr.message);
  const OPERARIO_ROLE_ID = roleData.id;

  for (const t of TARGETS) {
    console.log(`\n=== ${t.label} ===`);
    const { data: emp, error: empErr } = await supabaseAdmin.from('empleados').select('id, nombreCompleto, correo_personal, correo_electronico').eq('id', t.empleadoId).single();
    if (empErr) { console.error('empleado no encontrado:', empErr.message); continue; }

    let { data: usr } = await supabaseAdmin.schema('academia').from('usuarios').select('*').eq('empleado_id', t.empleadoId).maybeSingle();
    let userId = usr?.id;

    if (!userId) {
      let finalEmail = (emp.correo_personal || emp.correo_electronico || '').trim();
      if (!EMAIL_RE.test(finalEmail)) finalEmail = `${emp.id}@academia.local`;

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: finalEmail,
        password: String(emp.id),
        email_confirm: true,
        user_metadata: { rol: 'OPERARIO' },
      });

      if (authError) {
        if (authError.message.toLowerCase().includes('already') || authError.message.toLowerCase().includes('registered')) {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
          const found = listData.users.find(u => u.email?.toLowerCase() === finalEmail.toLowerCase());
          if (!found) { console.error('auth ya existe pero no se encontró en listUsers'); continue; }
          userId = found.id;
        } else {
          console.error('error creando cuenta:', authError.message);
          continue;
        }
      } else {
        userId = authData.user.id;
      }

      const { error: linkError } = await supabaseAdmin
        .schema('academia').from('usuarios')
        .upsert({ id: userId, empleado_id: emp.id, rol_id: OPERARIO_ROLE_ID }, { onConflict: 'empleado_id' });
      if (linkError) { console.error('error vinculando:', linkError.message); continue; }
      console.log('Cuenta creada:', userId, 'email:', finalEmail);
    } else {
      console.log('Ya tenía cuenta:', userId);
    }

    const { data: srRows, error: srErr } = await supabaseAdmin
      .schema('academia').from('calificaciones_sin_relacionar')
      .select('*').ilike('correo', t.correoFilter);
    if (srErr) { console.error('error leyendo sin_relacionar:', srErr.message); continue; }
    console.log('Filas sin_relacionar encontradas:', srRows.length);

    for (const row of srRows) {
      const { error: upsertErr } = await supabaseAdmin
        .schema('academia').from('calificaciones')
        .upsert({
          usuario_id: userId,
          leccion_id: row.leccion_id,
          curso_id: row.curso_id,
          puntuacion: row.puntuacion,
          puntuacion_maxima: row.puntuacion_maxima,
          estado: row.estado,
        }, { onConflict: 'usuario_id, leccion_id' });
      if (upsertErr) { console.error('error insertando calificacion:', upsertErr.message); continue; }

      const { error: delErr } = await supabaseAdmin
        .schema('academia').from('calificaciones_sin_relacionar')
        .delete().eq('id', row.id);
      if (delErr) console.error('error borrando sin_relacionar:', delErr.message);
    }
    console.log('Migradas', srRows.length, 'notas a la cuenta real.');
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
