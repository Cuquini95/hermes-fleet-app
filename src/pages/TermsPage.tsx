import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const LAST_UPDATED = '16 de abril de 2026';
const EFFECTIVE_DATE = '16 de abril de 2026';

export default function TermsPage() {
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
        <h1 className="text-white font-semibold text-base">Términos y Condiciones</h1>
      </div>

      <div className="pt-20 pb-16 px-4 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">

          <div>
            <h2 className="text-xl font-bold text-gray-900">Términos y Condiciones de Uso</h2>
            <p className="text-sm text-gray-500 mt-1">
              Versión vigente desde: {EFFECTIVE_DATE} · Última actualización: {LAST_UPDATED}
            </p>
          </div>

          <Section title="1. Aceptación de los Términos">
            <p>
              Al acceder o utilizar la plataforma <strong>Hermes Fleet App</strong> (en adelante, "el Servicio"),
              usted acepta quedar vinculado por los presentes Términos y Condiciones de Uso (en adelante,
              "los Términos"). Si no está de acuerdo con alguna parte de los Términos, no podrá acceder al Servicio.
            </p>
            <p className="mt-2">
              El uso del Servicio por parte del Usuario implica la aceptación plena y sin reservas de todos
              los Términos aquí contenidos. Trans Plus México, S.A. de C.V. se reserva el derecho de modificar
              estos Términos en cualquier momento, notificando a los usuarios con anticipación razonable.
            </p>
          </Section>

          <Section title="2. Descripción del Servicio">
            <p>
              Hermes Fleet App es una plataforma de gestión de flota vehicular diseñada para empresas de
              transporte. Permite a los usuarios:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Realizar y registrar inspecciones diarias de vehículos (DVIR).</li>
              <li>Reportar fallas mecánicas y gestionar órdenes de trabajo.</li>
              <li>Controlar registros de combustible, horómetros y viajes.</li>
              <li>Administrar gastos operativos y generar reportes.</li>
              <li>Programar mantenimientos preventivos y correctivos.</li>
              <li>Gestionar inventario de refacciones y pedidos.</li>
              <li>Comunicarse a través del asistente de inteligencia artificial integrado.</li>
            </ul>
            <p className="mt-2 text-sm text-gray-600">
              El Servicio está diseñado para operar en modo sin conexión (PWA) y sincronizarse cuando
              se restablezca la conectividad a internet.
            </p>
          </Section>

          <Section title="3. Registro y Cuentas de Usuario">
            <p>
              El acceso al Servicio está <strong>restringido exclusivamente a empleados y colaboradores
              autorizados</strong> de Trans Plus México y las empresas que contraten el Servicio. No existe
              registro público o autoregistro.
            </p>
            <p className="mt-2">Las credenciales de acceso son:</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Personales e intransferibles.</li>
              <li>Responsabilidad del usuario mantenerlas confidenciales.</li>
              <li>Asignadas por el administrador del sistema.</li>
            </ul>
            <p className="mt-2">
              El usuario es responsable de todas las acciones realizadas bajo su cuenta.
              Deberá notificar de inmediato cualquier uso no autorizado a{' '}
              <a href="mailto:soporte@transplus.mx" className="text-blue-600 underline">
                soporte@transplus.mx
              </a>.
            </p>
          </Section>

          <Section title="4. Uso Aceptable">
            <p>El usuario se compromete a utilizar el Servicio únicamente para fines operativos legítimos
              relacionados con la gestión de flota vehicular. Queda expresamente prohibido:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Acceder al Servicio con credenciales ajenas o no autorizadas.</li>
              <li>Introducir datos falsos, alterados o engañosos en cualquier registro.</li>
              <li>Intentar eludir, desactivar o interferir con mecanismos de seguridad.</li>
              <li>Realizar ingeniería inversa, descompilar o desensamblar el software.</li>
              <li>Utilizar el Servicio para fines distintos a los establecidos por el empleador.</li>
              <li>Compartir capturas de pantalla o información del sistema con terceros no autorizados.</li>
              <li>Cargar contenido que infrinja derechos de terceros, sea ilegal u obsceno.</li>
            </ul>
            <p className="mt-2 text-sm text-gray-600">
              El incumplimiento de estas restricciones puede resultar en la suspensión inmediata del acceso
              y, en su caso, en responsabilidad civil o penal conforme a la legislación mexicana aplicable.
            </p>
          </Section>

          <Section title="5. Limitaciones de Responsabilidad">
            <p>
              <strong>Trans Plus México proporciona el Servicio "tal cual" y "según disponibilidad".</strong>{' '}
              En la medida máxima permitida por la ley, Trans Plus no garantiza:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Disponibilidad ininterrumpida o sin errores del Servicio.</li>
              <li>Que el Servicio satisfaga todos los requisitos específicos del usuario.</li>
              <li>La exactitud de los datos generados automáticamente por el sistema.</li>
            </ul>
            <p className="mt-2">
              Trans Plus no será responsable por daños indirectos, incidentales, especiales o consecuentes
              que resulten del uso o la imposibilidad de uso del Servicio, incluyendo pérdida de datos,
              pérdida de ingresos o interrupciones del negocio, salvo en los casos en que la ley mexicana
              aplicable no permita tal limitación.
            </p>
            <p className="mt-2 text-sm text-gray-600">
              La responsabilidad total de Trans Plus ante el usuario no excederá, en ningún caso, el monto
              pagado por el Servicio en los 3 meses anteriores al evento que origina la reclamación.
            </p>
          </Section>

          <Section title="6. Propiedad Intelectual">
            <p>
              Todos los derechos de propiedad intelectual sobre el Servicio, incluyendo pero no limitado a
              código fuente, diseño, marcas, logotipos, íconos, texto y documentación, son propiedad exclusiva
              de Trans Plus México o sus licenciantes.
            </p>
            <p className="mt-2">
              Se otorga al usuario una licencia limitada, no exclusiva, no transferible y revocable para
              usar el Servicio exclusivamente para los fines descritos en estos Términos. Ninguna disposición
              de estos Términos transfiere al usuario ningún derecho de propiedad intelectual.
            </p>
          </Section>

          <Section title="7. Privacidad y Protección de Datos">
            <p>
              El tratamiento de datos personales en el Servicio se rige por el{' '}
              <strong>Aviso de Privacidad Integral</strong> de Trans Plus México, disponible en la sección
              de Privacidad de la aplicación y en{' '}
              <a href="/privacy" className="text-blue-600 underline">
                Aviso de Privacidad
              </a>.
            </p>
            <p className="mt-2 text-sm text-gray-600">
              Al aceptar estos Términos, el usuario reconoce haber leído y comprendido el Aviso de Privacidad.
            </p>
          </Section>

          <Section title="8. Suspensión y Terminación">
            <p>
              Trans Plus puede suspender o terminar el acceso del usuario al Servicio en cualquier momento,
              con o sin causa, con o sin previo aviso, en particular cuando:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>El usuario infrinja estos Términos.</li>
              <li>El empleador revoque la autorización del usuario.</li>
              <li>Se detecte actividad fraudulenta o sospechosa.</li>
              <li>Así lo requieran obligaciones legales.</li>
            </ul>
            <p className="mt-2">
              La terminación no exime al usuario de responsabilidades por conductas anteriores a la misma.
            </p>
          </Section>

          <Section title="9. Modificaciones al Servicio">
            <p>
              Trans Plus se reserva el derecho de modificar, suspender o descontinuar cualquier parte del
              Servicio en cualquier momento. Realizará esfuerzos razonables para notificar cambios
              significativos con anticipación a través de la propia aplicación.
            </p>
          </Section>

          <Section title="10. Ley Aplicable y Jurisdicción">
            <p>
              Estos Términos se regirán e interpretarán de conformidad con las leyes de los{' '}
              <strong>Estados Unidos Mexicanos</strong>, sin dar efecto a ningún principio de conflicto
              de leyes.
            </p>
            <p className="mt-2">
              Para la resolución de cualquier controversia derivada de estos Términos, las partes se someten
              expresamente a la jurisdicción de los tribunales competentes de la{' '}
              <strong>Ciudad de México</strong>, renunciando a cualquier otro fuero que pudiera corresponderles
              en razón de su domicilio presente o futuro.
            </p>
          </Section>

          <Section title="11. Disposiciones Generales">
            <p>
              Si alguna disposición de estos Términos fuera declarada nula o inaplicable, las demás
              disposiciones continuarán en plena vigencia. La falta de ejercicio de cualquier derecho
              previsto en estos Términos no constituye renuncia al mismo.
            </p>
            <p className="mt-2">
              Estos Términos constituyen el acuerdo completo entre Trans Plus y el usuario respecto al
              uso del Servicio y reemplazan cualquier acuerdo anterior sobre el mismo objeto.
            </p>
          </Section>

          <Section title="12. Contacto">
            <p>
              Para consultas sobre estos Términos, contacte a:{' '}
              <a href="mailto:legal@transplus.mx" className="text-blue-600 underline">
                legal@transplus.mx
              </a>
            </p>
          </Section>

          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs text-gray-400 text-center">
              Términos y Condiciones — Hermes Fleet App · Vigentes desde: {EFFECTIVE_DATE}
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
