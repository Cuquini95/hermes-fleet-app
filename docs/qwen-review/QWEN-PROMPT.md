# Prompt para Qwen — Review estratégico de Hermes Fleet

**Instrucciones de uso:** copia todo el contenido de este archivo + todo el contenido de `HERMES-FLEET-CODE-BUNDLE.md` en una sola ventana de chat con Qwen (Qwen3-Max o Qwen-Long recomendado por el tamaño del contexto, ~90K tokens de código).

---

## Rol y contexto

Actúas como un **arquitecto de software senior con experiencia en ERP de minería y en SaaS para LatAm**. Vas a revisar el código de una aplicación llamada **Hermes Fleet** y darme recomendaciones accionables, priorizadas, y con ejemplos concretos de cambios en el código cuando aplique.

## Contexto estratégico — muy importante

**Hermes Fleet** es una aplicación web (PWA) construida para operaciones de **transporte y mantenimiento de flotas en minería**. Está diseñada como una alternativa ágil, móvil-primero, y hablada en español a los ERP pesados como **SAP S/4HANA (módulos PM, MM, Fleet)**, **Oracle EBS**, e **IBM Maximo**.

### El mercado objetivo

- Minas medianas y grandes en **México, Chile, Perú, Colombia, Brasil**
- Operaciones con **15–500 equipos pesados** (camiones volteo, cargadores frontales, excavadoras, perforadoras)
- Empresas que hoy usan Excel + WhatsApp + bitácoras en papel, o que están descontentas con SAP por ser lento, caro y difícil de usar para operadores de campo

### El posicionamiento vs SAP

SAP gana porque: cumplimiento, integración ERP, reportería financiera, marca confiable para minería grande
SAP pierde porque: implementación de 12–18 meses, licencias de >$500k USD/año, UX hostil para operadores de campo, no funciona sin internet, no es "móvil primero", la curva de aprendizaje es brutal, las customizaciones son dolorosas

**Hermes Fleet gana si:** despliega en días no meses, cuesta 1/20 de SAP, los operadores con teléfono barato en la mina lo pueden usar sin entrenamiento, funciona offline, captura datos con cámara y voz (OCR, foto-a-falla con IA), y tiene valor real el día 1 (no el mes 6).

### Lo que ya existe (features actuales)

Estas son las cosas que Hermes Fleet ya hace hoy, que vas a ver en el código:

1. **Auth por roles con PIN** — operador, mecánico, jefe de taller, coordinador, supervisor, gerencia (ver `auth-store.ts`, `types/roles.ts`, `RequireRole.tsx`)
2. **DVIR/Pre-check de unidades** — checklist digital por operador antes de cada turno (`DVIRPage.tsx`)
3. **Reporte de fallas con foto** — operador toma foto, IA analiza severidad y tipo de daño (`FallaPage.tsx`, `hermes-api.ts` `photoToFailure`)
4. **Órdenes de trabajo (OT)** — creación, asignación, status log, progreso, costo (`workorder-store.ts`, `WorkOrderDetailPage.tsx`)
5. **Mantenimiento preventivo (PM)** — calendario basado en horas/km, generación de órdenes PM automáticas, catálogo de partes (`PMSchedulePage.tsx`, `PMWorkOrderPage.tsx`, `pm-rules.ts`)
6. **Búsqueda de partes e inventario** — base de conocimiento conectada a partes (`PartsSearch.tsx`, `InventoryPage.tsx`)
7. **Diagnóstico IA (Hermes Chat)** — el mecánico pregunta síntomas, la IA responde con causas probables, checklist, y partes (`ChatPage.tsx`, `hermes-api.ts` `diagnose`)
8. **Consulta de manuales y diagramas** — OCR-indexado de PDFs de manuales, con referencia a página (`ManualSearch.tsx`, `DiagramViewer.tsx`)
9. **Reportes de combustible (diesel)** — captura por operador con foto de bomba (`DieselPage.tsx`)
10. **Reportes de horómetro** — lectura manual para trigger de PM (`HorometroPage.tsx`)
11. **Reporte de fletes/viajes** — captura por viaje, con modo "varios viajes del día" para cuando el operador no tiene señal en campo (`ViajePage.tsx`)
12. **Gastos / facturas** — captura con **OCR de recibos** (el operador fotografía la factura, IA extrae proveedor/RFC/folio/subtotal/IVA/total/line items), multi-unidad split, reporte PDF descargable con logo de marca (`NuevoGastoPage.tsx`, `GastosPage.tsx`, `gastos-pdf.ts`)
13. **Catálogo de precios auto-aprendido** — cada vez que se registra un gasto con partes, el sistema actualiza un catálogo compartido con precio mínimo/máximo/último/proveedor, y lo usa para autocompletar futuros pedidos (`catalogo-store.ts`, integrado en `PedidosPage.tsx`)
14. **Pedidos de refacciones** — carrito compartido, envío a cotización, historial con status, autocomplete desde catálogo (`PedidosPage.tsx`)
15. **Neumáticos** — gestión de posiciones, rotación, vida útil (`NeumaticosPage.tsx`)
16. **Dashboard ejecutivo** — KPIs de flota, disponibilidad, briefing diario (`DashboardPage.tsx`)
17. **Offline queue** — submissions en IndexedDB cuando no hay señal, flush automático al reconectar (`offline-queue.ts`)
18. **Alertas** — stock bajo, PM vencidos, averías críticas (`AlertsPage.tsx`)

