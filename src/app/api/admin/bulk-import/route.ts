
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function POST(request: Request) {
  try {
    const { users, cursoId, leccionIds, rolId, defaultPassword } = await request.json();

    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' },
        { status: 500 }
      );
    }

    const results = {
      created: 0,
      alreadyExists: 0,
      errors: [] as any[],
      skipped: 0
    };

    // 1. Obtener todos los empleados para matching
    const { data: allEmps } = await supabaseAdmin
      .from('empleados')
      .select('id, nombreCompleto, correo_personal');

    const empsByName = new Map();
    const empsByEmail = new Map();

    allEmps?.forEach(emp => {
      const normalizedName = emp.nombreCompleto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      empsByName.set(normalizedName, emp);
      if (emp.correo_personal) {
        empsByEmail.set(emp.correo_personal.toLowerCase().trim(), emp);
      }
    });

    // 2. Procesar usuarios
    for (const user of users) {
      try {
        // Encontrar empleado
        let emp = empsByEmail.get(user.Email?.toLowerCase().trim());
        if (!emp) {
            const normalizedInputName = (user.Nombre + " " + user.Apellido).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            emp = empsByName.get(normalizedInputName);
        }

        if (!emp) {
          results.skipped++;
          continue;
        }

        // El email real será el de RRHH o uno generado
        const finalEmail = emp.correo_personal || `${emp.id}@academia.local`;
        
        // Verificar si ya existe en academia.usuarios
        const { data: existingUser } = await supabaseAdmin
          .schema('academia')
          .from('usuarios')
          .select('id')
          .eq('empleado_id', emp.id)
          .single();

        let userId = existingUser?.id;

        if (!existingUser) {
          // Crear en Auth
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: finalEmail,
            password: String(emp.id),
            email_confirm: true,
            user_metadata: { rol: 'OPERARIO' }
          });

          if (authError) {
              if (authError.message.toLowerCase().includes("already exists") || authError.message.toLowerCase().includes("registered")) {
                  // Ya existe en auth. Busquémoslo por email.
                  // Usamos un perPage alto para encontrarlo en la lista.
                  const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
                  const foundAuth = listData.users.find(u => u.email?.toLowerCase() === finalEmail.toLowerCase());
                  if (foundAuth) {
                      userId = foundAuth.id;
                  } else {
                      throw new Error(`Auth exists but not found in list: ${authError.message}`);
                  }
              } else {
                  throw new Error(`Auth error: ${authError.message}`);
              }
          } else {
              userId = authData.user.id;
          }

          // Vincular en academia.usuarios
          if (userId) {
              const { error: linkError } = await supabaseAdmin
                .schema('academia')
                .from('usuarios')
                .upsert({
                  id: userId,
                  empleado_id: emp.id,
                  rol_id: rolId
                }, { onConflict: 'empleado_id' });
                
              if (linkError) throw new Error(`Link error: ${linkError.message}`);
              results.created++;
          }
        } else {
          userId = existingUser.id;
          results.alreadyExists++;
        }

        if (!userId) continue;

        // 3. Inscribir en el curso
        await supabaseAdmin
          .schema('academia')
          .from('inscripciones')
          .upsert({
            empleado_id: emp.id,
            curso_id: cursoId,
            estado: 'Activo'
          }, { onConflict: 'empleado_id, curso_id' });

        // 4. Subir notas
        const notas = [user.Nota1, user.Nota2, user.Nota3];
        for (let i = 0; i < 3; i++) {
          const notaStr = notas[i];
          if (notaStr && notaStr !== "-" && notaStr !== "") {
            const puntuacion = parseFloat(notaStr);
            const leccionId = leccionIds[i];
            
            await supabaseAdmin
              .schema('academia')
              .from('calificaciones')
              .upsert({
                usuario_id: userId,
                leccion_id: leccionId,
                curso_id: cursoId,
                puntuacion: puntuacion,
                puntuacion_maxima: (i === 2 ? 5 : 10), // Asunción basada en datos
                estado: 'Calificado'
              }, { onConflict: 'usuario_id, leccion_id' });
          }
        }

      } catch (err: any) {
        results.errors.push({ user: user.Nombre, error: err.message });
      }
    }

    return NextResponse.json(results);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
