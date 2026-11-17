# Entrega con confirmación de las alertas PM

El trabajador de Hermes guarda en la bitácora privada un lote FLOTA por fecha de Panamá. Empieza a las 06:00. Congela el corte, la huella y el destino al preparar el lote. El historial registra cada intento, consulta, rechazo y confirmación. La confirmación requiere un acuse del destino con el mismo lote, huella y destino. Los intentos inciertos esperan al menos 15 minutos para verificar de nuevo. Una consulta incompleta deja el lote en revisión.

La política de Alertas PM calcula la escalación desde la detección del aviso. Vencido tiene 24 horas, Programar 48 horas y Pronto 168 horas. La bitácora acredita una escalación cuando confirma la entrega. Los resúmenes posteriores mantienen su corte vigente y conservan ese acuse.

La aceptación usa el receptor sintético en 127.0.0.1. Ejecuta `node --test tests/api/hermes-panama-alert-delivery.test.mjs` o el escenario integrado `API-ALERTAS-PM-CONFIRMACION`. El receptor expone sus acuses y su cuenta real de entregas para comprobar pérdidas de respuesta y concurrencia.

Para conectar un canal real, el piloto requiere un destino autorizado y un adaptador que respete la clave idempotente del lote y pueda verificar el acuse completo. El trabajador queda disponible para ese enlace explícito. Las automatizaciones existentes continúan con sus flujos y destinatarios vigentes.
