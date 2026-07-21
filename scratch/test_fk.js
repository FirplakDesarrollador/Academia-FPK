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
  const fakeId = '00000000-0000-0000-0000-000000000001';
  const { data: roleData } = await supabaseAdmin.schema('academia').from('roles').select('id').eq('nombre', 'OPERARIO').single();
  console.log('role:', roleData);

  const { data, error } = await supabaseAdmin.schema('academia').from('usuarios').insert({
    id: fakeId,
    empleado_id: null,
    rol_id: roleData.id,
    nombre_completo: 'TEST FK PROBE',
    tipo: 'externo',
  }).select();

  console.log('insert result:', JSON.stringify(data), error ? JSON.stringify(error) : null);

  if (data && data.length) {
    const { error: delErr } = await supabaseAdmin.schema('academia').from('usuarios').delete().eq('id', fakeId);
    console.log('cleanup delete error:', delErr);
  }
}

main();
