package com.icod.printer.utils;

import android.content.res.AssetManager;
import android.text.TextUtils;
import android.util.Log;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Created by crf on 2020/5/30.
 */
public class PrinterCommodityUtils {
    /**
     * 读取Assets的text文件
     *
     * @param fileName
     * @return
     */
    public static byte[] readAssetsText(AssetManager assetManager, String fileName) {
        try {
            InputStream inputStream = assetManager.open(fileName);
            byte[] buffer = new byte[inputStream.available()];
            List<Byte> byteList = new ArrayList<>();
            while (inputStream.read(buffer) != -1) {
                String string = new String(buffer);
                StringBuilder stringBuilder = new StringBuilder();

                stringBuilder.append(string);
                string = stringBuilder.toString();
                string = string.trim();
                string = string.replaceAll(" |,|\r|\n|#", "");
                if (string.length() % 2 != 0) {
                    string = string.substring(0, string.length() - 2);
                }
                byteList.addAll(hexStr2Str(string));
            }
            inputStream.close();
            byte[] bytes = new byte[byteList.size()];
            for (int i = 0; i < bytes.length; i++) {
                bytes[i] = byteList.get(i);
            }
            return bytes;
        } catch (IOException e) {
            e.printStackTrace();
            return null;
        }
    }

    /**
     * 读取Assets的text文件
     *
     * @param fileName
     * @return
     */
    public static byte[] readAssetsTextV1(AssetManager assetManager, String fileName) {
        try {
            InputStream inputStream = assetManager.open(fileName);
            byte[] buffer = new byte[inputStream.available()];
            List<Byte> byteList = new ArrayList<>();
            while (inputStream.read(buffer) != -1) {
                String string = new String(buffer);
                StringBuilder stringBuilder = new StringBuilder();

                stringBuilder.append(string);
                string = stringBuilder.toString().trim();
                String[] strings = string.split(" |, ");

                for (String s : strings) {
                    byteList.add((byte) Integer.parseInt(s));
                }
            }
            inputStream.close();
            byte[] bytes = new byte[byteList.size()];
            for (int i = 0; i < bytes.length; i++) {
                bytes[i] = byteList.get(i);
            }
            return bytes;
        } catch (IOException e) {
            e.printStackTrace();
            return null;
        }
    }

    /**
     * 58mm打印机 商品打印样式
     * 样式：################# ++++ ---- ****(#名称 +单价 -数量 *总计)
     *
     * @param name   商品名称
     * @param price  商品单价 不能大于99.9元
     * @param number 商品数量 不能大于9999个
     * @param total  商品总计 不能大于99.9元
     * @return 返回商品打印样式。
     * -1 ：名称格式错误
     * -2 ：单价格式错误
     * -3 ：数量格式错误
     * -4 ：总计格式错误
     */
    public static String commodity58Print(String name, String price, String number, String total) {
        String printText = "";
        String takeUp = " ";                // 填充字符
        String nameStr = name;
        int nameLen = byteNum(nameStr);
        int priceLen = byteNum(price);
        int numberLen = byteNum(number);
        int totalLen = byteNum(total);
        if (nameLen < 17) {
            printText += nameStr;
            for (int i = 0; i < 17 - nameLen; i++)
                printText += takeUp;
            nameLen -= byteNum(nameStr);
        } else {
            printText += nameStr.substring(0, 8);
            printText += takeUp;
            nameLen -= byteNum(nameStr.substring(0, 8));
            nameStr = nameStr.substring(8);
        }

        if (priceLen < 5) {
            for (int i = 0; i < 5 - priceLen; i++)
                printText += takeUp;
            printText += price;
        } else {
            return "-2";
        }

        if (numberLen < 5) {
            for (int i = 0; i < 5 - numberLen; i++)
                printText += takeUp;
            printText += number;
        } else {
            return "-3";
        }

        if (totalLen < 5) {
            for (int i = 0; i < 5 - totalLen; i++)
                printText += takeUp;
            printText += total;
        } else {
            return "-4";
        }
        printText += "\n";
        while (nameLen > 0) {
            if (nameLen > 16) {
                printText += nameStr.substring(0, 8);
                nameLen -= byteNum(nameStr.substring(0, 8));
                nameStr = nameStr.substring(8, nameStr.length());
            } else {
                printText += nameStr;
                nameLen -= byteNum(nameStr);
            }
            printText += "\n";
        }
        return printText;
    }

    /**
     * 80mm打印机 商品打印样式
     * 样式：######################## ++++++++ ---- ********(#名称 +单价 -数量 *总计)
     *
     * @param name   商品名称
     * @param price  商品单价 不能大于99999.99元
     * @param number 商品数量 不能大于9999个
     * @param total  商品总计 不能大于99999.99元
     * @return 返回商品打印样式。
     * -1 ：名称格式错误
     * -2 ：单价格式错误
     * -3 ：数量格式错误
     * -4 ：总计格式错误
     */
    public static String commodity80Print(String name, String number, String price, String total) {
        String printText = "";
        String takeUp = " ";                // 填充字符
        String nameStr = name;
        int nameLen = byteNum(nameStr);
        int priceLen = byteNum(price);
        int numberLen = byteNum(number);
        int totalLen = byteNum(total);
        if (nameLen < 25) {
            printText += nameStr;
            for (int i = 0; i < 25 - nameLen; i++) {
                printText += takeUp;
            }
            nameLen -= byteNum(nameStr);
        } else {
            printText += nameStr.substring(0, 12);
            printText += takeUp;
            nameLen -= byteNum(nameStr.substring(0, 12));
            nameStr = nameStr.substring(12, nameStr.length());
        }

        if (priceLen < 9) {
            for (int i = 0; i < 9 - priceLen; i++)
                printText += takeUp;
            printText += price;
        } else {
            return "-2";
        }

        if (numberLen < 5) {
            for (int i = 0; i < 5 - numberLen; i++)
                printText += takeUp;
            printText += number;
        } else {
            return "-3";
        }

        if (totalLen < 9) {
            for (int i = 0; i < 9 - totalLen; i++)
                printText += takeUp;
            printText += total;
        } else {
            return "-4";
        }

        printText += "\n";
        while (nameLen > 0) {
            if (nameLen > 24) {
                printText += nameStr.substring(0, 12);
                nameLen -= byteNum(nameStr.substring(0, 12));
                nameStr = nameStr.substring(12, nameStr.length());
            } else {
                printText += nameStr;
                nameLen -= byteNum(nameStr);
            }
            printText += "\n";
        }
        return printText;
    }

