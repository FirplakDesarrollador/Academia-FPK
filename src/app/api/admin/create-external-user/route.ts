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

    if (!email || !password || !nombreCompleto) {
      return NextResponse.json(
        { error: 'Email, contraseña y nombre completo son obligatorios' },
        { status: 400 }
      );
    }

    // 1. Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        rol: 'OPERARIO',
        tipo: 'externo',
      },
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

    if (roleError) throw new Error(`Error al buscar el rol: ${roleError.message}`);

    // 3. Insertar en academia.usuarios SIN empleado_id (usuario externo)
    const { error: insertError } = await supabaseAdmin
      .schema('academia')
      .from('usuarios')
      .insert({
        id: newUserId,
        empleado_id: null,
        rol_id: roleData.id,
        nombre_completo: nombreCompleto.trim(),
        email_visible: email.trim().toLowerCase(),
        cargo: cargo?.trim() || null,
        tipo: 'externo',
        cedula: cedula?.trim() || null,
      });

    if (insertError)
      throw new Error(`Error registrando usuario externo: ${insertError.message}`);

    return NextResponse.json({ success: true, user: authData.user }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating external user:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
