const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf8');
envContent.split('\n').forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
});
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
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
  const allEmps = await fetchAllPages('empleados', 'id, nombreCompleto, correo_personal, correo_electronico');
  const byEmail = new Map();
  allEmps.forEach(e => {
    [e.correo_personal, e.correo_electronico].forEach(email => {
      const clean = (email || '').toLowerCase().trim();
      if (clean) byEmail.set(clean, e);
    });
  });

  const files = [process.argv[2], process.argv[3]];
  for (const file of files) {
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    const data = rows.slice(1);
    const byEmpId = new Map(); // empId -> [{nombre, apellido, correo}]

    data.forEach(r => {
      const nombre = (r[0] || '').trim();
      const apellido = (r[1] || '').trim();
      const correo = (r[5] || '').trim().toLowerCase();
      if (!correo) return;
      const emp = byEmail.get(correo);
      if (!emp) return;
      if (!byEmpId.has(emp.id)) byEmpId.set(emp.id, []);
      byEmpId.get(emp.id).push({ nombre, apellido, correo, empNombre: emp.nombreCompleto });
    });

    console.log(`\n=== ${file} ===`);
    let collisions = 0;
    byEmpId.forEach((entries, empId) => {
      // distinct names among entries that map to this empleado
      const distinctNames = new Set(entries.map(e => normalize(e.nombre + ' ' + e.apellido)));
      if (distinctNames.size > 1) {
        collisions++;
        console.log('COLISIÓN empleado', empId, JSON.stringify(entries));
      }
    });
    console.log('Total colisiones (mismo empleado, distintos nombres en archivo):', collisions);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
