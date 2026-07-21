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

async function main() {
  const { data: cursos, error: cursosErr } = await supabaseAdmin
    .schema('academia')
    .from('cursos')
    .select('id, nombre');
  console.log('CURSOS:', JSON.stringify(cursos, null, 2), cursosErr);

  const { data: calif, error: califErr } = await supabaseAdmin
    .schema('academia')
    .from('calificaciones')
    .select('*')
    .limit(1);
  console.log('CALIFICACIONES sample:', JSON.stringify(calif, null, 2), califErr);

  const { data: usr, error: usrErr } = await supabaseAdmin
    .schema('academia')
    .from('usuarios')
    .select('*')
    .limit(1);
  console.log('USUARIOS sample:', JSON.stringify(usr, null, 2), usrErr);

  const { data: emp, error: empErr } = await supabaseAdmin
    .from('empleados')
    .select('*')
    .limit(1);
  console.log('EMPLEADOS sample:', JSON.stringify(emp, null, 2), empErr);
}

main();
