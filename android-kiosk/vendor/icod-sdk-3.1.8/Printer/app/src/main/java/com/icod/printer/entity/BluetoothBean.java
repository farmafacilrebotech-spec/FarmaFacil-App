package com.icod.printer.entity;

import android.bluetooth.BluetoothDevice;

/**
 * Create by 梦魇
 * Date: 2020/5/18
 */
public class BluetoothBean {
    private BluetoothDevice bluetoothDevice;
    private Boolean pair;

    public BluetoothDevice getBluetoothDevice() {
        return bluetoothDevice;
    }

    public void setBluetoothDevice(BluetoothDevice bluetoothDevice) {
        this.bluetoothDevice = bluetoothDevice;
    }

    public Boolean getPair() {
        return pair;
    }

    public void setPair(Boolean pair) {
        this.pair = pair;
    }

    public BluetoothBean(BluetoothDevice bluetoothDevice) {
        this.bluetoothDevice = bluetoothDevice;
        this.pair = false;
    }

    public BluetoothBean(BluetoothDevice bluetoothDevice, Boolean pair) {
        this.bluetoothDevice = bluetoothDevice;
        this.pair = pair;
    }
}
