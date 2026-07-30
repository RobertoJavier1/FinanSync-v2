// Acceso a la tabla `categorias` en Supabase.
//
// Antes las categorías eran un arreglo de texto dentro del perfil del usuario.
// Ahora son filas propias, y transacciones y presupuestos las referencian por
// id_categoria. El resto de la app sigue trabajando con nombres, así que estas
// funciones son las que traducen entre nombre e id.
import { supabase } from './supabase/client'

export interface Categoria {
  id: string
  nombre: string
}

export async function getCategorias(uid: string): Promise<Categoria[]> {
  const { data, error } = await supabase
    .from('categorias')
    .select('id_categoria, nombre')
    .eq('id_usuario', uid)
    .order('nombre')

  if (error) throw error

  return (data ?? []).map((row) => ({ id: row.id_categoria, nombre: row.nombre }))
}

export async function agregarCategoria(uid: string, nombre: string): Promise<Categoria> {
  const limpio = nombre.trim()
  const { data, error } = await supabase
    .from('categorias')
    .insert({ id_usuario: uid, nombre: limpio })
    .select('id_categoria, nombre')
    .single()

  // 23505 = unique_violation: el usuario ya tiene una categoría con ese nombre
  if (error) {
    if (error.code === '23505') throw new Error(`Ya tienes una categoría llamada "${limpio}".`)
    throw error
  }

  return { id: data.id_categoria, nombre: data.nombre }
}

export async function eliminarCategoria(uid: string, id: string): Promise<void> {
  // las transacciones que la usaban quedan sin categoría (ON DELETE SET NULL) y
  // los presupuestos de esa categoría se van con ella (ON DELETE CASCADE)
  const { error } = await supabase
    .from('categorias')
    .delete()
    .eq('id_categoria', id)
    .eq('id_usuario', uid)

  if (error) throw error
}

// Devuelve el id de una categoría por nombre, creándola si no existe.
//
// Hace falta porque hay dos lugares donde la app usa un nombre de categoría que
// el usuario no eligió de una lista: el aporte a una meta (se registra como
// gasto en 'Ahorro') y cualquier categoría que se haya borrado entre que se
// cargó la página y se envió el formulario.
export async function asegurarCategoria(uid: string, nombre: string): Promise<string> {
  const limpio = nombre.trim()

  const { data, error } = await supabase
    .from('categorias')
    .select('id_categoria')
    .eq('id_usuario', uid)
    .eq('nombre', limpio)
    .maybeSingle()

  if (error) throw error
  if (data) return data.id_categoria

  const creada = await agregarCategoria(uid, limpio)
  return creada.id
}
