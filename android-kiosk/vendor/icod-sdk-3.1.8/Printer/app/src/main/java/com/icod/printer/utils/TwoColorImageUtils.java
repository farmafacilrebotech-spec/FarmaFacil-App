package com.icod.printer.utils;

import android.graphics.Bitmap;
import android.util.Log;

public class TwoColorImageUtils {
    private static String TAG = "TwoColorImageUtils";

    private static  int offsetValue = 220;

    /**
     * @param bitmap
     * @return 将图片转数组
     */
    public static byte[] parseBmpToByte(Bitmap bitmap) {
        int scaleHeight = bitmap.getHeight();
        int bitWidth = (bitmap.getWidth() + 7) / 8 * 8;
        int width = bitmap.getWidth();
        int[] data = new int[width * scaleHeight];
        byte[] dataVec = new byte[bitWidth * scaleHeight / 8 * 2 + 8];

        Log.d(TAG, "width: " + width + "   bitWidth: " + bitWidth + "   scaleHeight: " + scaleHeight);
        Log.d(TAG, "parseBmpToByte: " + (bitWidth * scaleHeight / 8 * 2 + 8));

        dataVec[0] = 29;
        dataVec[1] = 118;
        dataVec[2] = 48;
        dataVec[3] = 0;
        dataVec[4] = (byte) (bitWidth / 8 % 256);
        dataVec[5] = (byte) (bitWidth / 8 / 256);
        dataVec[6] = (byte) (scaleHeight * 2 % 256);
        dataVec[7] = (byte) (scaleHeight * 2 / 256);
        int k = 8;
        bitmap.getPixels(data, 0, width, 0, 0, width, scaleHeight);

        for (int h = 0; h < scaleHeight; h++) {
            for (int w = 0; w < bitWidth; w += 8) {
                int value = 0;
                int colorValue = 0;
                for (int i = 0; i < 8; i++) {
                    int index = h * width + w + i;
                    if (w + i >= width) {
                        value |= 0;
                        colorValue |= 0;
                    } else {
                        value |= blueByte(data[index]) << (7 - i);
                        colorValue |= redByte(data[index]) << (7 - i);
                    }
                }
                dataVec[k] = (byte) value;
                dataVec[k + bitWidth / 8] = (byte) colorValue;
                k++;
            }
            k = k + bitWidth / 8;
        }
        return dataVec;
    }

    public static byte px2Byte(int pixel) {
        byte b;

        int red = (pixel & 0x00ff0000) >> 16; // 取高两位
        int green = (pixel & 0x0000ff00) >> 8; // 取中两位
        int blue = pixel & 0x000000ff; // 取低两位
        int gray = RGB2Gray(red, green, blue);
        if (gray < offsetValue) {
            b = 1;
        } else {
            b = 0;
        }
        return b;
    }

    public static byte redByte(int pixel) {
        byte b;

        int red = (pixel & 0x00ff0000) >> 16; // 取高两位
        if (red < offsetValue) {
            b = 1;
        } else {
            b = 0;
        }
        return b;
    }

    public static byte blueByte(int pixel) {
        byte b;

        int blue = pixel & 0x000000ff; // 取低两位
        if (blue < offsetValue) {
            b = 1;
        } else {
            b = 0;
        }
        return b;
    }

    /**
     * 图片灰度的转化
     */
    private static int RGB2Gray(int r, int g, int b) {
        int gray = (int) (0.29900 * r + 0.58700 * g + 0.11400 * b);  //灰度转化公式
        return gray;
    }


}
