package solutions.farmafacil.kiosk.diagnostics

import android.app.ActivityManager
import android.content.Context
import android.os.SystemClock
import android.util.Log
import android.webkit.WebView
import java.util.ArrayDeque
import java.util.concurrent.atomic.AtomicInteger

/**
 * Instrumentación de rendimiento solo para APK staging.
 *
 * - Logcat tag [TAG] (opcional; el panel in-app no depende de ADB).
 * - Buffer en memoria para el panel de diagnóstico y exportación a archivo.
 * - No registra PII, credenciales ni tokens (URL solo host+path).
 */
object StagingPerfProbe {
    const val TAG = "FfKioskPerf"
    private const val MAX_EVENTS = 400

    data class PerfEvent(
        val seq: Int,
        val elapsedMs: Long,
        val name: String,
        val detail: String,
    )

    private val lock = Any()
    private val events = ArrayDeque<PerfEvent>(MAX_EVENTS)
    private val seq = AtomicInteger(0)

    private var appStartElapsed = 0L
    private var webViewCreatedElapsed = 0L
    private var firstPageStartElapsed = 0L
    private var firstPageFinishElapsed = 0L
    private var lastNavStartElapsed = 0L
    private var networkErrorCount = 0
    private var pageFinishCount = 0
    private var printOkCount = 0
    private var printFailCount = 0

    fun markAppCreate() {
        appStartElapsed = SystemClock.elapsedRealtime()
        clearLocked(keepAppStart = true)
        record("app_create", "t=0ms")
    }

    fun markWebViewReady() {
        webViewCreatedElapsed = SystemClock.elapsedRealtime()
        record("webview_ready", "dt=${delta(appStartElapsed)}ms")
    }

    fun markPageStarted(url: String?) {
        val now = SystemClock.elapsedRealtime()
        if (firstPageStartElapsed == 0L) firstPageStartElapsed = now
        lastNavStartElapsed = now
        record("page_start", "dt=${delta(appStartElapsed)}ms url=${safeUrl(url)}")
    }

    fun markPageFinished(url: String?, context: Context? = null) {
        val now = SystemClock.elapsedRealtime()
        pageFinishCount += 1
        if (firstPageFinishElapsed == 0L) {
            firstPageFinishElapsed = now
            record(
                "first_contentful",
                "dt=${delta(appStartElapsed)}ms nav=${delta(firstPageStartElapsed)}ms url=${safeUrl(url)}",
            )
        } else {
            record(
                "page_finish",
                "dt=${delta(appStartElapsed)}ms nav=${delta(lastNavStartElapsed)}ms url=${safeUrl(url)}",
            )
        }
        context?.let { logMemory(it) }
    }

    fun markNetworkError(url: String?, description: String?) {
        networkErrorCount += 1
        record(
            "network_error",
            "dt=${delta(appStartElapsed)}ms url=${safeUrl(url)} desc=${sanitizeText(description, 80)}",
        )
    }

    fun markPrintStart() {
        record("print_start", "dt=${delta(appStartElapsed)}ms")
    }

    fun markPrintEnd(ok: Boolean, code: String? = null) {
        if (ok) printOkCount += 1 else printFailCount += 1
        record(
            "print_end",
            "ok=$ok code=${sanitizeText(code, 40)} dt=${delta(appStartElapsed)}ms",
        )
    }

    /** Captura líneas de consola WebView que empiezan por [FfKioskPerf]. */
    fun markConsoleLine(message: String?) {
        val raw = message?.trim().orEmpty()
        if (!raw.contains("[FfKioskPerf]")) return
        val payload = raw.substringAfter("[FfKioskPerf]").trim()
        val name = payload.substringAfter("event=", "js").substringBefore(' ').ifBlank { "js" }
        record(sanitizeText(name, 40), sanitizeText(payload, 160))
    }

    fun injectNavObserver(webView: WebView) {
        val js =
            """
            (function(){
              if (window.__ffPerfProbe) return;
              window.__ffPerfProbe = true;
              var t0 = Date.now();
              function log(ev, extra) {
                try {
                  console.log('[FfKioskPerf] event=' + ev + ' t=' + (Date.now()-t0) + 'ms ' + (extra||''));
                } catch (e) {}
              }
              log('js_probe_ready');
              document.addEventListener('click', function(e) {
                var tag = (e.target && (e.target.tagName)) || 'unknown';
                log('tap', 'target=' + String(tag).slice(0,24));
              }, true);
              window.addEventListener('error', function(e) {
                log('js_error', String(e.message||'').slice(0,80));
              });
            })();
            """.trimIndent()
        webView.evaluateJavascript(js, null)
    }

