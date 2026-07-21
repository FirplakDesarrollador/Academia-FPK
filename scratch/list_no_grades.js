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

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const files = [
    { path: process.argv[2], cols: [6, 7, 8], label: 'INDUCCIÓN VIRTUAL' },
    { path: process.argv[3], cols: [6, 7, 8], label: 'HERRAMIENTAS COLABORATIVAS' },
  ];

  const allEmps = await fetchAllPages('empleados', 'id, nombreCompleto, correo_personal, correo_electronico, activo');
  const byEmail = new Map();
  const byName = new Map();
  allEmps.forEach(e => {
    const n = normalize(e.nombreCompleto);
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n).push(e);
    [e.correo_personal, e.correo_electronico].forEach(email => {
      const clean = (email || '').toLowerCase().trim();
      if (clean) byEmail.set(clean, e);
    });
  });

  const outRows = [['Curso', 'Nombre (archivo)', 'Apellido (archivo)', 'Correo (archivo)', 'Empleado real (si se identifica)', 'Cedula empleado', 'Activo']];

  for (const file of files) {
    const rows = JSON.parse(fs.readFileSync(file.path, 'utf8'));
    const data = rows.slice(1);
    data.forEach(r => {
      const nombre = (r[0] || '').trim();
      const apellido = (r[1] || '').trim();
      const correo = (r[5] || '').trim();
      const allDash = file.cols.every(c => {
        const v = (r[c] || '').trim();
        return v === '' || v === '-';
      });
      if (!allDash) return;

      let emp = correo ? byEmail.get(correo.toLowerCase()) : null;
      if (!emp) {
        const fullName = normalize(`${nombre} ${apellido}`);
        const matches = byName.get(fullName);
        if (matches && matches.length === 1) emp = matches[0];
      }

      outRows.push([
        file.label,
        nombre,
        apellido,
        correo,
        emp ? emp.nombreCompleto.trim() : '',
        emp ? emp.id : '',
        emp ? (emp.activo ? 'Si' : 'No') : '',
      ]);
    });
  }

  const csv = outRows.map(row => row.map(csvEscape).join(',')).join('\n');
  fs.writeFileSync(process.argv[4], csv, 'utf8');
  console.log('Total personas sin ninguna nota:', outRows.length - 1);
  console.log('Escrito en:', process.argv[4]);
}

main().catch(e => { console.error(e); process.exit(1); });
