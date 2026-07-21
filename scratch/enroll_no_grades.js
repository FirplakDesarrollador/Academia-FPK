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
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const csv = fs.readFileSync('Calificaciones/reportes/personas_sin_notas.csv', 'utf8');
  const lines = csv.split('\n').filter(Boolean).slice(1);

  // very small CSV parser matching the fields we generated (no embedded commas expected except quoted)
  const rows = lines.map(line => {
    const cells = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQuotes = !inQuotes; continue; }
      if (c === ',' && !inQuotes) { cells.push(cur); cur = ''; continue; }
      cur += c;
    }
    cells.push(cur);
    return cells;
  });

  const empleadoIds = [...new Set(rows.map(r => r[5]).filter(id => id && id.trim() !== ''))].map(Number);
  console.log('Empleados reales identificados (unicos):', empleadoIds.length);
  console.log(`Modo: ${DRY_RUN ? 'DRY RUN' : 'EJECUCIÓN REAL'}`);

  if (DRY_RUN) return;

  const { data: emps, error: empErr } = await supabaseAdmin.from('empleados').select('id, nombreCompleto, correo_personal, correo_electronico').in('id', empleadoIds);
  if (empErr) throw new Error(empErr.message);

  const { data: existingUsuarios } = await supabaseAdmin.schema('academia').from('usuarios').select('id, empleado_id').in('empleado_id', empleadoIds);
  const linkedIds = new Set((existingUsuarios || []).map(u => u.empleado_id));

  const { data: roleData, error: roleErr } = await supabaseAdmin.schema('academia').from('roles').select('id').eq('nombre', 'OPERARIO').single();
  if (roleErr) throw new Error('rol: ' + roleErr.message);
  const OPERARIO_ROLE_ID = roleData.id;

  // preload auth emails to avoid the shared-email collision bug
  const authByEmail = new Map();
  {
    let page = 1;
    while (true) {
      const { data: authPage, error: authListErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (authListErr) throw new Error('listUsers: ' + authListErr.message);
      if (!authPage || !authPage.users || authPage.users.length === 0) break;
      authPage.users.forEach(u => { if (u.email) authByEmail.set(u.email.toLowerCase(), u.id); });
      if (authPage.users.length < 1000) break;
      page++;
    }
  }
  const idToEmpleadoId = new Map();
  (existingUsuarios || []).forEach(u => { if (u.empleado_id) idToEmpleadoId.set(u.id, u.empleado_id); });

  let created = 0, alreadyHad = 0, errors = [];
  for (const emp of emps) {
    if (linkedIds.has(emp.id)) { alreadyHad++; continue; }

    let finalEmail = (emp.correo_personal || emp.correo_electronico || '').trim();
    if (!EMAIL_RE.test(finalEmail)) finalEmail = `${emp.id}@academia.local`;
    const claimedByAuthId = authByEmail.get(finalEmail.toLowerCase());
    if (claimedByAuthId) {
      const claimedByEmpleadoId = idToEmpleadoId.get(claimedByAuthId);
      if (claimedByEmpleadoId && claimedByEmpleadoId !== emp.id) finalEmail = `${emp.id}@academia.local`;
    }

    try {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: finalEmail,
        password: String(emp.id),
        email_confirm: true,
        user_metadata: { rol: 'OPERARIO' },
      });

      let userId;
      if (authError) {
        if (authError.message.toLowerCase().includes('already') || authError.message.toLowerCase().includes('registered')) {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
          const found = listData.users.find(u => u.email?.toLowerCase() === finalEmail.toLowerCase());
          if (!found) { errors.push({ emp: emp.id, error: authError.message }); continue; }
          userId = found.id;
        } else {
          errors.push({ emp: emp.id, error: authError.message });
          continue;
        }
      } else {
        userId = authData.user.id;
      }

      const { error: linkError } = await supabaseAdmin
        .schema('academia').from('usuarios')
        .upsert({ id: userId, empleado_id: emp.id, rol_id: OPERARIO_ROLE_ID }, { onConflict: 'empleado_id' });
      if (linkError) { errors.push({ emp: emp.id, error: 'link: ' + linkError.message }); continue; }

      created++;
      authByEmail.set(finalEmail.toLowerCase(), userId);
      idToEmpleadoId.set(userId, emp.id);
    } catch (err) {
      errors.push({ emp: emp.id, error: err.message || String(err) });
    }
  }

  console.log('Cuentas nuevas creadas:', created);
  console.log('Ya tenían cuenta:', alreadyHad);
  if (errors.length) console.log('Errores:', JSON.stringify(errors, null, 2));
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
