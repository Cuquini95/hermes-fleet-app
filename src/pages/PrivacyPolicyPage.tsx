import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const LAST_UPDATED = '16 de abril de 2026';

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4"
        style={{ height: 64, backgroundColor: '#162252' }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl text-white/80 hover:text-white transition-colors"
          aria-label="Regresar"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-white font-semibold text-base">Aviso de Privacidad</h1>
      </div>

      <div className="pt-20 pb-16 px-4 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">

          <div>
            <h2 className="text-xl font-bold text-gray-900">Aviso de Privacidad Integral</h2>
            <p className="text-sm text-gray-500 mt-1">
              Última actualización: {LAST_UPDATED}
            </p>
            <p className="text-sm text-gray-600 mt-3">
              De conformidad con lo establecido en la{' '}
              <strong>Ley Federal de Protección de Datos Personales en Posesión de los Particulares</strong>{' '}
              (LFPDPPP), su Reglamento y los Lineamientos del Aviso de Privacidad emitidos por el INAI,
              Trans Plus México, S.A. de C.V. pone a disposición de los titulares el presente Aviso de Privacidad.
            </p>
          </div>

          <Section title="I. Responsable del Tratamiento">
            <p>
              <strong>Trans Plus México, S.A. de C.V.</strong><br />
              [Domicilio fiscal — completar antes de publicación]<br />
              Ciudad de México, México<br />
              Correo electrónico de contacto:{' '}
              <a href="mailto:privacidad@transplus.mx" className="text-blue-600 underline">
                privacidad@transplus.mx
              </a>
            </p>
            <p className="text-sm text-gray-500 mt-2">
              (El responsable es la entidad legal que determina los fines y medios del tratamiento de sus datos.)
            </p>
          </Section>

          <Section title="II. Datos Personales Recabados">
            <p>Para los fines descritos en este aviso, Trans Plus recaba las siguientes categorías de datos personales:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Datos de identificación:</strong> nombre completo, fotografía de perfil.</li>
              <li><strong>Datos laborales:</strong> puesto/rol dentro de la flota, unidades asignadas, número de operador.</li>
              <li><strong>Datos de operación:</strong> registros de inspección vehicular (DVIR), reportes de fallas, lecturas de horómetro, registros de diesel, registros de viajes, gastos operativos y archivos fotográficos adjuntos.</li>
              <li><strong>Datos de dispositivo:</strong> identificador del navegador, dirección IP (registrada por el servidor VPS para efectos de seguridad y auditoría), información de sesión.</li>
              <li><strong>Datos de ubicación:</strong> únicamente si el usuario activa manualmente la función de GPS (no habilitada por defecto).</li>
              <li><strong>Grabaciones de voz:</strong> únicamente si el usuario utiliza la función de asistente por voz (no habilitada por defecto); los fragmentos de audio se procesan en tiempo real y no se almacenan de forma permanente.</li>
            </ul>
            <p className="text-sm text-gray-500 mt-2">
              No se recaban datos personales sensibles en términos del artículo 3, fracción VI de la LFPDPPP.
            </p>
          </Section>

          <Section title="III. Finalidades del Tratamiento">
            <p>Los datos personales recabados serán utilizados para las siguientes finalidades:</p>
            <p className="font-medium mt-2">Finalidades primarias (necesarias para la prestación del servicio):</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Gestión de flota vehicular y control de activos.</li>
              <li>Registro y seguimiento de inspecciones diarias de vehículos (DVIR) para cumplimiento normativo.</li>
              <li>Programación y control de mantenimientos preventivos y correctivos.</li>
              <li>Registro de operaciones de combustible y horómetros.</li>
              <li>Gestión de órdenes de trabajo mecánicas.</li>
              <li>Control y trazabilidad de gastos operativos.</li>
              <li>Comunicación interna entre operadores, mecánicos y supervisores.</li>
              <li>Cumplimiento de obligaciones legales y regulatorias ante la SCT y demás autoridades aplicables.</li>
            </ul>
            <p className="font-medium mt-3">Finalidades secundarias (opcionales — puede oponerse mediante correo a privacidad@transplus.mx):</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Generación de reportes estadísticos de desempeño operativo.</li>
              <li>Mejora del servicio y funcionalidades de la plataforma Hermes.</li>
            </ul>
          </Section>

          <Section title="IV. Transferencias de Datos Personales">
            <p>
              Trans Plus puede transferir sus datos personales a los siguientes terceros con las finalidades indicadas.
              En todos los casos, se exige a los receptores confidencialidad equivalente a la aquí establecida.
            </p>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left p-2 border border-gray-200">Receptor</th>
                    <th className="text-left p-2 border border-gray-200">País</th>
                    <th className="text-left p-2 border border-gray-200">Finalidad</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2 border border-gray-200">Proveedor de VPS (servidor propio)</td>
                    <td className="p-2 border border-gray-200">México / EE.UU.</td>
                    <td className="p-2 border border-gray-200">Alojamiento y procesamiento de datos operativos</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-2 border border-gray-200">Supabase Inc.</td>
                    <td className="p-2 border border-gray-200">EE.UU.</td>
                    <td className="p-2 border border-gray-200">Almacenamiento de fotografías y archivos adjuntos; sincronización en tiempo real</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-gray-200">Google LLC (Google Sheets)</td>
                    <td className="p-2 border border-gray-200">EE.UU.</td>
                    <td className="p-2 border border-gray-200">Respaldo de registros operativos y reportes</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-2 border border-gray-200">OpenRouter Inc.</td>
                    <td className="p-2 border border-gray-200">EE.UU.</td>
                    <td className="p-2 border border-gray-200">Procesamiento de consultas del asistente de inteligencia artificial (solo texto de la consulta, sin datos personales innecesarios)</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-gray-200">Meta Platforms Ireland Ltd.</td>
                    <td className="p-2 border border-gray-200">Irlanda / EE.UU.</td>
                    <td className="p-2 border border-gray-200">Envío de notificaciones operativas vía WhatsApp Business API</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Las transferencias internacionales señaladas se realizan bajo cláusulas contractuales o estándares
              reconocidos de protección equivalente, conforme al artículo 37 de la LFPDPPP.
            </p>
          </Section>

          <Section title="V. Derechos ARCO">
            <p>
              Usted tiene derecho a <strong>Acceder, Rectificar, Cancelar u Oponerse</strong> (derechos ARCO)
              al tratamiento de sus datos personales. Para ejercer estos derechos deberá presentar una solicitud que contenga:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Nombre completo y datos de contacto.</li>
              <li>Descripción clara del derecho que desea ejercer.</li>
              <li>Documentación que acredite su identidad.</li>
            </ul>
            <p className="mt-3">
              <strong>Canal de atención:</strong>{' '}
              <a href="mailto:privacidad@transplus.mx" className="text-blue-600 underline">
                privacidad@transplus.mx
              </a>
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Trans Plus responderá a su solicitud en un plazo máximo de 20 días hábiles contados desde la
              recepción de la solicitud completa, pudiendo prorrogarse por 20 días hábiles adicionales cuando
              las circunstancias lo justifiquen (artículo 32 LFPDPPP).
            </p>
            <p className="text-sm text-gray-600 mt-2">
              En caso de violación a sus derechos, podrá interponer queja o denuncia ante el{' '}
              <strong>Instituto Nacional de Transparencia, Acceso a la Información y Protección de Datos Personales (INAI)</strong>,
              con domicilio en Insurgentes Sur 3211, Ciudad de México.
            </p>
          </Section>

          <Section title="VI. Notificación de Vulnerabilidades de Seguridad">
            <p>
              En caso de que ocurra una vulnerabilidad de seguridad que afecte de forma significativa
              los derechos patrimoniales o morales de los titulares, Trans Plus lo notificará a los afectados
              de forma inmediata y, en todo caso, <strong>dentro de los 5 días hábiles siguientes</strong> a
              que conozca el incidente, en cumplimiento del artículo 20 de la LFPDPPP.
            </p>
            <p className="text-sm text-gray-600 mt-2">
              La notificación indicará: la naturaleza del incidente, los datos comprometidos, las recomendaciones
              al titular para proteger sus intereses y las medidas correctivas adoptadas.
            </p>
          </Section>

          <Section title="VII. Uso de Tecnologías de Almacenamiento Local">
            <p>
              La aplicación Hermes utiliza las siguientes tecnologías de almacenamiento en su dispositivo:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                <strong>localStorage:</strong> para guardar preferencias de sesión, caché de datos operativos
                (TTL 30 segundos) y su aceptación del presente aviso.
              </li>
              <li>
                <strong>IndexedDB:</strong> para almacenamiento offline de formularios pendientes de envío
                cuando no hay conexión a internet.
              </li>
              <li>
                <strong>Service Worker / Cache API:</strong> para funcionamiento sin conexión (PWA).
                Solo almacena recursos estáticos de la aplicación, no datos personales.
              </li>
            </ul>
            <p className="text-sm text-gray-500 mt-2">
              <strong>No utilizamos cookies de seguimiento de terceros.</strong> El almacenamiento descrito
              es estrictamente funcional y necesario para la operación de la aplicación.
            </p>
          </Section>

          <Section title="VIII. Limitación de Uso o Divulgación">
            <p>
              Si desea que sus datos personales no sean tratados para las finalidades secundarias indicadas,
              puede manifestarlo enviando un correo a{' '}
              <a href="mailto:privacidad@transplus.mx" className="text-blue-600 underline">
                privacidad@transplus.mx
              </a>{' '}
              indicando su nombre completo y el derecho que desea ejercer.
            </p>
          </Section>

          <Section title="IX. Cambios al Aviso de Privacidad">
            <p>
              Trans Plus se reserva el derecho de modificar el presente Aviso de Privacidad para adaptarlo
              a cambios legislativos, jurisprudenciales, de política interna o nuevas funcionalidades del servicio.
              Cualquier modificación será comunicada a través de la propia aplicación Hermes con al menos
              5 días de anticipación antes de entrar en vigor, salvo que la ley requiera un plazo diferente.
            </p>
          </Section>

          <Section title="X. Contacto del Responsable">
            <p>
              Para cualquier consulta relacionada con el tratamiento de sus datos personales o el ejercicio
              de sus derechos ARCO:
            </p>
            <div className="bg-gray-50 rounded-xl p-4 mt-3 space-y-1">
              <p><strong>Trans Plus México, S.A. de C.V.</strong></p>
              <p>Departamento de Privacidad y Protección de Datos</p>
              <p>
                Correo:{' '}
                <a href="mailto:privacidad@transplus.mx" className="text-blue-600 underline">
                  privacidad@transplus.mx
                </a>
              </p>
              <p>Horario de atención: Lunes a viernes de 9:00 a 18:00 hrs (hora del Centro de México)</p>
            </div>
          </Section>

          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs text-gray-400 text-center">
              Aviso de Privacidad — Hermes Fleet App · Última actualización: {LAST_UPDATED}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-gray-900 mb-2">{title}</h3>
      <div className="text-sm text-gray-700 space-y-2">{children}</div>
    </div>
  );
}
