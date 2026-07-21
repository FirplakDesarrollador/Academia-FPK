import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(request: Request) {
  try {
    const { email, password, nombreCompleto, cargo, cedula } = await request.json();

    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' },
        { status: 500 }
      );
    }

    if (!email || !password || !nombreCompleto || !cedula) {
      return NextResponse.json(
        { error: 'Correo, contraseña, nombre completo y cédula son obligatorios' },
        { status: 400 }
      );
    }

    const empleadoId = parseInt(cedula, 10);
    if (!empleadoId) {
      return NextResponse.json({ error: 'La cédula debe ser un número válido' }, { status: 400 });
    }

    // 1. Verificar que no exista ya un empleado con esa cédula
    const { data: existingEmp } = await supabaseAdmin
      .from('empleados')
      .select('id')
      .eq('id', empleadoId)
      .maybeSingle();

    if (existingEmp) {
      return NextResponse.json(
        { error: `Ya existe un empleado registrado con la cédula ${empleadoId}` },
        { status: 400 }
      );
    }

    // 2. Crear el registro en empleados
    const { error: empInsertError } = await supabaseAdmin.from('empleados').insert({
      id: empleadoId,
      nombreCompleto: nombreCompleto.trim(),
      cargo: cargo?.trim() || null,
      empresa: 'Firplak',
      activo: true,
      correo_electronico: email.trim().toLowerCase(),
      correo_personal: email.trim().toLowerCase(),
    });

    if (empInsertError) {
      throw new Error(`Error creando el empleado: ${empInsertError.message}`);
    }

    // 3. Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { rol: 'OPERARIO' },
    });

    if (authError) {
      // Revertir el empleado creado si la cuenta de auth falla
      await supabaseAdmin.from('empleados').delete().eq('id', empleadoId);
      throw new Error(`Error en Supabase Auth: ${authError.message}`);
    }

    const newUserId = authData.user.id;

    // 4. Obtener el UUID del rol OPERARIO
    const { data: roleData, error: roleError } = await supabaseAdmin
      .schema('academia')
      .from('roles')
      .select('id')
      .eq('nombre', 'OPERARIO')
      .single();

    if (roleError) throw new Error(`Error al buscar el rol: ${roleError.message}`);

    // 5. Vincular en academia.usuarios
    const { error: insertError } = await supabaseAdmin
      .schema('academia')
      .from('usuarios')
      .insert({
        id: newUserId,
        empleado_id: empleadoId,
        rol_id: roleData.id,
        tipo: 'empleado',
        nombre_completo: nombreCompleto.trim(),
      });

    if (insertError) throw new Error(`Error registrando la cuenta: ${insertError.message}`);

    return NextResponse.json({ success: true, empleadoId, user: authData.user }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating employee:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