    fun snapshotEvents(): List<PerfEvent> = synchronized(lock) { events.toList() }

    fun summaryLines(context: Context?): List<String> {
        val mem = context?.let { memorySnapshot(it) }
        return listOf(
            "package=staging_perf_buffer",
            "uptimeMs=${delta(appStartElapsed)}",
            "webviewReadyMs=${if (webViewCreatedElapsed > 0) webViewCreatedElapsed - appStartElapsed else -1}",
            "firstContentfulMs=${if (firstPageFinishElapsed > 0) firstPageFinishElapsed - appStartElapsed else -1}",
            "pageFinishes=$pageFinishCount",
            "networkErrors=$networkErrorCount",
            "printOk=$printOkCount",
            "printFail=$printFailCount",
            "events=${synchronized(lock) { events.size }}",
            "memory=$mem",
        )
    }

    fun clear() {
        synchronized(lock) {
            clearLocked(keepAppStart = false)
        }
        markAppCreate()
    }

    fun buildExportText(
        context: Context?,
        appVersion: String,
        applicationId: String,
    ): String {
        val header = buildString {
            appendLine("FarmaFacil TEST — export rendimiento")
            appendLine("generatedAtUtc=${java.time.Instant.now()}")
            appendLine("applicationId=$applicationId")
            appendLine("version=$appVersion")
            appendLine("note=sin_PII_sin_tokens_sin_credenciales")
            appendLine("--- summary ---")
            summaryLines(context).forEach { appendLine(it) }
            appendLine("--- events ---")
        }
        val body = snapshotEvents().joinToString("\n") { e ->
            "${e.seq}\t${e.elapsedMs}ms\t${e.name}\t${e.detail}"
        }
        return header + body + "\n"
    }

    private fun clearLocked(keepAppStart: Boolean) {
        events.clear()
        seq.set(0)
        if (!keepAppStart) {
            appStartElapsed = 0L
        }
        webViewCreatedElapsed = 0L
        firstPageStartElapsed = 0L
        firstPageFinishElapsed = 0L
        lastNavStartElapsed = 0L
        networkErrorCount = 0
        pageFinishCount = 0
        printOkCount = 0
        printFailCount = 0
    }

    private fun record(name: String, detail: String) {
        val elapsed = if (appStartElapsed > 0L) {
            SystemClock.elapsedRealtime() - appStartElapsed
        } else {
            0L
        }
        val event = PerfEvent(
            seq = seq.incrementAndGet(),
            elapsedMs = elapsed,
            name = sanitizeText(name, 48),
            detail = sanitizeText(detail, 200),
        )
        synchronized(lock) {
            if (events.size >= MAX_EVENTS) {
                events.removeFirst()
            }
            events.addLast(event)
        }
        Log.i(TAG, "event=${event.name} ${event.detail}")
    }

    private fun logMemory(context: Context) {
        record("memory", memorySnapshot(context))
    }

    private fun memorySnapshot(context: Context): String {
        val am = context.getSystemService(ActivityManager::class.java) ?: return "n/a"
        val info = ActivityManager.MemoryInfo()
        am.getMemoryInfo(info)
        return "availMb=${info.availMem / (1024 * 1024)} low=${info.lowMemory} " +
            "thresholdMb=${info.threshold / (1024 * 1024)}"
    }

    private fun delta(from: Long): Long {
        if (from <= 0L) return -1L
        return SystemClock.elapsedRealtime() - from
    }

    private fun safeUrl(url: String?): String {
        if (url.isNullOrBlank()) return "(null)"
        return try {
            val uri = java.net.URI(url)
            buildString {
                append(uri.host ?: "?")
                append(uri.path ?: "/")
            }.take(120)
        } catch (_: Throwable) {
            "(unparseable)"
        }
    }

    private fun sanitizeText(value: String?, max: Int): String {
        if (value.isNullOrBlank()) return ""
        var out = value
            .replace(Regex("""(?i)(authorization|bearer|token|password|credential|cookie)=[^\s&]+"""), "$1=REDACTED")
            .replace(Regex("""[0-9a-fA-F]{32,}"""), "[hex]")
            .replace('\n', ' ')
            .replace('\t', ' ')
        if (out.length > max) out = out.take(max)
        return out
    }
}
