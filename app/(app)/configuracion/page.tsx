'use client'

import { useState, useEffect } from 'react'
import { User, Bell, Shield, Palette, DollarSign, Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useNotif } from '@/context/NotifContext'
import { useFinanzas } from '@/context/FinanzasContext'
import { supabase } from '@/lib/supabase/client'

// definicion de las pestanas del menu lateral de configuracion
const tabs = [
  { id: 'perfil', label: 'Perfil', icon: User },
  { id: 'notificaciones', label: 'Notificaciones', icon: Bell },
  { id: 'seguridad', label: 'Seguridad', icon: Shield },
  { id: 'apariencia', label: 'Apariencia', icon: Palette },
  { id: 'finanzas', label: 'Finanzas', icon: DollarSign },
]

interface Mensaje { tipo: 'ok' | 'error'; texto: string }

export default function ConfiguracionPage() {
  const { user, nombre: nombreSesion, esGoogle } = useAuth()
  const router = useRouter()
  const { tema, setTema } = useTheme()
  const { notif, guardar: guardarNotif } = useNotif()
  const { finanzas, guardar: guardarFinanzas } = useFinanzas()
  const [activeTab, setActiveTab] = useState('perfil')
  const [saving, setSaving] = useState(false)
  const [mensaje, setMensaje] = useState<Mensaje | null>(null)

  // campos del formulario de perfil
  const [nombre, setNombre] = useState('')

  // carga el nombre real del usuario desde la sesion de Supabase
  useEffect(() => {
    setNombre(nombreSesion)
  }, [nombreSesion])

  // sincroniza los toggles locales cuando el contexto carga valores de la base de datos
  useEffect(() => {
    setNotifPresupuesto(notif.presupuesto)
    setNotifMetas(notif.metas)
    setNotifIA(notif.ia)
  }, [notif.presupuesto, notif.metas, notif.ia])

  // sincroniza preferencias de finanzas cuando el contexto las carga de la base de datos
  useEffect(() => {
    setMoneda(finanzas.moneda)
    setCategorias(finanzas.categorias)
  }, [finanzas.moneda, finanzas.categorias])

  function mostrar(tipo: 'ok' | 'error', texto: string) {
    setMensaje({ tipo, texto })
    setTimeout(() => setMensaje(null), 3500)
  }

  async function guardarPerfil() {
    if (!user || !nombre.trim()) return
    setSaving(true)
    const limpio = nombre.trim()

    // el nombre se guarda en dos sitios: en user_metadata de la sesion (para
    // mostrarlo sin consultar la base) y en la tabla usuarios
    const { error: errorAuth } = await supabase.auth.updateUser({ data: { nombre: limpio } })
    if (errorAuth) {
      mostrar('error', 'No se pudo actualizar el perfil.')
      setSaving(false)
      return
    }

    const { error: errorPerfil } = await supabase
      .from('usuarios')
      .update({ nombre: limpio })
      .eq('id_usuario', user.id)

    if (errorPerfil) console.error(errorPerfil)

    mostrar('ok', 'Perfil actualizado correctamente.')
    setSaving(false)
  }

  async function eliminarCuenta() {
    if (!user) return
    const confirmar = window.confirm('¿Seguro que quieres eliminar tu cuenta? Esta acción no se puede deshacer.')
    if (!confirmar) return
    setSaving(true)

    // borrar de auth.users exige permisos de servicio, así que se delega en la
    // función eliminar_mi_cuenta() de Postgres, que solo puede borrar al usuario
    // que la invoca. Las transacciones, metas, presupuestos y el perfil se van
    // con ella por el ON DELETE CASCADE del schema.
    const { error } = await supabase.rpc('eliminar_mi_cuenta')

    if (error) {
      mostrar('error', 'No se pudo eliminar la cuenta.')
      setSaving(false)
      return
    }

    await supabase.auth.signOut()
    router.refresh()
    router.push('/')
  }

  // los usuarios de Google no tienen contrasena propia en Supabase
  const isGoogleUser = esGoogle

  // campos del formulario de seguridad
  const [passActual, setPassActual] = useState('')
  const [passNueva, setPassNueva] = useState('')
  const [passConfirmar, setPassConfirmar] = useState('')

  async function cambiarContrasena() {
    if (!user || !user.email) return
    if (passNueva.length < 6) {
      mostrar('error', 'La nueva contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (passNueva !== passConfirmar) {
      mostrar('error', 'Las contraseñas nuevas no coinciden.')
      return
    }
    setSaving(true)

    // updateUser no pide la contrasena actual, así que se verifica a mano
    // haciendo un login con ella. Sin esto, cualquiera con la sesión abierta en
    // un equipo ajeno podría cambiar la contrasena.
    const { error: errorLogin } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: passActual,
    })

    if (errorLogin) {
      mostrar('error', 'La contraseña actual es incorrecta.')
      setSaving(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: passNueva })

    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('different from the old')) {
        mostrar('error', 'La nueva contraseña debe ser distinta de la actual.')
      } else {
        mostrar('error', 'No se pudo cambiar la contraseña. Intenta de nuevo.')
      }
      setSaving(false)
      return
    }

    mostrar('ok', 'Contraseña actualizada correctamente.')
    setPassActual('')
    setPassNueva('')
    setPassConfirmar('')
    setSaving(false)
  }

  const [moneda, setMoneda] = useState('GTQ')

  // toggles de notificaciones, true = activado
  const [notifPresupuesto, setNotifPresupuesto] = useState(true)
  const [notifMetas, setNotifMetas] = useState(true)
  const [notifIA, setNotifIA] = useState(true)

  // lista de categorias personalizadas con soporte para agregar y eliminar
  const [categorias, setCategorias] = useState(['Alimentación', 'Transporte', 'Entretenimiento', 'Salud', 'Educación', 'Vivienda', 'Ropa'])

  // borrar una categoria no es inocuo: al guardar se van con ella los
  // presupuestos de esa categoria, y sus transacciones quedan sin clasificar
  function quitarCategoria(cat: string) {
    const confirmar = window.confirm(
      `¿Quitar la categoría "${cat}"?\n\nAl guardar se eliminarán los presupuestos de esta categoría y las transacciones que la usaban quedarán sin clasificar. El historial de montos no se pierde.`,
    )
    if (!confirmar) return
    setCategorias(categorias.filter((c) => c !== cat))
  }
  const [nuevaCategoria, setNuevaCategoria] = useState('')
  const [agregandoCategoria, setAgregandoCategoria] = useState(false)

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Configuración</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Administra tu cuenta y preferencias</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {/* Sidebar tabs: tira horizontal deslizable en movil, columna en escritorio */}
        <div className="w-full md:w-48 md:flex-shrink-0">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-2 flex gap-1 overflow-x-auto md:block md:gap-0 md:space-y-0.5">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 md:gap-3 shrink-0 whitespace-nowrap w-auto md:w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-green-500 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">

          {/* Perfil */}
          {activeTab === 'perfil' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5 md:p-6 space-y-5">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Información personal</h2>

              {/* feedback */}
              {mensaje && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
                  mensaje.tipo === 'ok'
                    ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                }`}>
                  {mensaje.tipo === 'ok'
                    ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    : <XCircle className="w-4 h-4 flex-shrink-0" />}
                  {mensaje.texto}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Nombre completo</label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-700 dark:text-slate-200 rounded-lg text-slate-700 outline-none focus:ring-2 focus:ring-green-400 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Correo electrónico</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-slate-400 dark:text-slate-500 outline-none text-sm cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">El correo no se puede cambiar.</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                <button
                  onClick={guardarPerfil}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Guardar cambios
                </button>
              </div>

              {/* Zona peligrosa */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-red-500 mb-3">Zona peligrosa</h3>
                <button
                  onClick={eliminarCuenta}
                  disabled={saving}
                  className="flex items-center gap-2 text-sm text-red-500 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-60 px-4 py-2 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar cuenta permanentemente
                </button>
              </div>
            </div>
          )}

          {/* Notificaciones */}
          {activeTab === 'notificaciones' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5 md:p-6 space-y-6">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Notificaciones</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Elige qué alertas quieres recibir.</p>

              {mensaje && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
                  mensaje.tipo === 'ok'
                    ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                }`}>
                  {mensaje.tipo === 'ok'
                    ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    : <XCircle className="w-4 h-4 flex-shrink-0" />}
                  {mensaje.texto}
                </div>
              )}

              <div className="space-y-4">
                {[
                  { label: 'Alertas de presupuesto', desc: 'Aviso cuando te acercas al límite de un presupuesto', value: notifPresupuesto, set: setNotifPresupuesto },
                  { label: 'Progreso de metas', desc: 'Actualizaciones sobre el avance de tus metas de ahorro', value: notifMetas, set: setNotifMetas },
                  { label: 'Recomendaciones IA', desc: 'Sugerencias personalizadas de Perspectivas IA', value: notifIA, set: setNotifIA },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-4 py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.label}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{item.desc}</p>
                    </div>
                    <button
                      onClick={() => item.set(!item.value)}
                      className={`w-11 h-6 rounded-full transition-colors relative overflow-hidden ${item.value ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-600'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${item.value ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={async () => {
                    setSaving(true)
                    try {
                      await guardarNotif({ presupuesto: notifPresupuesto, metas: notifMetas, ia: notifIA })
                      mostrar('ok', 'Preferencias de notificaciones guardadas.')
                    } catch {
                      mostrar('error', 'No se pudieron guardar las preferencias.')
                    } finally {
                      setSaving(false)
                    }
                  }}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Guardar cambios
                </button>
              </div>
            </div>
          )}

          {/* Seguridad */}
          {activeTab === 'seguridad' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5 md:p-6 space-y-6">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Seguridad</h2>

              {/* feedback compartido con el tab de perfil */}
              {mensaje && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
                  mensaje.tipo === 'ok'
                    ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                }`}>
                  {mensaje.tipo === 'ok'
                    ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    : <XCircle className="w-4 h-4 flex-shrink-0" />}
                  {mensaje.texto}
                </div>
              )}

              {isGoogleUser ? (
                // usuarios de google no tienen contrasena propia en supabase
                <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">Cuenta vinculada con Google</p>
                    <p className="text-slate-400 dark:text-slate-500 text-xs mt-1 max-w-xs">
                      Tu contraseña está administrada por Google. Para cambiarla visita myaccount.google.com.
                    </p>
                  </div>
                  <a
                    href="https://myaccount.google.com/security"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 text-xs text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-4 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors font-medium"
                  >
                    Ir a configuración de Google
                  </a>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Contraseña actual
                      </label>
                      <input
                        type="password"
                        value={passActual}
                        onChange={(e) => setPassActual(e.target.value)}
                        placeholder="Ingresa tu contraseña actual"
                        className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-500 rounded-lg text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Nueva contraseña
                      </label>
                      <input
                        type="password"
                        value={passNueva}
                        onChange={(e) => setPassNueva(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-500 rounded-lg text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Confirmar nueva contraseña
                      </label>
                      <input
                        type="password"
                        value={passConfirmar}
                        onChange={(e) => setPassConfirmar(e.target.value)}
                        placeholder="Repite la nueva contraseña"
                        className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-500 rounded-lg text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={cambiarContrasena}
                      disabled={saving || !passActual || !passNueva || !passConfirmar}
                      className="flex items-center justify-center gap-2 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                    >
                      {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                      Cambiar contraseña
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Apariencia */}
          {activeTab === 'apariencia' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 space-y-6">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Apariencia</h2>

              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Tema</p>
                <div className="flex gap-3">
                  {[
                    { id: 'claro',  label: 'Claro',  preview: 'bg-slate-100' },
                    { id: 'oscuro', label: 'Oscuro', preview: 'bg-slate-800' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTema(t.id as 'claro' | 'oscuro')}
                      className={`rounded-xl p-3 text-center border-2 transition-all w-28 ${
                        tema === t.id ? 'border-green-500' : 'border-slate-200 dark:border-slate-600'
                      }`}
                    >
                      <div className={`w-full h-14 rounded-lg mb-2 ${t.preview}`} />
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.label}</p>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">El cambio se aplica de inmediato y se recuerda al volver.</p>
              </div>
            </div>
          )}

          {/* Finanzas */}
          {activeTab === 'finanzas' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 space-y-6">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Preferencias financieras</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Moneda principal
                  </label>
                  <select
                    value={moneda}
                    onChange={(e) => setMoneda(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-700 dark:text-slate-200 rounded-lg text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="MXN">MXN — Peso mexicano</option>
                    <option value="USD">USD — Dólar estadounidense</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="GTQ">GTQ — Quetzal</option>
                    <option value="COP">COP — Peso colombiano</option>
                    <option value="ARS">ARS — Peso argentino</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Categorías de gasto predeterminadas
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {categorias.map((cat) => (
                      <span key={cat} className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium px-3 py-1.5 rounded-full">
                        {cat}
                        <button
                          onClick={() => quitarCategoria(cat)}
                          className="ml-1 text-slate-400 hover:text-red-500 transition-colors leading-none"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {agregandoCategoria ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={nuevaCategoria}
                          onChange={(e) => setNuevaCategoria(e.target.value)}
                          onKeyDown={(e) => {
                            // enter confirma la categoria, escape cancela el input
                            if (e.key === 'Enter' && nuevaCategoria.trim()) {
                              setCategorias([...categorias, nuevaCategoria.trim()])
                              setNuevaCategoria('')
                              setAgregandoCategoria(false)
                            }
                            if (e.key === 'Escape') {
                              setNuevaCategoria('')
                              setAgregandoCategoria(false)
                            }
                          }}
                          autoFocus
                          placeholder="Nombre..."
                          className="text-xs px-3 py-1.5 border border-green-300 dark:border-green-700 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-500 rounded-full outline-none focus:ring-2 focus:ring-green-300 w-28"
                        />
                        <button
                          onClick={() => {
                            if (nuevaCategoria.trim()) {
                              setCategorias([...categorias, nuevaCategoria.trim()])
                              setNuevaCategoria('')
                              setAgregandoCategoria(false)
                            }
                          }}
                          className="text-xs bg-green-500 text-white px-2.5 py-1.5 rounded-full hover:bg-green-600 transition-colors"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => { setNuevaCategoria(''); setAgregandoCategoria(false) }}
                          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAgregandoCategoria(true)}
                        className="bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-medium px-3 py-1.5 rounded-full border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                      >
                        + Agregar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {mensaje && activeTab === 'finanzas' && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
                  mensaje.tipo === 'ok'
                    ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                }`}>
                  {mensaje.tipo === 'ok' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
                  {mensaje.texto}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={async () => {
                    setSaving(true)
                    try {
                      await guardarFinanzas({ moneda, categorias })
                      mostrar('ok', 'Preferencias financieras guardadas.')
                    } catch {
                      mostrar('error', 'No se pudieron guardar las preferencias.')
                    } finally {
                      setSaving(false)
                    }
                  }}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Guardar cambios
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
