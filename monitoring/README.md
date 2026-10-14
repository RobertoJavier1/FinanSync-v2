# Observabilidad — Cloud Monitoring y Logging

Cloud Run manda sus registros a Cloud Logging sin configurar nada. Lo que sí
hace falta configurar es qué vigilar y a quién avisarle, y de eso se trata esta
carpeta.

## Eventos que registra la aplicación

El código no escribe texto suelto: imprime JSON en una sola línea, que es como
Cloud Logging lo puede indexar y filtrar por campo. Todos los eventos del job
mensual llevan la clave `evento`:

| Evento | Cuándo | Severidad |
|---|---|---|
| `reporte_mensual_inicio` | arranca el job, con cuántos usuarios va a procesar | INFO |
| `reporte_mensual_fin` | termina, con enviados / sin movimientos / omitidos / fallidos y cuánto tardó | INFO |
| `reporte_mensual_error_usuario` | falló un usuario; el resto sigue | ERROR |
| `reporte_mensual_error` | falló el job completo | ERROR |
| `reporte_mensual_rechazado` | alguien llamó al endpoint sin un token válido | ERROR |
| `correo_omitido` | no hay proveedor de correo configurado | INFO |

Para verlos en la consola, en Cloud Logging:

```
resource.type="cloud_run_revision"
resource.labels.service_name="finansync"
jsonPayload.evento="reporte_mensual_fin"
```

## Alertas

Dos políticas, en los archivos de esta carpeta:

**`alerta-reporte-mensual.json`** — avisa si el job del estado de cuenta
registra un error. Es la que importa: el job corre una vez al mes, así que si
falla y nadie se entera, el mes se pierde. Se limita a un aviso por hora para
que un fallo con muchos usuarios no mande cien correos.

**`alerta-errores-5xx.json`** — avisa si el servicio pasa de cinco respuestas
5xx en cinco minutos. Cubre caídas de Vertex AI, de Cloud Vision o de la base.

## Cómo crearlas

Primero el canal al que llegan los avisos (una sola vez):

```bash
gcloud beta monitoring channels create \
  --display-name="Correo del equipo" \
  --type=email \
  --channel-labels=email_address=TU_CORREO \
  --project=finansync-74cd1
```

Ese comando devuelve el id del canal. Se copia dentro de `notificationChannels`
en los dos JSON, y después:

```bash
gcloud alpha monitoring policies create \
  --policy-from-file=monitoring/alerta-reporte-mensual.json \
  --project=finansync-74cd1

gcloud alpha monitoring policies create \
  --policy-from-file=monitoring/alerta-errores-5xx.json \
  --project=finansync-74cd1
```

Si se dejan los `notificationChannels` vacíos, las políticas igual se crean y se
ven en la consola, pero no avisan a nadie: solo quedan registradas como
incidentes.

## Cómo probar que la alerta sirve

Llamar al endpoint mensual con un token incorrecto genera un
`reporte_mensual_rechazado` con severidad ERROR, que es la forma más rápida de
ver un registro de error entrando a Cloud Logging sin romper nada:

```bash
curl -X POST "https://URL-DE-CLOUD-RUN/api/reportes/mensual" -H "x-cron-token: incorrecto"
```
