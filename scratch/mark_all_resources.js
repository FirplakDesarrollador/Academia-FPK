const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const SERVICE_KEY = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  const cursos = ['283c7f14-4c73-47df-a0be-ad8e19ab8c3a', '86eb9037-31d0-4914-bb03-56cabdf51229'];
  
  for (const curso_id of cursos) {
    console.log(`Processing curso: ${curso_id}`);
    
    // 1. Get all lecciones in the course
    const { data: lecciones } = await supabase.schema('academia')
      .from('lecciones')
      .select('id, modulos!inner(curso_id)')
      .eq('modulos.curso_id', curso_id);
      
    if (!lecciones) continue;
    const leccionIds = lecciones.map(l => l.id);
    console.log(`Course has ${leccionIds.length} lecciones.`);
    
    // 2. Get all distinct usuario_ids who have grades in this course
    const { data: calificaciones } = await supabase.schema('academia')
      .from('calificaciones')
      .select('usuario_id')
      .eq('curso_id', curso_id);
      
    if (!calificaciones) continue;
    const gradedUsers = [...new Set(calificaciones.map(c => c.usuario_id))];
    console.log(`Found ${gradedUsers.length} graded users.`);
    
    // 3. Get inscripciones for these users
    const { data: inscripciones } = await supabase.schema('academia')
      .from('inscripciones')
      .select('id, usuario_id, metadata')
      .eq('curso_id', curso_id)
      .in('usuario_id', gradedUsers);
      
    if (!inscripciones) continue;
    console.log(`Found ${inscripciones.length} inscripciones.`);
    
    // 4. Update inscripciones to have all lecciones as completedResources
    let updateCount = 0;
    for (const ins of inscripciones) {
      const currentMeta = ins.metadata || {};
      const newMeta = {
        ...currentMeta,
        completedResources: leccionIds
      };
      
      const { error } = await supabase.schema('academia')
        .from('inscripciones')
        .update({ metadata: newMeta, progreso: 100, status: 'Completado' })
        .eq('id', ins.id);
        
      if (!error) updateCount++;
    }
    console.log(`Updated ${updateCount} inscripciones for course ${curso_id}\n`);
  }
}

run().catch(console.error);
