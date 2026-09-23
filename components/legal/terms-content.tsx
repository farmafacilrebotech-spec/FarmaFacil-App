/**
 * Contenido de Términos y Condiciones.
 * Sustituible sin cambiar la ruta /legal/terminos.
 * BORRADOR — no es texto jurídico definitivo.
 */
export function TermsContent() {
  return (
    <>
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">1. Objeto</h2>
        <p className="text-muted-foreground">
          El presente documento describe, de forma provisional, las condiciones
          generales de uso de la plataforma FarmaFácil. El texto definitivo será
          aportado tras revisión jurídica y sustituirá este borrador sin cambiar
          la URL pública.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">
          2. Ámbito de aplicación
        </h2>
        <p className="text-muted-foreground">
          FarmaFácil es una herramienta de gestión orientada a farmacias y a los
          usuarios autorizados por cada farmacia. El acceso se concede mediante
          invitación y membership asociada a una farmacia concreta.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">
          3. Uso del servicio
        </h2>
        <p className="text-muted-foreground">
          El usuario se compromete a utilizar la plataforma de forma lícita, a
          conservar la confidencialidad de sus credenciales y a no intentar
          acceder a datos de otras farmacias o usuarios no autorizados. El
          detalle de obligaciones, limitaciones de responsabilidad y causas de
          suspensión se completará en la versión jurídica definitiva.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">
          4. Contenido pendiente
        </h2>
        <p className="text-muted-foreground">
          Quedan pendientes de redacción y validación jurídica, entre otros:
          condiciones económicas si aplican, propiedad intelectual, duración,
          resolución, ley aplicable y jurisdicción. No se incluyen en este
          borrador afirmaciones legales no confirmadas.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">5. Contacto</h2>
        <p className="text-muted-foreground">
          Para dudas sobre estas condiciones, contacta con el equipo de
          FarmaFácil a través de los canales oficiales facilitados por la
          plataforma o por tu farmacia.
        </p>
      </section>
    </>
  );
}
