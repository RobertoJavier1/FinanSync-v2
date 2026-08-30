import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { subirFactura } from '@/lib/gcs'

// sube la imagen de una factura ya asociada a una transaccion existente.
// separado de app/api/facturas/route.ts (que solo analiza con Gemini y no
// persiste nada) porque necesita el id de la transaccion ya creada para
// nombrar el objeto en el bucket.
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const formData = await req.formData()
    const imagen = formData.get('imagen') as File | null
    const idTransaccion = formData.get('idTransaccion') as string | null

    if (!imagen || !idTransaccion) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    // confirma que la transaccion sea del usuario antes de subir nada; RLS ya
    // filtra esto, pero asi evitamos gastar una subida en un id inexistente
    const { data: transaccion, error: errorBuscar } = await supabase
      .from('transacciones')
      .select('id_transaccion')
      .eq('id_transaccion', idTransaccion)
      .eq('id_usuario', user.id)
      .single()

    if (errorBuscar || !transaccion) {
      return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 })
    }

    const ext = (imagen.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
    const path = `${user.id}/${idTransaccion}.${ext}`
    const bytes = Buffer.from(await imagen.arrayBuffer())

    await subirFactura(path, bytes, imagen.type || 'image/jpeg')

    const { error: errorUpdate } = await supabase
      .from('transacciones')
      .update({ factura_path: path })
      .eq('id_transaccion', idTransaccion)
      .eq('id_usuario', user.id)

    if (errorUpdate) throw errorUpdate

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error al subir factura:', error)
    return NextResponse.json({ error: 'Error al guardar la imagen de la factura' }, { status: 500 })
  }
}