### Stack técnico

- **Frontend**: React 19, TypeScript, Vite 8, TailwindCSS 4, Zustand, React Router 7, lucide-react, recharts, jsPDF
- **Backend**: FastAPI en Python corriendo en VPS, proxied via `/hermes-api/*`, con Google Sheets como base de datos principal (sí, literalmente Sheets) — porque los clientes ya viven en Sheets y eso es lo que el contador entiende
- **IA**: el backend integra Claude/GPT para diagnóstico, OCR, y lookup de manuales
- **Deploy**: Vercel (frontend), VPS 5.78.204.80 (backend FastAPI)
- **Auth**: PIN simple por rol (mock users por ahora, está pendiente migrar a auth real)

### Lo que NO quiero que me digas

- Que use TypeScript (ya lo uso)
- Que use linting (ya tengo ESLint)
- "Deberías tener tests" genéricos sin decirme exactamente qué testear
- Recomendaciones abstractas de arquitectura sin ejemplos de código o impacto medible
- Feedback sobre estilo de código (indentación, nombres de variables) — eso no es valor estratégico

## Lo que sí quiero

Revisa el código con los ojos puestos en **ganar clientes de minería a SAP**. Quiero que me digas exactamente qué cambiar, agregar o eliminar para que Hermes Fleet sea un producto que un gerente general de una mina mediana elija sobre SAP. Organiza tu respuesta así:

---

### 1. VEREDICTO INICIAL (2-3 párrafos)

Dame tu impresión sincera del estado actual del código y del producto como alternativa a SAP. ¿Es realista competir? ¿En qué dimensiones ya le gana? ¿En cuáles está muy atrás? ¿Qué nivel de minería razonablemente puede atender hoy (small/mid/enterprise)?

### 2. ESTADO ACTUAL DEL CÓDIGO — fortalezas y debilidades

**Fortalezas reales** (no hagas lista de cortesía — dime qué está bien hecho y por qué importa para el negocio).

**Debilidades críticas** (las que un CTO de un cliente minero vería en un due diligence y lo asustarían).

### 3. BRECHAS FUNCIONALES vs SAP PM / MAXIMO / ORACLE EBS

Compara feature-por-feature con SAP PM (Plant Maintenance), IBM Maximo y Oracle EAM en el contexto específico de minería. Dime qué le falta a Hermes Fleet que un cliente minero mediano/grande daría por sentado. Ejemplos: OT multi-nivel con jerarquía, integración con sensores IoT, compliance MSHA/CMI, presupuestos anuales, órdenes de compra con aprobaciones multi-paso, integración con SAP S/4HANA vía API para clientes híbridos, reportería financiera con GL, centros de costo por sitio, ciclo completo de procurement, trazabilidad de activos con serial numbers, HSE/seguridad laboral, firmas digitales con compliance, etc.

Para cada brecha identificada, clasifícala:
- **CRÍTICA** — sin esto no hay venta con minería grande
- **ALTA** — no bloquea la venta pero reduce el cierre
- **MEDIA** — nice to have, diferenciador
- **BAJA** — opcional

### 4. RIESGOS DE ESCALABILIDAD

Google Sheets como base de datos. Estoy usando `gspread` en el VPS. ¿Cuándo se rompe esto? ¿A cuántos registros? ¿A cuántos usuarios concurrentes? ¿Qué patrón específico me explota primero? ¿Cuál es el path de migración a Postgres sin romper a los clientes existentes? Dame números concretos (ej: "con >10,000 filas en la pestaña Gastos el read_range toma >5s"), y el archivo/función exacto que tengo que cambiar cuando llegue ese momento.

