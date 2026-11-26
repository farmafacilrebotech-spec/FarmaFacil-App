package solutions.farmafacil.kiosk.usb

import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager

/**
 * Enumeración de solo lectura de dispositivos USB.
 * Etapa 1: no abre conexiones, no reclama interfaces, no escribe endpoints.
 */
object UsbDeviceInspector {

    data class Report(
        val deviceCount: Int,
        val text: String,
        val firstDevice: UsbDevice?
    )

    fun inspect(usbManager: UsbManager): Report {
        val devices = usbManager.deviceList.values.toList()
        if (devices.isEmpty()) {
            return Report(0, "No se detectaron dispositivos USB.\n", null)
        }

        val sb = StringBuilder()
        devices.forEachIndexed { index, device ->
            sb.appendLine("=== Dispositivo ${index + 1} ===")
            sb.appendLine("Nombre:           ${device.deviceName}")
            sb.appendLine("Product Name:     ${device.productName ?: "(n/d)"}")
            sb.appendLine("Manufacturer:     ${device.manufacturerName ?: "(n/d)"}")
            sb.appendLine("VID:              0x${device.vendorId.toString(16).padStart(4, '0').uppercase()} (${device.vendorId})")
            sb.appendLine("PID:              0x${device.productId.toString(16).padStart(4, '0').uppercase()} (${device.productId})")
            sb.appendLine("Class:            ${device.deviceClass} (${deviceClassName(device.deviceClass)})")
            sb.appendLine("Subclass:         ${device.deviceSubclass}")
            sb.appendLine("Protocol:         ${device.deviceProtocol}")
            sb.appendLine("Version:          ${device.version}")
            sb.appendLine("Serial:           ${safeSerial(usbManager, device)}")
            sb.appendLine("Has permission:   ${usbManager.hasPermission(device)}")
            sb.appendLine("Interfaces:       ${device.interfaceCount}")

            for (i in 0 until device.interfaceCount) {
                val intf = device.getInterface(i)
                sb.appendLine("  -- Interface $i --")
                sb.appendLine("     id=$i class=${intf.interfaceClass} (${interfaceClassName(intf.interfaceClass)})")
                sb.appendLine("     subclass=${intf.interfaceSubclass} protocol=${intf.interfaceProtocol}")
                sb.appendLine("     endpoints=${intf.endpointCount}")
                for (e in 0 until intf.endpointCount) {
                    val ep = intf.getEndpoint(e)
                    val dir = when (ep.direction) {
                        UsbConstants.USB_DIR_IN -> "IN"
                        UsbConstants.USB_DIR_OUT -> "OUT"
                        else -> "DIR(${ep.direction})"
                    }
                    val type = when (ep.type) {
                        UsbConstants.USB_ENDPOINT_XFER_BULK -> "BULK"
                        UsbConstants.USB_ENDPOINT_XFER_INT -> "INTERRUPT"
                        UsbConstants.USB_ENDPOINT_XFER_ISOC -> "ISOCHRONOUS"
                        UsbConstants.USB_ENDPOINT_XFER_CONTROL -> "CONTROL"
                        else -> "TYPE(${ep.type})"
                    }
                    sb.appendLine(
                        "       EP$e addr=0x${ep.address.toString(16)} $dir $type " +
                            "maxPacket=${ep.maxPacketSize} interval=${ep.interval}"
                    )
                }
            }
            sb.appendLine()
        }

        return Report(devices.size, sb.toString(), devices.firstOrNull())
    }

    private fun safeSerial(usbManager: UsbManager, device: UsbDevice): String {
        return try {
            if (usbManager.hasPermission(device)) {
                device.serialNumber ?: "(sin serial)"
            } else {
                "(requiere permiso USB)"
            }
        } catch (_: SecurityException) {
            "(requiere permiso USB)"
        }
    }

    private fun deviceClassName(cls: Int): String = when (cls) {
        UsbConstants.USB_CLASS_PER_INTERFACE -> "PER_INTERFACE"
        UsbConstants.USB_CLASS_AUDIO -> "AUDIO"
        UsbConstants.USB_CLASS_COMM -> "COMM"
        UsbConstants.USB_CLASS_HID -> "HID"
        UsbConstants.USB_CLASS_PRINTER -> "PRINTER"
        UsbConstants.USB_CLASS_MASS_STORAGE -> "MASS_STORAGE"
        UsbConstants.USB_CLASS_HUB -> "HUB"
        UsbConstants.USB_CLASS_VENDOR_SPEC -> "VENDOR_SPEC"
        else -> "OTHER"
    }

    private fun interfaceClassName(cls: Int): String = deviceClassName(cls)
}
