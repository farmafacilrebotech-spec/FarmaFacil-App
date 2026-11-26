package solutions.farmafacil.kiosk.locktask

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.util.Log

/**
 * Controlador de Lock Task Mode — **preparación solamente**.
 *
 * Garantías de esta etapa:
 * - No llama a [Activity.startLockTask] automáticamente.
 * - No modifica políticas del sistema.
 * - No aprovisiona Device Owner.
 * - [tryStartLockTaskIfAuthorized] es no-op salvo que el dispositivo ya sea
 *   Device Owner **y** el llamador pase [explicitOptIn]=true (pruebas futuras).
 *
 * Ver: `android-kiosk/docs/LOCK_TASK_SAFE_TEST.md`
 */
class KioskLockTaskController(
    private val context: Context
) {
    private val dpm: DevicePolicyManager? =
        context.getSystemService(DevicePolicyManager::class.java)

    private val adminComponent: ComponentName =
        ComponentName(context, KioskDeviceAdminReceiver::class.java)

    fun isDeviceOwner(): Boolean =
        dpm?.isDeviceOwnerApp(context.packageName) == true

    fun isProfileOwner(): Boolean =
        dpm?.isProfileOwnerApp(context.packageName) == true

    fun isAdminActive(): Boolean =
        dpm?.isAdminActive(adminComponent) == true

    fun describeProvisioningState(): String = buildString {
        append("package=").append(context.packageName)
        append(" deviceOwner=").append(isDeviceOwner())
        append(" profileOwner=").append(isProfileOwner())
        append(" adminActive=").append(isAdminActive())
        append(" sdk=").append(Build.VERSION.SDK_INT)
    }

    /**
     * Opt-in explícito para pruebas futuras. Por defecto no hace nada.
     * Requiere Device Owner ya aprovisionado fuera de esta app.
     */
    fun tryStartLockTaskIfAuthorized(activity: Activity, explicitOptIn: Boolean = false): Boolean {
        if (!explicitOptIn) {
            Log.d(TAG, "Lock Task skipped (explicitOptIn=false). ${describeProvisioningState()}")
            return false
        }
        if (!isDeviceOwner()) {
            Log.w(TAG, "Lock Task refused: not Device Owner. ${describeProvisioningState()}")
            return false
        }
        val manager = dpm ?: return false
        return try {
            manager.setLockTaskPackages(adminComponent, arrayOf(context.packageName))
            activity.startLockTask()
            Log.i(TAG, "Lock Task started after explicit opt-in.")
            true
        } catch (e: SecurityException) {
            Log.e(TAG, "Lock Task failed: ${e.message}")
            false
        }
    }

    companion object {
        private const val TAG = "FfKioskLockTask"
        /** Flag de producto: nunca auto-activar en MainActivity en esta etapa. */
        const val AUTO_START_ENABLED = false
    }
}
