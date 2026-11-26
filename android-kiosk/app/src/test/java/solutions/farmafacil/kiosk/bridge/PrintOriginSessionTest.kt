package solutions.farmafacil.kiosk.bridge

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PrintOriginSessionTest {

    private val allowed = "app.farmafacil.solutions"

    @Test
    fun allowsExactAndSubdomainAndVercelPreview() {
        assertTrue(PrintOriginPolicy.isHostAllowed("app.farmafacil.solutions", allowed))
        assertTrue(PrintOriginPolicy.isHostAllowed("preview.app.farmafacil.solutions", allowed))
        assertTrue(PrintOriginPolicy.isHostAllowed("farmafacil-app.vercel.app", allowed))
    }

    @Test
    fun stagingStrict_rejectsOtherVercelAndProduction() {
        val stagingHost = "farmafacil-staging.vercel.app"
        assertTrue(
            PrintOriginPolicy.isHostAllowed(stagingHost, stagingHost, strict = true),
        )
        assertFalse(
            PrintOriginPolicy.isHostAllowed(
                "farmafacil-app.vercel.app",
                stagingHost,
                strict = true,
            ),
        )
        assertFalse(
            PrintOriginPolicy.isHostAllowed(
                "app.farmafacil.solutions",
                stagingHost,
                strict = true,
            ),
        )
        assertTrue(PrintOriginPolicy.isProductionHost("app.farmafacil.solutions"))
    }

    @Test
    fun rejectsUnauthorizedHosts() {
        assertFalse(PrintOriginPolicy.isHostAllowed(null, allowed))
        assertFalse(PrintOriginPolicy.isHostAllowed("", allowed))
        assertFalse(PrintOriginPolicy.isHostAllowed("evil.example.com", allowed))
        assertFalse(PrintOriginPolicy.isHostAllowed("farmafacil.solutions", allowed))
        assertFalse(PrintOriginPolicy.isHostAllowed("app.farmafacil.solutions.evil.com", allowed))
    }

    @Test
    fun hostFromUrlExtractsHttpsHost() {
        assertEquals(
            "app.farmafacil.solutions",
            PrintOriginPolicy.hostFromUrl("https://app.farmafacil.solutions/k/carrito"),
        )
        assertNull(PrintOriginPolicy.hostFromUrl(null))
        assertNull(PrintOriginPolicy.hostFromUrl("not-a-url"))
    }

    @Test
    fun startsUnvalidated_forbiddenUntilFinished() {
        val session = PrintOriginSession(allowed)
        assertFalse("origen todavía no validado", session.isValidatedAllowed())
        assertNull(session.currentValidatedHost())
    }

    @Test
    fun validateAuthorizedUrl_allowsPrintOrigin() {
        val session = PrintOriginSession(allowed)
        assertTrue(session.validateMainFrameUrl("https://app.farmafacil.solutions/k"))
        assertTrue(session.isValidatedAllowed())
        assertEquals("app.farmafacil.solutions", session.currentValidatedHost())
    }

    @Test
    fun validateUnauthorizedUrl_staysDenied() {
        val session = PrintOriginSession(allowed)
        assertFalse(session.validateMainFrameUrl("https://evil.example.com/k"))
        assertFalse(session.isValidatedAllowed())
        assertNull(session.currentValidatedHost())
    }

    @Test
    fun navigationInvalidatesPreviousAuthorizedOrigin() {
        val session = PrintOriginSession(allowed)
        assertTrue(session.validateMainFrameUrl("https://app.farmafacil.solutions/k"))
        assertTrue(session.isValidatedAllowed())

        // Nueva navegación: no reutilizar origen anterior.
        session.invalidate()
        assertFalse(session.isValidatedAllowed())
        assertNull(session.currentValidatedHost())

        // Página fallida / host no permitido tras navegar.
        assertFalse(session.validateMainFrameUrl("https://phishing.vercel.app.evil.com/"))
        assertFalse(session.isValidatedAllowed())

        // Solo se reautoriza tras carga válida del frame principal.
        assertTrue(session.validateMainFrameUrl("https://app.farmafacil.solutions/k/catalogo"))
        assertTrue(session.isValidatedAllowed())
    }

    @Test
    fun failedNavigationClearsAuthorizedOrigin() {
        val session = PrintOriginSession(allowed)
        session.validateMainFrameUrl("https://app.farmafacil.solutions/k")
        session.invalidate()
        assertFalse(session.isValidatedAllowed())
    }
}
