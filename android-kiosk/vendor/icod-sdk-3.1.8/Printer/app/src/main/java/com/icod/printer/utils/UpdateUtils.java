package com.icod.printer.utils;


import android.content.Context;
import android.os.SystemClock;
import android.text.TextUtils;
import android.util.Log;

import com.szsicod.print.escpos.PrinterAPI;
import com.szsicod.print.io.USBAPI;

import java.io.InputStream;

public class UpdateUtils {
    private String TAG = "UpdateUtils";
    private volatile static UpdateUtils mUpdateUtils;

    private static PrinterAPI mPrinter;
    private static Context mContext;

    private UpdateUtils(Context mContext) {
        mPrinter = new PrinterAPI();
        this.mContext = mContext;
    }

    public static UpdateUtils getInstance(Context mContext) {
        if (null == mUpdateUtils) {
            synchronized (UpdateUtils.class) {
                if (null == mUpdateUtils) {
                    mUpdateUtils = new UpdateUtils(mContext);

                }
            }
        }
        return mUpdateUtils;
    }

    /**
     * @param in             打印机固件文件
     * @param updateListener 监听升级前判断过程
     */
    public void L60CUpdateFirmware(InputStream in, UpdateListener updateListener) {
        L60CUpdateFirmware(in, "", updateListener, null);
    }

    /**
     * @param in              打印机固件文件
     * @param firmwareVersion 打印机固件文件版本号
     * @param updateListener  监听升级前判断过程
     */
    public void L60CUpdateFirmware(InputStream in, String firmwareVersion, UpdateListener updateListener) {
        L60CUpdateFirmware(in, firmwareVersion, updateListener, null);
    }

    /**
     * @param in                打印机固件文件
     * @param updateListener    监听升级前判断过程
     * @param mFirmwareListener 监听升级过程
     */
    public void L60CUpdateFirmware(InputStream in, UpdateListener updateListener, PrinterAPI.FirmwareListener mFirmwareListener) {
        L60CUpdateFirmware(in, "", updateListener, mFirmwareListener);
    }

    /**
     * @param in                打印机固件文件
     * @param printerVersion    打印机固件文件版本号
     * @param updateListener    监听升级前判断过程
     * @param mFirmwareListener 监听升级过程
     */
    public void L60CUpdateFirmware(InputStream in, String firmwareVersion, UpdateListener updateListener, PrinterAPI.FirmwareListener mFirmwareListener) {
        new Thread() {
            @Override
            public void run() {
                super.run();

                int ret1 = mPrinter.connect(new USBAPI(mContext));
                if (ret1 == PrinterAPI.SUCCESS) {
                    updateListener.updateChange(1, false, "第一次连接成功");
                    SystemClock.sleep(800);

                    boolean isNext = false;
                    if (!TextUtils.isEmpty(firmwareVersion)) {
                        byte[] versionByte = mPrinter.getPrinterVersion().getBytes();
                        byte[] firmwareVersionByte = firmwareVersion.getBytes();
                        Log.d(TAG, "1: " + versionByte.length);
                        Log.d(TAG, "2: " + firmwareVersionByte.length);
                        if (versionByte.length == firmwareVersionByte.length) {
                            if ((versionByte[0] != firmwareVersionByte[0]) || (versionByte[1] != firmwareVersionByte[1])) {
                                // 非芯瓷头片固件，不支持升级
                                updateListener.updateChange(2, true, "型号和固件不匹配，不支持升级");
                            } else {
                                if (((int) versionByte[3] << 8 | (int) versionByte[4]) >= (((int) firmwareVersionByte[3] << 8 | (int) firmwareVersionByte[4]))) {
                                    updateListener.updateChange(2, true, "当前为最新固件，无须升级");
                                } else {
                                    isNext = true;
                                    updateListener.updateChange(2, false, "进入升级准备");
                                }
                            }
                        } else {
                            updateListener.updateChange(2, true, "获取型号失败，不确认升级");
                        }
                    } else {
                        isNext = true;
                        updateListener.updateChange(2, false, "进入升级准备");
                    }

                    if (isNext) {
                        updateListener.updateChange(3, false, "重启打印机，清空打印机缓存，避免对升级过程产生干扰");
                        mPrinter.clear();
                        mPrinter.sendOrder(new byte[]{0x1b, 0x63, 0x39});
                        SystemClock.sleep(2000);

                        int ret2 = mPrinter.connect(new USBAPI(mContext));
                        if (ret2 == PrinterAPI.SUCCESS) {
                            updateListener.updateChange(4, false, "第二次连接成功");

                            SystemClock.sleep(3000);
                            updateListener.updateChange(5, false, "开始固件升级");
                            if (mFirmwareListener != null)
                                mPrinter.setmFirmwareListener(mFirmwareListener);
                            int ret3 = mPrinter.updateFirmware(in);
                            updateListener.updateChange(5, true, "固件升级完成: " + ret3);
                        } else {
                            updateListener.updateChange(4, true, "第二次连接失败");
                        }
                    }
                } else {
                    updateListener.updateChange(1, true, "第一次连接失败");
                }
            }
        }.start();
    }

    public interface UpdateListener {
        void updateChange(int no, Boolean isEnd, String msg);

    }

}
