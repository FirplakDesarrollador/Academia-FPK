const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...value] = line.split('=');
  if (key && value) acc[key.trim()] = value.join('=').trim();
  return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log("Checking calificaciones...");
  const { data: calificaciones, error: cErr } = await supabase
    .schema('academia')
    .from('calificaciones')
    .select('*')
    .limit(5);

  if (cErr) console.error("Error calif:", cErr);
  else console.log("Calificaciones sample:", calificaciones);

  console.log("Checking milton user...");
  const { data: users, error: uErr } = await supabase
    .auth.admin.listUsers();
  
  if (uErr) console.error("Error users:", uErr);
  else {
    const milton = users.users.find(u => u.email.includes('milton'));
    console.log("Milton auth user:", milton ? { id: milton.id, email: milton.email } : "Not found");
  }

  if (users.users) {
      const milton = users.users.find(u => u.email.includes('milton.rendon@firplak.com'));
      if (milton) {
          console.log("Current user_metadata:", milton.user_metadata);
          
          // Update user_metadata in auth.users
          const { data: updatedAuth, error: updateErr } = await supabase.auth.admin.updateUserById(
            milton.id,
            { user_metadata: { ...milton.user_metadata, rol: 'ADMIN', role: 'ADMIN' } }
          );
          
          if (updateErr) console.error("Error updating user_metadata:", updateErr);
          else console.log("Updated auth.users user_metadata to ADMIN");

          // Also check academia.usuarios
          const { data: aUser, error: aErr } = await supabase
            .schema('academia')
            .from('usuarios')
            .select('*')
            .eq('id', milton.id);
            
          console.log("Milton in academia.usuarios:", aUser);
          
          if (!aUser || aUser.length === 0) {
            console.log("Looking up empleado...");
            const { data: empData } = await supabase.from('empleados').select('*').ilike('correo_personal', '%milton.rendon%');
            let empId = empData?.[0]?.id;
            
            if (!empId) {
                // If not found by personal email, maybe they are in the DB under a different email or we can just find any matching name
                const { data: empData2 } = await supabase.from('empleados').select('*').ilike('nombreCompleto', '%milton%');
                empId = empData2?.[0]?.id;
            }
            
            console.log("Empleado found:", empId);
            
            const { data: roles } = await supabase.schema('academia').from('roles').select('*');
            console.log("Roles:", roles);
            const adminRole = roles?.find(r => r.nombre === 'Administrador' || r.nombre === 'ADMINISTRADOR' || r.nombre?.toLowerCase().includes('admin'));
            
            if (empId && adminRole) {
                const { error: insErr } = await supabase.schema('academia').from('usuarios').insert({
                    id: milton.id,
                    empleado_id: empId,
                    rol_id: adminRole.id
                });
                if (insErr) console.error("Error inserting into usuarios:", insErr);
                else console.log("Successfully inserted Milton into academia.usuarios as Admin!");
            }
          }
      }
  }
  
  console.log("Starting backfill for Induccion Virtual views...");
  const courseId = '86eb9037-31d0-4914-bb03-56cabdf51229';

  // 1. Get all users in academia.usuarios
  const { data: dbUsers, error: dbUErr } = await supabase.schema('academia').from('usuarios').select('id, empleado_id');
  if (dbUErr) return console.error(dbUErr);

  // 2. Get all non-evaluation lessons in this course
  const { data: acts, error: actsErr } = await supabase.schema('academia').from('lecciones').select('id, tipo, modulos!inner(curso_id)').eq('modulos.curso_id', courseId).neq('tipo', 'evaluacion');
  if (actsErr) return console.error(actsErr);
  
  console.log(`Found ${dbUsers.length} users and ${acts.length} non-evaluation lessons to backfill.`);

  // 3. For each user, ensure they have an inscripcion for this course
  let count = 0;
  for (const user of dbUsers) {
    if (!user.empleado_id) continue;
    
    let insId;
    const { data: existingIns } = await supabase.schema('academia').from('inscripciones').select('id').eq('empleado_id', user.empleado_id).eq('curso_id', courseId).maybeSingle();
    
    if (existingIns) {
      insId = existingIns.id;
    } else {
      const { data: newIns, error: insErr } = await supabase.schema('academia').from('inscripciones').insert({
        empleado_id: user.empleado_id,
        curso_id: courseId,
        status: 'en_progreso'
      }).select('id').single();
      
      if (insErr) {
        console.error("Error creating ins for user", user.empleado_id, insErr);
        continue;
      }
      insId = newIns.id;
    }
    
    // 4. For each lesson, insert into lecciones_vistas
    if (acts.length > 0) {
        const views = acts.map(act => ({
          inscripcion_id: insId,
          leccion_id: act.id,
          completada_at: new Date().toISOString()
        }));
        
        const { error: vErr } = await supabase.schema('academia').from('lecciones_vistas').upsert(views, { onConflict: 'inscripcion_id, leccion_id' });
        if (vErr) console.error("Error saving views for ins", insId, vErr);
        else count++;
    }
  }
  
  console.log(`Completed backfill! Processed ${count} users successfully.`);
}

check();
