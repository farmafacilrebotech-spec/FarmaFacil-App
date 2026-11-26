package solutions.farmafacil.kiosk.diagnostics

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import solutions.farmafacil.kiosk.BuildConfig
import solutions.farmafacil.kiosk.R
import solutions.farmafacil.kiosk.databinding.ActivityStagingPerfBinding

/**
 * Panel de métricas de rendimiento exclusivo de FarmaFácil TEST.
 * No requiere ADB/logcat. Exporta a archivo para copiar por pendrive USB.
 */
class StagingPerfDiagnosticsActivity : AppCompatActivity() {

    private lateinit var binding: ActivityStagingPerfBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!BuildConfig.IS_STAGING || !BuildConfig.ENABLE_PERF_PROBE) {
            Toast.makeText(this, R.string.diagnostics_release_blocked, Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        binding = ActivityStagingPerfBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.refreshButton.setOnClickListener { render() }
        binding.clearButton.setOnClickListener {
            StagingPerfProbe.clear()
            render()
            Toast.makeText(this, R.string.staging_perf_cleared, Toast.LENGTH_SHORT).show()
        }
        binding.exportButton.setOnClickListener { exportMetrics() }
        binding.backButton.setOnClickListener { finish() }

        render()
    }

    override fun onResume() {
        super.onResume()
        render()
    }

    private fun render() {
        binding.perfSummary.text = StagingPerfProbe.summaryLines(this).joinToString("\n")
        val events = StagingPerfProbe.snapshotEvents()
        binding.perfEvents.text = if (events.isEmpty()) {
            getString(R.string.staging_perf_empty)
        } else {
            events
                .asReversed()
                .take(200)
                .joinToString("\n") { e ->
                    "#${e.seq}  ${e.elapsedMs}ms  ${e.name}  ${e.detail}"
                }
        }
    }

    private fun exportMetrics() {
        try {
            val result = StagingPerfExport.exportNow(this)
            binding.exportStatus.text = getString(
                R.string.staging_perf_export_ok,
                result.bytes,
                result.displayPath,
            )
            val share = StagingPerfExport.shareIntent(this, result)
            if (share != null) {
                startActivity(
                    Intent.createChooser(
                        share,
                        getString(R.string.staging_perf_share_title),
                    ),
                )
            } else {
                Toast.makeText(this, R.string.staging_perf_export_saved, Toast.LENGTH_LONG).show()
            }
        } catch (t: Throwable) {
            binding.exportStatus.text = getString(R.string.staging_perf_export_fail, t.message ?: "")
            Toast.makeText(this, R.string.staging_perf_export_fail_short, Toast.LENGTH_LONG).show()
        }
    }
}
