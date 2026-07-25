import { NextResponse } from 'next/server'

// proxy hacia la API publica de tipos de cambio — evita exponer la URL externa al cliente
export async function GET() {
  // revalidate: 86400 = Next.js cachea la respuesta 24 horas para no llamar la API en cada request
  const res = await fetch(
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
    { next: { revalidate: 86400 } },
  )
  if (!res.ok) return NextResponse.json({}, { status: 502 })
  const data = await res.json()
  // data.usd es un objeto con todas las monedas relativas al dolar, ej: { gtq: 7.76, mxn: 17.2, ... }
  return NextResponse.json(data.usd)
}
