package solutions.farmafacil.kiosk.admin

import solutions.farmafacil.kiosk.BuildConfig

/**
 * Acceso a herramientas de diagnóstico USB.
 *
 * - En **debug**: permitido (instalación/campo de desarrollo).
 * - En **release**: deshabilitado. No hay PIN ni contraseña fija.
 *
 * No desbloquea el SO ni inicia/detiene Lock Task.
 * Device Owner / salida administrativa se documentan aparte.
 */
object DiagnosticAccessGate {
    /** Debug o flavor staging (pruebas de campo con ICOD). */
    fun isAllowed(): Boolean = BuildConfig.DEBUG || BuildConfig.ENABLE_DIAGNOSTICS
}
