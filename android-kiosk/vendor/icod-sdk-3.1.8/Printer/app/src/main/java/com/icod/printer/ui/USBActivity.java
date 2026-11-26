package com.icod.printer.ui;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.support.annotation.RequiresApi;
import android.support.v7.widget.DividerItemDecoration;
import android.support.v7.widget.LinearLayoutManager;
import android.support.v7.widget.RecyclerView;
import android.util.Log;
import android.view.View;

import com.icod.printer.R;
import com.icod.printer.adapter.UsbDeviceAdapter;
import com.icod.printer.base.BaseActivity;
import com.icod.printer.utils.DataUtils;
import com.icod.printer.utils.PrintImageUtils;
import com.icod.printer.utils.PrinterCommodityUtils;
import com.szsicod.print.escpos.PrinterAPI;
import com.szsicod.print.io.USBAPI;
import com.szsicod.print.utils.BitmapUtils;

import java.io.UnsupportedEncodingException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

/**
 * @User Administrator
 * @Date 2021-03-10 17:17
 */
public class USBActivity extends BaseActivity {
    private static final String TAG = "USBActivity";

    private RecyclerView rlDevice;

    private UsbManager mUsbManager;
    private List<UsbDevice> deviceList = new ArrayList<>();
    private UsbDeviceAdapter usbDeviceAdapter;

    private UsbBroadCastReceiver mUsbBroadCastReceiver;
    private List<PrinterAPI> printerArray = new ArrayList<>();

    @Override
    protected int getLayoutId() {
        return R.layout.usb_main;
    }

    @Override
    protected void initView() {
        rlDevice = findViewById(R.id.rcv_usb);

        findViewById(R.id.btn_Search).setOnClickListener(v -> {
            int printWidth = (58 - 10) * 8;
            Bitmap bitmap = BitmapFactory.decodeResource(getResources(), R.mipmap.icod_2);
            bitmap = BitmapUtils.reSizeByWidth(bitmap, printWidth);
            byte[] bmpBytes = PrintImageUtils.parseBmpToByte(bitmap);

            new Thread() {
                @Override
                public void run() {
                    super.run();
                    for (PrinterAPI mPrinter : printerArray) {
                        try {
//                            mPrinter.printString("Hello World!!\n");
//                            mPrinter.printString("Hello World!!\n");
//                            mPrinter.printString("Hello World!!\n");
//                            mPrinter.printString("Hello World!!\n");
//                            mPrinter.printString("Hello World!!\n");
//                            mPrinter.printString("Hello World!!\n");
//                            mPrinter.printString("Hello World!!\n");
////                            mPrinter.sendOrder(bmpBytes);
//                            mPrinter.printFeed();
//                            mPrinter.printFeed();
//                            mPrinter.cutPaper(0x42, 0x00);

                            byte[] a = createCmd(new byte[]{0x1b, 0x01, 0x23}, (byte) 0x32);
                            Log.d(TAG, "run: " + DataUtils.bytesToHexString(a));
                            mPrinter.sendOrder(a);
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    }
                }
            }.start();
        });

        LinearLayoutManager linearLayoutManager = new LinearLayoutManager(this);
        rlDevice.setLayoutManager(linearLayoutManager);
        rlDevice.addItemDecoration(new DividerItemDecoration(this, DividerItemDecoration.VERTICAL));
        usbDeviceAdapter = new UsbDeviceAdapter(deviceList, position -> {
            USBAPI io = new USBAPI(USBActivity.this, deviceList.get(position));
            PrinterAPI mPrinter = PrinterAPI.getInstance();
            if (mPrinter.connect(io) == PrinterAPI.SUCCESS) {
                try {
                    printerArray.add(mPrinter);

                    onToast("OK");
                } catch (Exception e) {
                    e.printStackTrace();
                }

            }
        });
        rlDevice.setAdapter(usbDeviceAdapter);
    }

    @Override
    protected void initData() {
        //注册监听
        if (null == mUsbBroadCastReceiver) {
            IntentFilter intentFilter = new IntentFilter();
            intentFilter.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);
            intentFilter.addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED);
            mUsbBroadCastReceiver = new UsbBroadCastReceiver();
            registerReceiver(mUsbBroadCastReceiver, intentFilter);
        }

        mUsbManager = (UsbManager) getSystemService(Context.USB_SERVICE);
        HashMap<String, UsbDevice> usbDeviceList = mUsbManager.getDeviceList();
        deviceList.addAll(usbDeviceList.values());
        usbDeviceAdapter.notifyDataSetChanged();

    }

    //usb 监听 由于权限问题而且sdk内部有超时时间 ,适用情况应该是系统默认usb权限开放或者root 板则使用UsbNativeApi
    private class UsbBroadCastReceiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            UsbDevice usbDevice = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
            switch (intent.getAction()) {
                case UsbManager.ACTION_USB_DEVICE_ATTACHED:
                    //插USB
                    onToast("插USB: vid=" + usbDevice.getVendorId() + "  pid=" + usbDevice.getProductId());
                    deviceList.add(usbDevice);
                    usbDeviceAdapter.notifyDataSetChanged();
                    break;
                case UsbManager.ACTION_USB_DEVICE_DETACHED:
                    //拔USB
                    onToast("拔USB: vid=" + usbDevice.getVendorId() + "  pid=" + usbDevice.getProductId());
                    for (int i = 0; i < deviceList.size(); i++) {
                        UsbDevice device = deviceList.get(i);
                        if (device.getDeviceName().equals(usbDevice.getDeviceName())) {
                            deviceList.remove(i);
                            usbDeviceAdapter.notifyDataSetChanged();
                        }
                    }
                    break;
            }
        }
    }

    private byte[] createCmd(byte[] cmd, byte address) {
        int offset = 0;
        byte[] retCmd = new byte[cmd.length + 7];
        retCmd[offset++] = 0x21;
        retCmd[offset++] = address;
        retCmd[offset++] = (byte) 0xFF;
        retCmd[offset++] = 0x20;
        retCmd[offset++] = (byte) cmd.length;
        for (byte b : cmd)
            retCmd[offset++] = b;

        retCmd[offset++] = getCheckSum(retCmd);
        retCmd[offset++] = 0x16;


        return retCmd;
    }

    private byte getCheckSum(byte[] retCmd) {
        int iRst = 0;
        for (int i = 0; i < retCmd.length - 2; i++) {
            iRst += (retCmd[i] & 0xFF);
        }

        return (byte) (iRst & 0xFF);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        unregisterReceiver(mUsbBroadCastReceiver);
    }
}

