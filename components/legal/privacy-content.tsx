/**
 * Contenido de Política de Privacidad.
 * Sustituible sin cambiar la ruta /legal/privacidad.
 * BORRADOR — no es texto jurídico definitivo.
 */
export function PrivacyContent() {
  return (
    <>
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">1. Introducción</h2>
        <p className="text-muted-foreground">
          Este documento es un borrador informativo sobre el tratamiento de
          datos personales en FarmaFácil. La política definitiva será publicada
          tras revisión jurídica, manteniendo esta misma ruta.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">
          2. Datos que pueden tratarse
        </h2>
        <p className="text-muted-foreground">
          Con carácter general, la plataforma puede tratar datos de cuenta
          (identificación, email, credenciales) y datos de uso necesarios para
          prestar el servicio a la farmacia. El inventario completo de
          categorías, bases de legitimación y plazos de conservación se
          detallará en la versión jurídica definitiva.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">
          3. Finalidades
        </h2>
        <p className="text-muted-foreground">
          Los datos se utilizan para autenticar usuarios, gestionar el acceso
          multi-farmacia, operar el panel de gestión y cumplir obligaciones
          legales aplicables. No se describen aquí finalidades adicionales no
          confirmadas.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">4. Derechos</h2>
        <p className="text-muted-foreground">
          Los derechos de las personas interesadas (acceso, rectificación,
          supresión, oposición, limitación, portabilidad y reclamación ante la
          autoridad de control, cuando procedan) se concretarán en el texto
          jurídico definitivo, junto con el canal de ejercicio.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">
          5. Contenido pendiente
        </h2>
        <p className="text-muted-foreground">
          Quedan pendientes: identificación del responsable del tratamiento,
          encargados, transferencias internacionales si las hubiera, cookies y
          medidas de seguridad específicas. Este borrador no sustituye un aviso
          de privacidad formalmente aprobado.
        </p>
      </section>
    </>
  );
}
