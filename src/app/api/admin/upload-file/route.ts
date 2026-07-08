import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { fileName, bucket = 'videos' } = await request.json();

    if (!fileName) {
      return NextResponse.json({ error: 'Falta el nombre del archivo' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Configuración de Supabase incompleta en el servidor' }, { status: 500 });
    }

    // Inicializamos el cliente de Supabase con el Service Role Key para saltarnos RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(fileName);

    if (error) {
      console.error('Error creando signed url:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Excepción en upload-video API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
