/**
 * Ayuda visible: dónde obtener la serie del conjunto kiosko FarmaFácil.
 * Pasos alineados con DiagnosticAccessGate, MainActivity y UsbDiagnosticsActivity.
 */
export function EquipmentSerialHelp({ className }: { className?: string }) {
  return (
    <details
      className={
        className ??
        'rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground'
      }
    >
      <summary className="cursor-pointer font-medium text-foreground">
        ¿Dónde encuentro el número de serie?
      </summary>
      <div className="mt-3 space-y-3 text-xs leading-relaxed text-muted-foreground">
        <p>
          Tablet e impresora viajan juntas: el identificador del conjunto es el
          campo <strong className="text-foreground">Serial</strong> de la
          impresora ICOD en el diagnóstico USB (no pedimos un serial aparte de
          la tablet). El código <strong className="text-foreground">KSK-…</strong>{' '}
          sigue siendo el identificador interno permanente.
        </p>

        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
          La pantalla <strong>Diagnóstico USB</strong> solo existe en la
          compilación <strong>debug</strong> (
          <code className="rounded bg-amber-100 px-1">
            solutions.farmafacil.kiosk.debug
          </code>
          ). En la APK de producción (release) el gesto responde «Diagnóstico no
          disponible en esta versión» y no abre esa pantalla.
        </p>

        <ol className="list-decimal space-y-1.5 pl-4 text-foreground/90">
          <li>
            Instala la APK debug en el equipo (o úsala solo durante la
            configuración en almacén) con la impresora ICOD conectada por USB.
          </li>
          <li>
            En la pantalla principal del kiosko, toca <strong>5 veces</strong> la
            esquina superior derecha (zona discreta del hotspot).
          </li>
          <li>
            Se abre el diálogo «<strong>Diagnóstico USB (debug)</strong>». Pulsa
            «<strong>Abrir diagnóstico</strong>» (o «Cancelar» para cerrar).
          </li>
          <li>
            En la pantalla «<strong>Diagnóstico USB</strong>», localiza el
            dispositivo de la impresora ICOD (p. ej. Product Name{' '}
            <code className="rounded bg-muted px-1">ICOD_Thermal_Printer</code>,
            VID <code className="rounded bg-muted px-1">0x0483</code> / PID{' '}
            <code className="rounded bg-muted px-1">0x7540</code>).
          </li>
          <li>
            Copia el valor de la línea «<strong>Serial:</strong>». Si aparece
            «(requiere permiso USB)», pulsa «
            <strong>Solicitar permiso USB</strong>», concede el permiso del
            sistema y luego «<strong>Actualizar</strong>».
          </li>
          <li>
            Si no hay dispositivos, el informe muestra «No se detectaron
            dispositivos USB.» Revisa el cable/alimentación y vuelve a
            «Actualizar».
          </li>
        </ol>

        <p>
          <strong className="text-foreground">Equipos reales en campo:</strong>{' '}
          lee la serie con la APK debug durante el alta/configuración del
          conjunto en almacén o soporte; guarda el valor aquí y después
          despliega la APK release habitual. No uses inventarios inventados ni
          el serial de la tablet como sustituto.
        </p>
      </div>
    </details>
  );
}
