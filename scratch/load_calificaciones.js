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

const CURSO_ID = '86eb9037-31d0-4914-bb03-56cabdf51229'; // INDUCCIÓN VIRTUAL
const LECCIONES = [
  { id: 'f08f6085-17ff-4459-9c5d-df508d2dd9af', max: 10, col: 6 },  // Evaluación Inducción
  { id: '87622cc7-fc15-4a74-9bba-9af426fa954d', max: 10, col: 7 },  // Evaluación Inducción SST
  { id: '396c66ad-5741-4721-89bd-3a2dd18b952f', max: 5, col: 8 },   // Evaluacion Sagrilaft y PTEE
];
// const CURSO_ID = '283c7f14-4c73-47df-a0be-ad8e19ab8c3a'; // Herramientas Colaborativas Firplak
// const LECCIONES = [
//   { id: '80e922db-35a1-43e5-8292-6d2c8fbab05e', max: 10, col: 7 },  // Herramientas colaborativas
//   { id: 'fe3761db-ff07-4315-a7f6-aed6c1305c0e', max: 100, col: 8 }, // Test de políticas de uso de planner
// ];

const DRY_RUN = process.argv.includes('--dry-run');

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}
function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length, 1);
  return 1 - levenshtein(a, b) / maxLen;
}
function bestSim(token, otherTokens) {
  return otherTokens.length ? Math.max(...otherTokens.map(t => similarity(token, t))) : 0;
}

// Rejects an email match when the file's name shares nothing plausible with the matched
// empleado's real name (using fuzzy token similarity, tolerant of common spelling variants
// like Jhoan/Johan or Yennifer/Jennifer). Catches shared/departmental mailboxes (e.g.
// talentos@firplak.com, comercial@firplak.com) registered under one employee's personal email
// but used by someone else entirely when signing up for the course — which would otherwise
// silently misattribute grades to the wrong person.
function isPlausibleNameMatch(nombre, apellido, empNombreCompleto) {
  const empTokens = normalize(empNombreCompleto).split(' ').filter(t => t.length >= 2);
  if (empTokens.length === 0) return false;
  const nombreTokens = normalize(nombre).split(' ').filter(t => t.length >= 3);
  const apellidoTokens = normalize(apellido).split(' ').filter(t => t.length >= 3);
  const nombreOk = nombreTokens.length === 0 || nombreTokens.some(t => bestSim(t, empTokens) >= 0.65);
  const apellidoOk = apellidoTokens.length === 0 || apellidoTokens.some(t => bestSim(t, empTokens) >= 0.65);
  if (nombreOk && apellidoOk) return true;

  // Fallback for names stored without spaces between words (e.g. "OquendoGonzález" in
  // empleados vs "Oquendo González" in the file): compare the whole names as continuous
  // strings so a missing space doesn't break tokenization for an otherwise-identical name.
  const fileWhole = normalize(`${nombre}${apellido}`).replace(/\s+/g, '');
  const empWhole = normalize(empNombreCompleto).replace(/\s+/g, '');
  return similarity(fileWhole, empWhole) >= 0.8;
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

  const idToEmpleadoId = new Map();
  existingUsuarios.forEach(u => { if (u.empleado_id) idToEmpleadoId.set(u.id, u.empleado_id); });

  // Some empleados share the exact same email in the empleados table itself (e.g. two people
  // both have "comercial@firplak.com" registered as their personal email). Preload all auth
  // users once so we can detect when an email is already claimed by a DIFFERENT empleado's
  // account before trying to create/link one — avoids a primary-key collision on academia.usuarios.
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
  console.log('Cuentas de auth precargadas:', authByEmail.size);

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
    let rejectedSharedEmail = false;
    if (emp && !isPlausibleNameMatch(nombre, apellido, emp.nombreCompleto)) {
      rejectedSharedEmail = true;
      emp = null;
    }
    if (!emp && cedulaFile) emp = byCedula.get(cedulaFile);
    if (!emp) {
      const fullName = normalize(`${nombre} ${apellido}`);
      const nameMatches = byName.get(fullName);
      if (nameMatches && nameMatches.length === 1) emp = nameMatches[0];
    }
    if (emp) {
      matched.push({ emp, nombre, apellido, correo, cedulaFile, notas });
    } else {
      unmatched.push({ nombre, apellido, correo, cedulaFile, notas, rejectedSharedEmail });
    }
  });

  const matchedWithGrades = matched.filter(m => m.notas.some(n => n !== null));
  const unmatchedWithGrades = unmatched.filter(m => m.notas.some(n => n !== null));
  const needsNewAccount = matchedWithGrades.filter(m => !usuarioByEmpleadoId.has(m.emp.id));
  const rejectedSharedEmailWithGrades = unmatchedWithGrades.filter(m => m.rejectedSharedEmail);
  if (rejectedSharedEmailWithGrades.length) {
    console.log('Rechazados por correo compartido/departamental (con nota, irán a sin_relacionar):', JSON.stringify(rejectedSharedEmailWithGrades.map(m => ({ nombre: m.nombre, apellido: m.apellido, correo: m.correo })), null, 2));
  }

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

      // If this email is already claimed by a DIFFERENT empleado's account (two empleados
      // sharing the same generic/departmental email in the empleados table), fall back to a
      // synthetic per-empleado email instead of colliding with the other person's account.
      const claimedByAuthId = authByEmail.get(finalEmail.toLowerCase());
      if (claimedByAuthId) {
        const claimedByEmpleadoId = idToEmpleadoId.get(claimedByAuthId);
        if (claimedByEmpleadoId && claimedByEmpleadoId !== m.emp.id) {
          finalEmail = `${m.emp.id}@academia.local`;
        }
      }

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
