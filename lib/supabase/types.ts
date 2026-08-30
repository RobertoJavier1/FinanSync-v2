// Tipos de la base de datos, escritos a mano a partir de
// supabase/migrations/0001_schema_inicial.sql
//
// Sirven para que el cliente de Supabase sepa qué columnas existen y de qué
// tipo son: si alguien renombra una columna en el SQL y no aquí, TypeScript
// avisa en el build en lugar de fallar en producción.
//
// Se pueden regenerar con:
//   npx supabase gen types typescript --project-id <ref> > lib/supabase/types.ts

export type TipoTransaccion = 'income' | 'expense'

export interface Database {
  public: {
    Tables: {
      usuarios: {
        Row: {
          id_usuario: string
          nombre: string | null
          email: string | null
          moneda: string
          notif_presupuesto: boolean
          notif_metas: boolean
          notif_ia: boolean
          // la mantiene el trigger categorias_sincronizar; solo lectura
          categorias: string[]
          creado_en: string
        }
        Insert: {
          id_usuario: string
          nombre?: string | null
          email?: string | null
          moneda?: string
          notif_presupuesto?: boolean
          notif_metas?: boolean
          notif_ia?: boolean
        }
        Update: {
          nombre?: string | null
          email?: string | null
          moneda?: string
          notif_presupuesto?: boolean
          notif_metas?: boolean
          notif_ia?: boolean
        }
        Relationships: []
      }
      categorias: {
        Row: {
          id_categoria: string
          id_usuario: string
          nombre: string
          creado_en: string
        }
        Insert: {
          id_categoria?: string
          id_usuario: string
          nombre: string
        }
        Update: {
          nombre?: string
        }
        Relationships: []
      }
      transacciones: {
        Row: {
          id_transaccion: string
          id_usuario: string
          id_categoria: string | null
          descripcion: string
          fecha: string // date en formato "YYYY-MM-DD"
          monto: number
          tipo: TipoTransaccion
          moneda_origen: string
          factura_path: string | null
          creado_en: string
        }
        Insert: {
          id_transaccion?: string
          id_usuario: string
          id_categoria?: string | null
          descripcion: string
          fecha: string
          monto: number
          tipo: TipoTransaccion
          moneda_origen?: string
          factura_path?: string | null
        }
        Update: {
          id_categoria?: string | null
          descripcion?: string
          fecha?: string
          monto?: number
          tipo?: TipoTransaccion
          moneda_origen?: string
          factura_path?: string | null
        }
        Relationships: []
      }
      metas: {
        Row: {
          id_meta: string
          id_usuario: string
          nombre: string
          objetivo: number
          monto_actual: number
          fecha_limite: string | null
          color: string
          icono: string
          moneda_origen: string
          creado_en: string
        }
        Insert: {
          id_meta?: string
          id_usuario: string
          nombre: string
          objetivo?: number
          monto_actual?: number
          fecha_limite?: string | null
          color?: string
          icono?: string
          moneda_origen?: string
        }
        Update: {
          nombre?: string
          objetivo?: number
          monto_actual?: number
          fecha_limite?: string | null
          color?: string
          icono?: string
          moneda_origen?: string
        }
        Relationships: []
      }
      presupuestos: {
        Row: {
          id_presupuesto: string
          id_usuario: string
          id_categoria: string
          limite_mensual: number
          mes: number
          anio: number
          color: string
          icono: string
          moneda_origen: string
          creado_en: string
        }
        Insert: {
          id_presupuesto?: string
          id_usuario: string
          id_categoria: string
          limite_mensual?: number
          mes: number
          anio: number
          color?: string
          icono?: string
          moneda_origen?: string
        }
        Update: {
          id_categoria?: string
          limite_mensual?: number
          mes?: number
          anio?: number
          color?: string
          icono?: string
          moneda_origen?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      eliminar_mi_cuenta: {
        Args: Record<string, never>
        Returns: undefined
      }
    }
    Enums: {
      tipo_transaccion: TipoTransaccion
    }
    CompositeTypes: Record<string, never>
  }
}
