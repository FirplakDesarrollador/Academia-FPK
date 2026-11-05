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

const DRY_RUN = !process.argv.includes('--apply');

async function fetchAllPages(table, selectCols, schema, filterFn) {
  let all = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    let q = schema ? supabaseAdmin.schema(schema).from(table) : supabaseAdmin.from(table);
    q = q.select(selectCols).range(from, from + pageSize - 1);
    if (filterFn) q = filterFn(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function main() {
  console.log(`Modo: ${DRY_RUN ? 'DRY RUN (sin escribir)' : 'EJECUCIÓN REAL'}`);

  const lecciones = await fetchAllPages('lecciones', 'id, nombre, tipo, contenido', 'academia', q => q.eq('tipo', 'evaluacion'));
  const realQCount = {};
  lecciones.forEach(l => {
    let preguntas = [];
    try {
      const cont = typeof l.contenido === 'string' ? JSON.parse(l.contenido) : l.contenido;
      preguntas = cont?.preguntas || [];
    } catch (e) {}
    realQCount[l.id] = preguntas.filter(p => p.tipo !== 'respuesta_abierta').length;
  });
  const leccionNombre = {};
  lecciones.forEach(l => { leccionNombre[l.id] = l.nombre; });

  const leccionIds = lecciones.map(l => l.id);
  const calificaciones = await fetchAllPages(
    'calificaciones',
    'id, leccion_id, puntuacion, puntuacion_maxima, usuario_id, curso_id',
    'academia',
    q => q.in('leccion_id', leccionIds)
  );

  // Agrupar por lección
  const byLeccion = {};
  calificaciones.forEach(c => {
    if (!byLeccion[c.leccion_id]) byLeccion[c.leccion_id] = [];
    byLeccion[c.leccion_id].push(c);
  });

  const plan = []; // { id, leccion, oldPuntuacion, oldMax, newPuntuacion, newMax }

  for (const [leccionId, rows] of Object.entries(byLeccion)) {
    // Moda del máximo EXCLUYENDO 100
    const freq = {};
    rows.forEach(r => {
      const m = Number(r.puntuacion_maxima);
      if (m !== 100) freq[m] = (freq[m] || 0) + 1;
    });
    let targetMax = null;
    let bestCount = 0;
    for (const [val, count] of Object.entries(freq)) {
      if (count > bestCount) { bestCount = count; targetMax = Number(val); }
    }
    if (targetMax === null) {
      // No hay ningún valor establecido distinto de 100: usamos el conteo real de
      // preguntas calificables de la lección actual, si existe.
      const q = realQCount[leccionId];
      if (q && q > 0) targetMax = q;
    }
    if (targetMax === null || targetMax === 100) continue; // nada que unificar

    rows.forEach(r => {
      const oldMax = Number(r.puntuacion_maxima);
      if (oldMax !== 100) return; // ya está en la escala correcta o es otra inconsistencia que no tocamos
      const oldPuntuacion = Number(r.puntuacion) || 0;
      const newPuntuacion = Math.round(((oldPuntuacion / 100) * targetMax) * 100) / 100;
      plan.push({
        id: r.id,
        leccion: leccionNombre[leccionId],
        leccionId,
        oldPuntuacion,
        oldMax,
        newPuntuacion,
        newMax: targetMax,
      });
    });
  }

  console.log('\nTotal de notas a convertir:', plan.length);
  const byLesson = {};
  plan.forEach(p => {
    if (!byLesson[p.leccion]) byLesson[p.leccion] = { count: 0, newMax: p.newMax };
    byLesson[p.leccion].count++;
  });
  console.log('Resumen por lección:');
  Object.entries(byLesson).forEach(([nombre, info]) => {
    console.log(`  - ${nombre}: ${info.count} notas -> nuevo máximo ${info.newMax}`);
  });

  console.log('\nMuestra de 10 conversiones:');
  console.log(JSON.stringify(plan.slice(0, 10), null, 2));

  fs.writeFileSync('scratch/conversion_plan.json', JSON.stringify(plan, null, 2));
  console.log('\nPlan completo guardado en scratch/conversion_plan.json');

  if (DRY_RUN) {
    console.log('\nDry run completo. Corre con --apply para ejecutar los cambios.');
    return;
  }

  let updated = 0, errors = 0;
  for (const p of plan) {
    const { error } = await supabaseAdmin
      .schema('academia')
      .from('calificaciones')
      .update({ puntuacion: p.newPuntuacion, puntuacion_maxima: p.newMax })
      .eq('id', p.id);
    if (error) { console.error('Error actualizando', p.id, error.message); errors++; }
    else updated++;
  }
  console.log('\nActualizadas:', updated, '| errores:', errors);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
