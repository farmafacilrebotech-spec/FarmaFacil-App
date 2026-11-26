package solutions.farmafacil.kiosk.diagnostics

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.FileProvider
import solutions.farmafacil.kiosk.BuildConfig
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Exporta métricas de rendimiento de FarmaFácil TEST a archivo de texto.
 * Destino principal: carpeta Documents de la app + MediaStore Downloads (visible
 * en el explorador / pendrive). Sin PII ni tokens.
 */
object StagingPerfExport {
    data class Result(
        val displayPath: String,
        val shareUri: Uri?,
        val bytes: Int,
    )

    fun exportNow(context: Context): Result {
        val stamp = SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())
        val fileName = "farmafacil-test-perf-$stamp.txt"
        val body = StagingPerfProbe.buildExportText(
            context = context,
            appVersion = BuildConfig.VERSION_NAME,
            applicationId = BuildConfig.APPLICATION_ID,
        )
        val bytes = body.toByteArray(Charsets.UTF_8)

        val appDir = context.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS)
            ?: context.filesDir
        if (!appDir.exists()) appDir.mkdirs()
        val localFile = File(appDir, fileName)
        localFile.writeBytes(bytes)

        val downloadsUri = writeToPublicDownloads(context, fileName, bytes)
        val shareUri = try {
            FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                localFile,
            )
        } catch (_: Throwable) {
            downloadsUri
        }

        val display = buildString {
            append(localFile.absolutePath)
            if (downloadsUri != null) {
                append("\nDownloads/")
                append(fileName)
            }
        }

        return Result(
            displayPath = display,
            shareUri = shareUri ?: downloadsUri,
            bytes = bytes.size,
        )
    }

    fun shareIntent(@Suppress("UNUSED_PARAMETER") context: Context, result: Result): Intent? {
        val uri = result.shareUri ?: return null
        return Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, "FarmaFacil TEST perf export")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }

    private fun writeToPublicDownloads(
        context: Context,
        fileName: String,
        bytes: ByteArray,
    ): Uri? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return null
        }
        return try {
            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                put(MediaStore.MediaColumns.MIME_TYPE, "text/plain")
                put(
                    MediaStore.MediaColumns.RELATIVE_PATH,
                    Environment.DIRECTORY_DOWNLOADS + "/FarmaFacilTEST",
                )
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
            val resolver = context.contentResolver
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: return null
            resolver.openOutputStream(uri)?.use { it.write(bytes) }
            values.clear()
            values.put(MediaStore.MediaColumns.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            uri
        } catch (_: Throwable) {
            null
        }
    }
}