    /**
     * 80mm的左右对称文本打印
     * <p>
     * 左右对称各占一半打印位
     *
     * @param is80mm    true：80mm打印机  false:58mm打印机
     * @param leftText  左侧文本
     * @param rightText 右侧文本
     * @return
     */
    public static String eudipleuralPrint(Boolean is80mm, String leftText, String rightText) {
        String printText = "";
        String takeUp = " ";                    // 填充符
        String lineBreak = "\n";                // 换行符
        int LINE_MAX_LEN = 48;                  // 一行的最大内容长度
        if (is80mm)
            LINE_MAX_LEN = 72;

        int SIDE_MAX_LEN = LINE_MAX_LEN / 2;    // 一侧的最大内容长度
        String leftStr = leftText;
        String rightStr = rightText;
        int leftLen = byteNum(leftStr);
        int rightLen = byteNum(rightStr);

        while ((leftLen > 0) || (rightLen > 0)) {
            if (leftLen == 0) {
                // 内容为空时铺满填充符
                for (int i = 0; i < SIDE_MAX_LEN; i++)
                    printText += takeUp;

            } else {
                // 判断显示的内容是否超出最大内容长度
                if (leftLen <= SIDE_MAX_LEN) {
                    printText += leftStr;
                    for (int i = 0; i < SIDE_MAX_LEN - leftLen; i++)
                        printText += takeUp;
                    leftLen -= byteNum(leftStr);
                } else {
                    int lenCount = 0;
                    int subCount = 0;
                    for (int i = 0; i < leftStr.length(); i++) {
                        lenCount += byteNum(String.valueOf(leftStr.charAt(i)));
                        if (lenCount > SIDE_MAX_LEN) {
                            subCount = i;
                            break;
                        }
                    }
                    printText += leftStr.substring(0, subCount);
                    if (lenCount % 2 != 0) printText += takeUp;
                    leftLen -= byteNum(leftStr.substring(0, subCount));
                    leftStr = leftStr.substring(subCount);
                }
            }

            if (rightLen == 0) {
                for (int i = 0; i < SIDE_MAX_LEN; i++)
                    printText += takeUp;

            } else {
                if (rightLen <= SIDE_MAX_LEN) {
                    for (int i = 0; i < SIDE_MAX_LEN - rightLen; i++)
                        printText += takeUp;

                    printText += rightStr;
                    rightLen -= byteNum(rightStr);
                } else {
                    int lenCount = 0;
                    int subCount = 0;
                    for (int i = 0; i < rightStr.length(); i++) {
                        lenCount += byteNum(String.valueOf(rightStr.charAt(i)));
                        if (lenCount > SIDE_MAX_LEN) {
                            subCount = i;
                            break;
                        }
                    }
                    printText += rightStr.substring(0, subCount);
                    if (lenCount % 2 != 0) printText += takeUp;
                    rightLen -= byteNum(rightStr.substring(0, subCount));
                    rightStr = rightStr.substring(subCount);
                }
            }

        }
        printText += lineBreak;
        return printText;
    }

    /**
     * 字符串转为字节集合
     *
     * @param hexStr
     * @return
     */
    public static List<Byte> hexStr2Str(String hexStr) {
        char[] hexs = hexStr.toCharArray();
        List<Byte> bytes = new ArrayList<>();
        int value;
        for (int i = 0; i < hexStr.length() / 2; i++) {
            value = ((charToByte(hexs[2 * i]) << 4 | charToByte(hexs[2 * i + 1])));
            bytes.add((byte) (value & 0xff));
        }
        return bytes;
    }

    /**
     * 获取占用打印位：汉字二个打印位、英文数字符号一个打印位
     *
     * @param str
     * @return
     */
    public static int byteNum(String str) {
        int m = 0;
        char[] arr = str.toCharArray();
        for (char c : arr) {
            if ((c >= 0x0391 && c <= 0xFFE5))  //中文字符
                m = m + 2;
            else if (c <= 0x00FF) //英文字符
                m = m + 1;
        }
        return m;
    }

    /**
     * 字符转换为字节
     *
     * @param c
     * @return
     */
    private static byte charToByte(char c) {
        switch (c) {
            case '0':
                return 0x00;
            case '1':
                return 0x01;
            case '2':
                return 0x02;
            case '3':
                return 0x03;
            case '4':
                return 0x04;
            case '5':
                return 0x05;
            case '6':
                return 0x06;
            case '7':
                return 0x07;
            case '8':
                return 0x08;
            case '9':
                return 0x09;
            case 'A':
            case 'a':
                return 0x0a;
            case 'B':
            case 'b':
                return 0x0b;
            case 'C':
            case 'c':
                return 0x0c;
            case 'D':
            case 'd':
                return 0x0d;
            case 'E':
            case 'e':
                return 0x0e;
            case 'F':
            case 'f':
                return 0x0f;
        }
        return 0;
    }
}
