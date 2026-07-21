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

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

async function main() {
  const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const header = rows[0];
  const data = rows.slice(1);

  // Fetch all empleados (paginated, could be large)
  let allEmps = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data: page, error } = await supabaseAdmin
      .from('empleados')
      .select('id, nombreCompleto, correo_personal, correo_electronico, activo')
      .range(from, from + pageSize - 1);
    if (error) { console.error(error); break; }
    if (!page || page.length === 0) break;
    allEmps = allEmps.concat(page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  console.log('Total empleados fetched:', allEmps.length);

  const byEmail = new Map();
  const byName = new Map();
  allEmps.forEach(e => {
    const n = normalize(e.nombreCompleto);
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n).push(e);
    [e.correo_personal, e.correo_electronico].forEach(email => {
      if (email && email.trim()) byEmail.set(email.toLowerCase().trim(), e);
    });
  });

  let matchedByEmail = 0, matchedByName = 0, unmatched = 0;
  const unmatchedSample = [];
  const dupNameMatches = [];

  data.forEach(r => {
    const nombre = r[0], apellido = r[1], email = r[5];
    const fullName = normalize(`${nombre} ${apellido}`);
    const emailNorm = (email || '').toLowerCase().trim();

    let emp = emailNorm ? byEmail.get(emailNorm) : null;
    if (emp) { matchedByEmail++; return; }

    const nameMatches = byName.get(fullName);
    if (nameMatches && nameMatches.length === 1) { matchedByName++; return; }
    if (nameMatches && nameMatches.length > 1) { dupNameMatches.push({ fullName, count: nameMatches.length }); unmatched++; return; }

    unmatched++;
    if (unmatchedSample.length < 15) unmatchedSample.push({ nombre, apellido, email });
  });

  console.log('HEADER:', header);
  console.log('Total students in file:', data.length);
  console.log('Matched by email:', matchedByEmail);
  console.log('Matched by name (unique):', matchedByName);
  console.log('Unmatched:', unmatched);
  console.log('Ambiguous name matches (multiple empleados same name):', dupNameMatches.length);
  console.log('Sample unmatched:', JSON.stringify(unmatchedSample, null, 2));
  console.log('Sample ambiguous:', JSON.stringify(dupNameMatches.slice(0,10), null, 2));
}

main();
