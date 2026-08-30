import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { urlFirmadaFactura } from '@/lib/gcs'

// devuelve una URL firmada (valida 15 minutos) para ver la imagen de la
// factura de una transaccion. recibe el id de la transaccion, no el path del
// bucket directamente: asi la unica verificacion de "es tuya" necesaria es la
// misma que ya protege al resto de la app (RLS sobre transacciones)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const idTransaccion = searchParams.get('idTransaccion')
    if (!idTransaccion) {
      return NextResponse.json({ error: 'Falta idTransaccion' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: transaccion, error } = await supabase
      .from('transacciones')
      .select('factura_path')
      .eq('id_transaccion', idTransaccion)
      .eq('id_usuario', user.id)
      .single()

    if (error || !transaccion?.factura_path) {
      return NextResponse.json({ error: 'Esta transacción no tiene factura' }, { status: 404 })
    }

    const url = await urlFirmadaFactura(transaccion.factura_path)
    return NextResponse.json({ url })
  } catch (error) {
    console.error('Error al generar URL de factura:', error)
    return NextResponse.json({ error: 'Error al obtener la factura' }, { status: 500 })
  }
}
