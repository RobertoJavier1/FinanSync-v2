'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

export default function RegisterPage() {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')  // campo para confirmar contrasena
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // validaciones del lado del cliente antes de llamar a Supabase
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }

    // Supabase exige minimo 6 caracteres, se valida antes para dar mejor mensaje
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)

    // el nombre viaja en user_metadata; el trigger handle_new_user() de la base
    // de datos lo copia a la tabla profiles, así que ya no hay que insertar el
    // perfil a mano desde el cliente
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nombre } },
    })

    if (signUpError) {
      const msg = signUpError.message.toLowerCase()
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        setError('Este correo ya está registrado')
      } else {
        setError('Error al crear la cuenta. Intenta de nuevo.')
      }
      setLoading(false)
      return
    }

    // si en Supabase está activada la confirmación por correo, signUp no
    // devuelve sesión: el usuario debe abrir el enlace antes de poder entrar
    if (!data.session) {
      setError('Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.')
      setLoading(false)
      return
    }

    router.refresh()
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center px-4 py-8">
      <div className="flex flex-col items-center mb-6 sm:mb-8">
        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4 shadow-md">
          <DollarSign className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white">FinanSync</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Sincroniza tus finanzas, sincroniza tu vida</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 sm:p-8 w-full max-w-md">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Crear cuenta</h2>

        <form onSubmit={handleRegister}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Nombre completo
            </label>
            <input
              type="text"
              placeholder="Ingresa tu nombre completo"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Correo Electrónico
            </label>
            <input
              type="email"
              placeholder="Ingresa tu correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Contraseña
            </label>
            <input
              type="password"
              placeholder="Crea una contraseña (mín. 6 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Confirmar contraseña
            </label>
            <input
              type="password"
              placeholder="Repite tu contraseña"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              required
              className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm mb-4 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors text-sm"
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center mt-4 text-slate-500 text-sm">
          ¿Ya tienes una cuenta?{' '}
          <Link href="/" className="text-blue-600 font-semibold hover:underline">
            Inicia sesión aquí
          </Link>
        </p>
      </div>
    </div>
  )
}