Otros riesgos a analizar: el auth mock en `auth-store.ts`, el storage `partialize` en Zustand, el `offline-queue` con IndexedDB y su estrategia de reintentos, el hecho de que `sheets-api.ts` no tiene retry ni timeout configurables, el acoplamiento de stores a `SHEET_TABS`.

### 5. SEGURIDAD Y CUMPLIMIENTO

Revisa el código con ojos de pentester pensando en un cliente minero que tiene que cumplir con:
- Auditorías SOX / ISO 27001
- Trazabilidad de cambios en datos financieros (gastos, OT costos)
- Protección de PII (RFC, nombres de empleados)
- Aislamiento multi-tenant (hoy es single-tenant, ¿cómo lo convierto a multi-tenant sin rewrite?)
- Integridad de datos contra usuarios maliciosos o con PINs compartidos

Señala cada vulnerabilidad real (no teórica) en el código con archivo:línea si puedes. Prioriza por severidad (CRITICAL/HIGH/MEDIUM).

### 6. QUICK WINS — top 10 mejoras con mayor ROI

Dame 10 cambios concretos, pequeños, de 1-3 días de trabajo cada uno, que aumenten materialmente el valor percibido del producto para un cliente minero. Cada uno con:
- **Qué**: cambio específico con archivo(s) a tocar
- **Por qué importa para ventas**: conexión directa a un beneficio de negocio
- **Esfuerzo**: días de un dev senior
- **Impacto**: alto/medio/bajo en cierre de deals

### 7. CAMBIOS DE ARQUITECTURA — top 3 apuestas grandes

Las 3 apuestas más grandes que me recomendarías hacer en los próximos 3-6 meses para que Hermes Fleet sea genuinamente capaz de competir por cuentas de minería grande (>200 equipos, >$100M USD facturación). Cada una con:
- **Qué**: descripción concreta
- **Por qué es crítica**: cuál es el deal-breaker que resuelve
- **Costo**: semanas/meses de dev
- **Cómo evitar el rewrite**: estrategia de migración incremental

### 8. DIFERENCIACIÓN — qué puede hacer Hermes que SAP NO puede

SAP es lento, caro y tieso. ¿Qué puede hacer Hermes Fleet gracias a que es nativo-IA, nativo-móvil y nativo-LatAm que SAP fundamentalmente NO puede hacer o tardaría años en replicar? Dame ideas de features que sean **anti-SAP por diseño**: cosas que explotan velocidad, UX móvil, voz/foto/IA, y conocimiento local. Estas son las armas asimétricas.

### 9. MODELO DE PRECIOS Y PACKAGING

Revisa las features y sugiéreme cómo empaquetarlas en planes (Starter / Pro / Enterprise) y precios sugeridos en USD/mes por equipo o por sitio. Justifica con: qué le vendo a cada tier, qué retengo para el upsell, y cómo lo comparo contra SAP en un deck de ventas.

### 10. PRÓXIMOS 30 / 60 / 90 DÍAS

Dame un roadmap concreto de ejecución:
- **Días 1-30**: qué hacer PRIMERO para cerrar la primera venta piloto
- **Días 31-60**: qué agregar para cerrar la segunda y tercera
- **Días 61-90**: qué empezar a construir para la primera venta real de 6 dígitos

---

## Reglas para tu respuesta

- **Sé brutalmente honesto** — no me protejas. Prefiero una revisión dura y útil que cortesía de consultor.
- **Cita código con `archivo.ts:línea`** cuando señales un problema.
- **Números sobre adjetivos** — "esto aguanta ~5,000 filas antes de degradar" es mejor que "esto no escala bien".
- **Ejemplos de código** cuando propongas un cambio técnico, no solo descripciones.
- **Español** para toda la respuesta (mi equipo es LatAm).
- **Prioriza impacto comercial** — cada recomendación debe conectar a "esto me ayuda a ganarle a SAP en un deal real".

Al final, dame un **resumen ejecutivo de 1 párrafo** que pueda leerle en voz alta a un inversor o a un co-founder, con la tesis de si Hermes Fleet tiene chance realista de ganar cuentas mineras a SAP, y qué es lo más importante que debo hacer esta semana.

---

**Abajo está el código completo. Empieza el review.**
