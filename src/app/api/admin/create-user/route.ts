import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usamos la Service Role Key para tener privilegios de admin,
// esto permite crear cuentas de usuario sin cerrar la sesión actual de la persona de RRHH.
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
    const { email, password, empleadoId } = await request.json();

    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY no configurada en las variables de entorno' },
        { status: 500 }
      );
    }

    // 1. Crear el usuario en Auth de Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // No enviamos correos de verificación a estas cuentas
      user_metadata: {
        rol: 'OPERARIO'
      }
    });

    if (authError) {
      throw new Error(`Error en Supabase Auth: ${authError.message}`);
    }

    const newUserId = authData.user.id;

    // 2. Obtener el UUID del rol OPERARIO
    const { data: roleData, error: roleError } = await supabaseAdmin
      .schema('academia')
      .from('roles')
      .select('id')
      .eq('nombre', 'OPERARIO')
      .single();

    if (roleError) throw new Error(`Ocurrió un error al buscar el rol: ${roleError.message}`);

    // 2b. Guardamos el nombre completo directamente en academia.usuarios para que el
    // nombre en pantalla no dependa de que el cruce con empleados funcione en cada login.
    const { data: empData } = await supabaseAdmin
      .from('empleados')
      .select('nombreCompleto')
      .eq('id', empleadoId)
      .maybeSingle();

    // 3. Vincularlo en la tabla de academia.usuarios
    // NOTA: 'id' es el UUID de Supabase Auth; 'empleado_id' enlaza al registro de RRHH.
    const { error: insertError } = await supabaseAdmin
      .schema('academia')
      .from('usuarios')
      .insert({
        id: newUserId,
        empleado_id: empleadoId,
        rol_id: roleData.id,
        tipo: 'empleado',
        nombre_completo: empData?.nombreCompleto?.trim() || null,
      });

    if (insertError) throw new Error(`Error vinculando cuenta a la academia: ${insertError.message}`);

    return NextResponse.json({ success: true, user: authData.user }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
