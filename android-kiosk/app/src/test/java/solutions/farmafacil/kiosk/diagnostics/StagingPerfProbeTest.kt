package solutions.farmafacil.kiosk.diagnostics

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StagingPerfProbeTest {
    @Test
    fun exportText_includesSanitizedHeader() {
        StagingPerfProbe.markAppCreate()
        StagingPerfProbe.markConsoleLine(
            "[FfKioskPerf] event=js_error token=abc123def456ghi789jkl012mno345pq",
        )
        val text = StagingPerfProbe.buildExportText(
            context = null,
            appVersion = "test",
            applicationId = "solutions.farmafacil.kiosk.staging.debug",
        )
        assertTrue(text.contains("FarmaFacil TEST"))
        assertTrue(text.contains("sin_PII_sin_tokens_sin_credenciales"))
        assertFalse(text.contains("abc123def456ghi789jkl012mno345pq"))
    }

    @Test
    fun consoleCapture_ignoresUnrelatedLogs() {
        StagingPerfProbe.markAppCreate()
        val before = StagingPerfProbe.snapshotEvents().size
        StagingPerfProbe.markConsoleLine("random console noise")
        val after = StagingPerfProbe.snapshotEvents().size
        assertTrue(after == before)
    }

    @Test
    fun safeUrl_stripsQueryInPageEvents() {
        StagingPerfProbe.markAppCreate()
        StagingPerfProbe.markPageStarted(
            "https://farmafacil-staging.vercel.app/k/catalogo?session=secret-token-value",
        )
        val last = StagingPerfProbe.snapshotEvents().last()
        assertFalse(last.detail.contains("session="))
        assertFalse(last.detail.contains("secret-token-value"))
        assertTrue(last.detail.contains("farmafacil-staging.vercel.app"))
    }
}
