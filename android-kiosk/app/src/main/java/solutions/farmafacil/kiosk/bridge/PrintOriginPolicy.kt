package solutions.farmafacil.kiosk.bridge

import java.net.URI
import java.util.concurrent.atomic.AtomicReference

/**
 * Allowlist de hosts para impresión (misma regla que [solutions.farmafacil.kiosk.MainActivity]).
 * No ampliar sin revisión de seguridad.
 *
 * [hostFromUrl] usa [URI] (JVM-safe) en lugar de WebView/android.net.Uri para poder
 * validar el origen fuera del hilo del JavascriptInterface y en tests unitarios.
 */
object PrintOriginPolicy {
    /**
     * @param strict si true (APK staging), no acepta el comodín `*.vercel.app`.
     */
    fun isHostAllowed(
        host: String?,
        allowedHost: String,
        strict: Boolean = false,
    ): Boolean {
        if (host.isNullOrBlank() || allowedHost.isBlank()) return false
        if (isProductionHost(host) && allowedHost != "app.farmafacil.solutions") {
            return false
        }
        val exactOrSub =
            host == allowedHost || host.endsWith(".$allowedHost")
        if (exactOrSub) return true
        if (strict) return false
        return host.endsWith(".vercel.app")
    }

    /** Hosts de producción que la APK staging no debe cargar ni autorizar a imprimir. */
    fun isProductionHost(host: String?): Boolean {
        if (host.isNullOrBlank()) return false
        return host == "app.farmafacil.solutions" ||
            host.endsWith(".app.farmafacil.solutions") ||
            host == "www.farmafacil.solutions" ||
            host == "farmafacil.solutions"
    }

    /** Extrae el host de una URL absoluta; null si no es parseable. */
    fun hostFromUrl(url: String?): String? {
        if (url.isNullOrBlank()) return null
        return try {
            URI(url).host
        } catch (_: Throwable) {
            null
        }
    }
}

/**
 * Estado de origen validado para el puente JS.
 *
 * Actualizar solo desde el hilo UI (WebViewClient).
 * Leer desde el hilo de [@android.webkit.JavascriptInterface] es seguro (AtomicReference).
 *
 * Contrato:
 * - Al iniciar navegación de frame principal → [invalidate]
 * - Tras carga OK → [validateMainFrameUrl] (autoriza solo si el host está en allowlist)
 * - Error de frame principal → [invalidate]
 * - No reutiliza un origen previo durante navegación nueva o fallida
 */
class PrintOriginSession(
    private val allowedHost: String,
    private val strict: Boolean = false,
) {
    private val validatedHost = AtomicReference<String?>(null)

    fun invalidate() {
        validatedHost.set(null)
    }

    /**
     * @return true si el host de [url] está permitido y queda autorizado.
     */
    fun validateMainFrameUrl(url: String?): Boolean {
        val host = PrintOriginPolicy.hostFromUrl(url)
        if (!PrintOriginPolicy.isHostAllowed(host, allowedHost, strict)) {
            validatedHost.set(null)
            return false
        }
        validatedHost.set(host)
        return true
    }

    /** true solo si hay un host validado y sigue cumpliendo la allowlist. */
    fun isValidatedAllowed(): Boolean {
        val host = validatedHost.get() ?: return false
        if (!PrintOriginPolicy.isHostAllowed(host, allowedHost, strict)) {
            validatedHost.set(null)
            return false
        }
        return true
    }

    /** Host autorizado actual, o null si aún no validado / denegado. */
    fun currentValidatedHost(): String? {
        val host = validatedHost.get() ?: return null
        return if (PrintOriginPolicy.isHostAllowed(host, allowedHost, strict)) host else null
    }
}
