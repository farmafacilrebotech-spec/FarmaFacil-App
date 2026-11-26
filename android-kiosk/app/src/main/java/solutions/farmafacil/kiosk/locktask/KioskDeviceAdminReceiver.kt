package solutions.farmafacil.kiosk.locktask

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Receptor de administración de dispositivo (preparación Lock Task / Device Owner).
 *
 * **No se activa Device Owner en esta etapa.**
 * El componente existe para que, en una prueba controlada posterior, se pueda
 * aprovisionar con `dpm set-device-owner` o provisioning QR **solo con autorización**.
 *
 * No aplica políticas al instalar la APK.
 */
class KioskDeviceAdminReceiver : DeviceAdminReceiver() {

    override fun onEnabled(context: Context, intent: Intent) {
        Log.i(TAG, "Device admin enabled (no Lock Task auto-start).")
    }

    override fun onDisabled(context: Context, intent: Intent) {
        Log.i(TAG, "Device admin disabled.")
    }

    override fun onLockTaskModeEntering(context: Context, intent: Intent, pkg: String) {
        Log.i(TAG, "Lock Task entering for $pkg (observer only).")
    }

    override fun onLockTaskModeExiting(context: Context, intent: Intent) {
        Log.i(TAG, "Lock Task exiting (observer only).")
    }

    companion object {
        private const val TAG = "FfKioskDeviceAdmin"
    }
}
