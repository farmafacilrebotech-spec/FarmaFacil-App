package com.icod.printer.utils;

import java.util.ArrayList;
import java.util.List;

/**
 * @User Administrator
 * @Date 2022-02-22 15:59
 */
public class BarCode128Utils {


    /**
     * 获取条码Code128指令
     *
     * @param barStr 条码内容
     * @param code   条码类型 {A,B,C}
     * @return
     */
    public static byte[] gainBarCode128(String barStr, String code) {
        List<Integer> mCmd = new ArrayList<>();

        mCmd.add(0x1D);
        mCmd.add(0x6B);
        mCmd.add(0x49);
        switch (code) {
            case "C":
            case "c":
                Boolean isCType = !isNumber(barStr.charAt(0), barStr.charAt(1));

                mCmd.add(barStr.length());

                for (int i = 0; i < barStr.length(); i++) {
                    if ((i < barStr.length() - 1) && (isNumber(barStr.charAt(i), barStr.charAt(i + 1)))) {
                        if (!isCType) {
                            mCmd.add(0x7B);
                            mCmd.add(0x43);
                        }
                        mCmd.add(Integer.parseInt(String.valueOf(barStr.charAt(i)) + barStr.charAt(i + 1)));

                        i++;
                        isCType = true;
                    } else {
                        if (isCType) {
                            mCmd.add(0x7B);
                            mCmd.add(0x42);
                        }
                        mCmd.add(barStr.charAt(i) & 0xff);
                        isCType = false;
                    }
                }

                mCmd.set(3, (mCmd.size() - 4));
                break;
            case "B":
            case "b":
                mCmd.add((barStr.length() + 2));
                mCmd.add(0x7B);
                mCmd.add(0x42);
                for (int i = 0; i < barStr.length(); i++) {
                    mCmd.add(barStr.charAt(i) & 0xff);
                }
                break;
            case "A":
            case "a":
                mCmd.add((barStr.length() + 2));
                mCmd.add(0x7B);
                mCmd.add(0x41);
                for (int i = 0; i < barStr.length(); i++) {
                    mCmd.add(barStr.charAt(i) & 0xff);
                }
                break;
            default:
                mCmd.add(barStr.length());
                for (int i = 0; i < barStr.length(); i++) {
                    mCmd.add(barStr.charAt(i) & 0xff);
                }
                break;
        }
        mCmd.add(0x0a);

        byte[] barBytes = new byte[mCmd.size()];
        for (int i = 0; i < mCmd.size(); i++)
            barBytes[i] = (byte) (mCmd.get(i) & 0xff);

        return barBytes;
    }

    /**
     * 判断两个字符是否都为数字
     *
     * @param c1 字符一
     * @param c2 字符二
     * @return
     */
    public static Boolean isNumber(char c1, char c2) {
        boolean isEqualC1 = false;
        boolean isEqualC2 = false;

        for (int i = 48; i <= 57; i++) {
            if (i == c1)
                isEqualC1 = true;

            if (i == c2)
                isEqualC2 = true;

            if (isEqualC1 && isEqualC2)
                break;
        }

        return isEqualC1 && isEqualC2;
    }
}
