package com.icod.printer.utils;

import android.content.Context;
import android.content.res.TypedArray;

/**
 * Created by crf on 2020/5/30.
 */
public class DataUtils {
    private static Context context;
    private static DataUtils dataUtils;

    public static DataUtils getInstance(Context context) {
        if (null == dataUtils) {
            synchronized (DataUtils.class) {
                if (null == dataUtils) {
                    dataUtils = new DataUtils(context.getApplicationContext());
                }
            }
        }
        return dataUtils;
    }

    private DataUtils(Context context) {
        this.context = context;
    }

    /**
     * 得到string.xml中字符串数组
     *
     * @param resId
     * @return
     */
    public String[] getStringArr(int resId) {
        return context.getResources().getStringArray(resId);
    }

    /**
     * 得到string.xml中整形数组
     *
     * @param resId
     * @return
     */
    public int[] getIntegerArr(int resId) {
        TypedArray typedArray = context.getResources().obtainTypedArray(resId);

        int indexCount = typedArray.length();

        int arr[] = new int[indexCount];
        for (int i = 0; i < indexCount; i++) {
            arr[i] = typedArray.getInteger(i, 9600);
        }
        return arr;
    }

    /**
     * 将字节数组转换为字符串
     *
     * @param src
     * @return
     */
    public static String bytesToHexString(byte[] src) {
        StringBuilder stringBuilder = new StringBuilder("");
        if (src != null && src.length > 0) {
            for (int i = 0; i < src.length; ++i) {
                int v = src[i] & 255;
                String hv = Integer.toHexString(v);
                if (hv.length() < 2) {
                    stringBuilder.append(0);
                }

                stringBuilder.append(hv);
                stringBuilder.append(" ");
            }

            return stringBuilder.toString();
        } else {
            return null;
        }
    }


}
