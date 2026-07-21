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

const CURSO_ID = '283c7f14-4c73-47df-a0be-ad8e19ab8c3a'; // Herramientas Colaborativas Firplak
const LECCIONES = [
  { id: '80e922db-35a1-43e5-8292-6d2c8fbab05e', max: 10, col: 7 },  // Herramientas colaborativas
  { id: 'fe3761db-ff07-4315-a7f6-aed6c1305c0e', max: 100, col: 8 }, // Test de políticas de uso de planner
];

const DRY_RUN = process.argv.includes('--dry-run');

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function withRetry(fn, label, retries = 4) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

function parseScore(v) {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  if (t === '' || t === '-') return null;
  const n = parseFloat(t.replace(',', '.'));
  return isNaN(n) ? null : n;
}

async function fetchAllPages(table, selectCols, schema) {
  let all = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    let q = schema ? supabaseAdmin.schema(schema).from(table) : supabaseAdmin.from(table);
    const { data, error } = await q.select(selectCols).range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function main() {
  const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const data = rows.slice(1);

  console.log(`Modo: ${DRY_RUN ? 'DRY RUN (sin escribir)' : 'EJECUCIÓN REAL'}`);

  const allEmps = await fetchAllPages('empleados', 'id, nombreCompleto, correo_personal, correo_electronico');
  console.log('Empleados cargados:', allEmps.length);

  const existingUsuarios = await fetchAllPages('usuarios', 'id, empleado_id', 'academia');
  console.log('Usuarios existentes (academia.usuarios):', existingUsuarios.length);

  const { data: roleData, error: roleErr } = await supabaseAdmin
    .schema('academia').from('roles').select('id').eq('nombre', 'OPERARIO').single();
  if (roleErr) throw new Error('No se pudo obtener rol OPERARIO: ' + roleErr.message);
  const OPERARIO_ROLE_ID = roleData.id;

  const byEmail = new Map();
  const byName = new Map();
  const byCedula = new Map();
  allEmps.forEach(e => {
    const n = normalize(e.nombreCompleto);
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n).push(e);
    [e.correo_personal, e.correo_electronico].forEach(email => {
      if (email && email.trim()) byEmail.set(email.toLowerCase().trim(), e);
    });
    byCedula.set(String(e.id), e);
  });

  const usuarioByEmpleadoId = new Map();
  existingUsuarios.forEach(u => {
    if (u.empleado_id) usuarioByEmpleadoId.set(u.empleado_id, u.id);
  });

  // Classify every row
  const matched = []; // { emp, nombre, apellido, correo, cedulaFile, notas: [n1,n2,n3] }
  const unmatched = [];

  data.forEach(r => {
    const nombre = (r[0] || '').trim();
    const apellido = (r[1] || '').trim();
    const cedulaFile = (r[2] || '').trim();
    const correo = (r[5] || '').trim();
    const notas = LECCIONES.map(l => parseScore(r[l.col]));

    const emailNorm = correo.toLowerCase();
    let emp = emailNorm ? byEmail.get(emailNorm) : null;
    if (!emp && cedulaFile) emp = byCedula.get(cedulaFile);
    if (!emp) {
      const fullName = normalize(`${nombre} ${apellido}`);
      const nameMatches = byName.get(fullName);
      if (nameMatches && nameMatches.length === 1) emp = nameMatches[0];
    }

    if (emp) {
      matched.push({ emp, nombre, apellido, correo, cedulaFile, notas });
    } else {
      unmatched.push({ nombre, apellido, correo, cedulaFile, notas });
    }
  });

  const matchedWithGrades = matched.filter(m => m.notas.some(n => n !== null));
  const unmatchedWithGrades = unmatched.filter(m => m.notas.some(n => n !== null));
  const needsNewAccount = matchedWithGrades.filter(m => !usuarioByEmpleadoId.has(m.emp.id));

  console.log('--- RESUMEN ---');
  console.log('Total filas archivo:', data.length);
  console.log('Emparejados con empleado:', matched.length, ' | con al menos una nota:', matchedWithGrades.length);
  console.log('No emparejados:', unmatched.length, ' | con al menos una nota:', unmatchedWithGrades.length);
  console.log('Emparejados que necesitan cuenta nueva (academia.usuarios):', needsNewAccount.length);

  if (DRY_RUN) {
    console.log('\nDry run completo, no se escribió nada.');
    return;
  }

  // 1. Delete existing grades for THIS COURSE, scoped to only the lecciones this file covers
  //    (other graded lecciones of the same course, not present in this file, are left untouched)
  const leccionIds = LECCIONES.map(l => l.id);
  const { error: delErr1, count: delCount1 } = await supabaseAdmin
    .schema('academia').from('calificaciones').delete({ count: 'exact' }).eq('curso_id', CURSO_ID).in('leccion_id', leccionIds);
  console.log('Borradas calificaciones existentes (solo lecciones del archivo):', delCount1, delErr1);

  const { error: delErr2, count: delCount2 } = await supabaseAdmin
    .schema('academia').from('calificaciones_sin_relacionar').delete({ count: 'exact' }).eq('curso_id', CURSO_ID).in('leccion_id', leccionIds);
  console.log('Borradas calificaciones_sin_relacionar existentes (solo lecciones del archivo):', delCount2, delErr2);

  // 2. Process matched-with-grades: ensure account, insert grades
  let createdAccounts = 0, linkedGrades = 0, accountErrors = [];
  for (const m of matchedWithGrades) {
    let userId = usuarioByEmpleadoId.get(m.emp.id);

    if (!userId) {
      let finalEmail = (m.emp.correo_personal || m.emp.correo_electronico || '').trim();
      if (!EMAIL_RE.test(finalEmail)) finalEmail = `${m.emp.id}@academia.local`;

      try {
        const { data: authData, error: authError } = await withRetry(
          () => supabaseAdmin.auth.admin.createUser({
            email: finalEmail,
            password: String(m.emp.id),
            email_confirm: true,
            user_metadata: { rol: 'OPERARIO' },
          }),
          'createUser'
        );

        if (authError) {
          if (authError.message.toLowerCase().includes('already') || authError.message.toLowerCase().includes('registered')) {
            const { data: listData } = await withRetry(() => supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }), 'listUsers');
            const found = listData.users.find(u => u.email?.toLowerCase() === finalEmail.toLowerCase());
            if (found) userId = found.id;
            else { accountErrors.push({ emp: m.emp.id, error: authError.message }); continue; }
          } else {
            accountErrors.push({ emp: m.emp.id, error: authError.message });
            continue;
          }
        } else {
          userId = authData.user.id;
        }

        const { error: linkError } = await withRetry(() => supabaseAdmin
          .schema('academia').from('usuarios')
          .upsert({ id: userId, empleado_id: m.emp.id, rol_id: OPERARIO_ROLE_ID }, { onConflict: 'empleado_id' }), 'linkUsuario');

        if (linkError) { accountErrors.push({ emp: m.emp.id, error: 'link: ' + linkError.message }); continue; }

        usuarioByEmpleadoId.set(m.emp.id, userId);
        createdAccounts++;
      } catch (err) {
        accountErrors.push({ emp: m.emp.id, error: 'account: ' + (err.message || String(err)) });
        continue;
      }
    }

    for (let i = 0; i < LECCIONES.length; i++) {
      const score = m.notas[i];
      if (score === null) continue;
      try {
        const { error: gradeErr } = await withRetry(() => supabaseAdmin
          .schema('academia').from('calificaciones')
          .upsert({
            usuario_id: userId,
            leccion_id: LECCIONES[i].id,
            curso_id: CURSO_ID,
            puntuacion: score,
            puntuacion_maxima: LECCIONES[i].max,
            estado: 'Calificado',
          }, { onConflict: 'usuario_id, leccion_id' }), 'gradeUpsert');
        if (gradeErr) accountErrors.push({ emp: m.emp.id, leccion: LECCIONES[i].id, error: gradeErr.message });
        else linkedGrades++;
      } catch (err) {
        accountErrors.push({ emp: m.emp.id, leccion: LECCIONES[i].id, error: err.message || String(err) });
      }
    }
  }

  console.log('Cuentas nuevas creadas:', createdAccounts);
  console.log('Notas insertadas (relacionadas):', linkedGrades);
  if (accountErrors.length) console.log('Errores (relacionados):', JSON.stringify(accountErrors.slice(0, 20), null, 2), '... total:', accountErrors.length);

  // 3. Insert unmatched-with-grades into calificaciones_sin_relacionar
  let unlinkedGrades = 0, unlinkedErrors = [];
  for (const u of unmatchedWithGrades) {
    for (let i = 0; i < LECCIONES.length; i++) {
      const score = u.notas[i];
      if (score === null) continue;
      try {
        const { error } = await withRetry(() => supabaseAdmin
          .schema('academia').from('calificaciones_sin_relacionar')
          .insert({
            curso_id: CURSO_ID,
            leccion_id: LECCIONES[i].id,
            nombre: u.nombre,
            apellidos: u.apellido,
            correo: u.correo || null,
            cedula: u.cedulaFile || null,
            puntuacion: score,
            puntuacion_maxima: LECCIONES[i].max,
            estado: 'Calificado',
          }), 'sinRelacionarInsert');
        if (error) unlinkedErrors.push({ nombre: u.nombre, apellido: u.apellido, error: error.message });
        else unlinkedGrades++;
      } catch (err) {
        unlinkedErrors.push({ nombre: u.nombre, apellido: u.apellido, error: err.message || String(err) });
      }
    }
  }

  console.log('Notas insertadas (sin relacionar):', unlinkedGrades);
  if (unlinkedErrors.length) console.log('Errores (sin relacionar):', JSON.stringify(unlinkedErrors.slice(0, 20), null, 2), '... total:', unlinkedErrors.length);

  console.log('\n=== COMPLETADO ===');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
