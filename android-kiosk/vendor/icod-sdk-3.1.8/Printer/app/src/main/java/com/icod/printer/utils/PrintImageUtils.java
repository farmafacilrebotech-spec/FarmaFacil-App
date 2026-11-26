package com.icod.printer.utils;

import android.graphics.Bitmap;
import android.graphics.Matrix;
import android.util.Log;


/**
 * @User Administrator
 * @Date 2020/7/29 16:26
 */
public class PrintImageUtils {
    private static String TAG = "PrintImageUtils";

    private static int[][] Floyd16x16 = new int[][]{
            {0, 128, 32, 160, 8, 136, 40, 168, 2, 130, 34, 162, 10, 138, 42, 170},
            {192, 64, 224, 96, 200, 72, 232, 104, 194, 66, 226, 98, 202, 74, 234, 106},
            {48, 176, 16, 144, 56, 184, 24, 152, 50, 178, 18, 146, 58, 186, 26, 154},
            {240, 112, 208, 80, 248, 120, 216, 88, 242, 114, 210, 82, 250, 122, 218, 90},
            {12, 140, 44, 172, 4, 132, 36, 164, 14, 142, 46, 174, 6, 134, 38, 166},
            {204, 76, 236, 108, 196, 68, 228, 100, 206, 78, 238, 110, 198, 70, 230, 102},
            {60, 188, 28, 156, 52, 180, 20, 148, 62, 190, 30, 158, 54, 182, 22, 150},
            {252, 124, 220, 92, 244, 116, 212, 84, 254, 126, 222, 94, 246, 118, 214, 86},
            {3, 131, 35, 163, 11, 139, 43, 171, 1, 129, 33, 161, 9, 137, 41, 169},
            {195, 67, 227, 99, 203, 75, 235, 107, 193, 65, 225, 97, 201, 73, 233, 105},
            {51, 179, 19, 147, 59, 187, 27, 155, 49, 177, 17, 145, 57, 185, 25, 153},
            {243, 115, 211, 83, 251, 123, 219, 91, 241, 113, 209, 81, 249, 121, 217, 89},
            {15, 143, 47, 175, 7, 135, 39, 167, 13, 141, 45, 173, 5, 133, 37, 165},
            {207, 79, 239, 111, 199, 71, 231, 103, 205, 77, 237, 109, 197, 69, 229, 101},
            {63, 191, 31, 159, 55, 183, 23, 151, 61, 189, 29, 157, 53, 181, 21, 149},
            {254, 127, 223, 95, 247, 119, 215, 87, 253, 125, 221, 93, 245, 117, 213, 85}
    };


    /**
     * @param mBitmap          需要打印的位图
     * @param nWidth           需要打印的宽度
     * @param nBinaryAlgorithm 二值化算法
     *                         0 使用抖动算法， 对彩色图片有较好的效果。
     *                         1 使用平均阀值算法， 对文本类图片有较好的效果
     * @return
     */
    public static byte[] POS_PrintPicture(Bitmap mBitmap, int nWidth, int nBinaryAlgorithm) {

        byte[] data = null;
        try {
            int dstw = (nWidth + 7) / 8 * 8;
            int dsth = mBitmap.getHeight() * dstw / mBitmap.getWidth();
            int[] dst = new int[dstw * dsth];
            mBitmap = resizeImage(mBitmap, dstw, dsth);
            mBitmap.getPixels(dst, 0, dstw, 0, 0, dstw, dsth);
            byte[] gray = GrayImage(dst);

            boolean[] dithered = new boolean[dstw * dsth];
            if (nBinaryAlgorithm == 0) {
                format_K_dither16x16(dstw, dsth, gray, dithered);
            } else {
                format_K_threshold(dstw, dsth, gray, dithered);
            }
            data = eachLinePixToCmd(dithered, dstw, 0);
        } catch (Exception e) {
            Log.i("POS_PrintPicture", e.toString());
        }

        return data;
    }

    /**
     * @param bitmap
     * @return 将图片转数组
     */
    public static byte[] parseBmpToByte(Bitmap bitmap) {
        int scaleHeight = bitmap.getHeight();
        int bitWidth = (bitmap.getWidth() + 7) / 8 * 8;
        int width = bitmap.getWidth();
        int data[] = new int[width * scaleHeight];
        byte dataVec[] = new byte[bitWidth * scaleHeight / 8 + 8];
        dataVec[0] = 29;
        dataVec[1] = 118;
        dataVec[2] = 48;
        dataVec[3] = 0;
        dataVec[4] = (byte) (bitWidth / 8 % 256);
        dataVec[5] = (byte) (bitWidth / 8 / 256);
        dataVec[6] = (byte) (scaleHeight % 256);
        dataVec[7] = (byte) (scaleHeight / 256);
        int k = 8;
        bitmap.getPixels(data, 0, width, 0, 0, width, scaleHeight);

        for (int h = 0; h < scaleHeight; h++) {
            for (int w = 0; w < bitWidth; w += 8) {
                int value = 0;
                for (int i = 0; i < 8; i++) {
                    int index = h * width + w + i;
                    if (w + i >= width) {
                        value |= 0;
                    } else {
                        value |= px2Byte(data[index]) << (7 - i);
//                        value |= px2Byte(data[index]) << i;
                    }
                }
                dataVec[k++] = (byte) value;
            }
        }
        return dataVec;
    }

    public static byte px2Byte(int pixel) {
        byte b;

        int red = (pixel & 0x00ff0000) >> 16; // 取高两位
        int green = (pixel & 0x0000ff00) >> 8; // 取中两位
        int blue = pixel & 0x000000ff; // 取低两位
        int gray = RGB2Gray(red, green, blue);
        if (gray < 240) {
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


    public static Bitmap resizeImage(Bitmap bitmap, int w, int h) {
        int bitmapWidth = bitmap.getWidth();
        int bitmapHeight = bitmap.getHeight();
        float scaleWidth = (float) w / (float) bitmapWidth;
        float scaleHeight = (float) h / (float) bitmapHeight;
        Matrix matrix = new Matrix();
        matrix.postScale(scaleWidth, scaleHeight);
        return Bitmap.createBitmap(bitmap, 0, 0, bitmapWidth, bitmapHeight, matrix, false);
    }

    public static byte[] GrayImage(int[] src) {
        int srclen = src.length;
        byte[] dst = new byte[srclen];

        for (int k = 0; k < srclen; ++k) {
            dst[k] = (byte) ((int) ((((long) src[k] & 16711680L) >> 16) * 19595L + (((long) src[k] & 65280L) >> 8) * 38469L + (((long) src[k] & 255L) >> 0) * 7472L >> 16));
        }

        return dst;
    }


    public static void format_K_dither16x16(int xsize, int ysize, byte[] orgpixels, boolean[] despixels) {
        int k = 0;

        for (int y = 0; y < ysize; ++y) {
            for (int x = 0; x < xsize; ++x) {
                if ((orgpixels[k] & 0xFF) > Floyd16x16[x & 15][y & 15])
                    despixels[k] = false;
                else
                    despixels[k] = true;
                ++k;
            }
        }
    }

    public static void format_K_threshold(int xsize, int ysize, byte[] orgpixels, boolean[] despixels) {
        int graytotal = 0;
        int k = 0;
        int i;
        int j;
        int gray;
        for (i = 0; i < ysize; ++i) {
            for (j = 0; j < xsize; ++j) {
                gray = orgpixels[k] & 255;
                graytotal += gray;
                ++k;
            }
        }

        int grayave = graytotal / ysize / xsize / 2;

        Log.d(TAG, "grayave: " + grayave);
        Log.d(TAG, "graytotal: " + graytotal);
        Log.d(TAG, "ysize: " + ysize);
        Log.d(TAG, "xsize: " + xsize);

        k = 0;
        for (i = 0; i < ysize; ++i) {
            for (j = 0; j < xsize; ++j) {
                gray = orgpixels[k] & 255;
                if (gray > grayave) {
                    despixels[k] = false;
                } else {
                    despixels[k] = true;
                }
                ++k;
            }
        }

    }

    public static byte[] eachLinePixToCmd(boolean[] src, int nWidth, int nMode) {
        int nHeight = src.length / nWidth;
        int nBytesPerLine = nWidth / 8;
        byte[] data = new byte[nHeight * (8 + nBytesPerLine)];
        int offset;
        int k = 0;

        for (int i = 0; i < nHeight; ++i) {
            offset = i * (8 + nBytesPerLine);
            data[offset + 0] = 29;
            data[offset + 1] = 118;
            data[offset + 2] = 48;
            data[offset + 3] = (byte) (nMode & 1);
            data[offset + 4] = (byte) (nBytesPerLine % 256);
            data[offset + 5] = (byte) (nBytesPerLine / 256);
            data[offset + 6] = 1;
            data[offset + 7] = 0;

            for (int j = 0; j < nBytesPerLine; ++j) {
                data[offset + 8 + j] = (byte) ((src[k] ? 128 : 0) | (src[k + 1] ? 64 : 0) | (src[k + 2] ? 32 : 0) | (src[k + 3] ? 16 : 0) | (src[k + 4] ? 8 : 0) | (src[k + 5] ? 4 : 0) | (src[k + 6] ? 2 : 0) | (src[k + 7] ? 1 : 0));
                k += 8;
            }
        }

        return data;
    }


    public static byte[] eachLinePixToCompressCmd(boolean[] src, int nWidth) {
        int nHeight = src.length / nWidth;
        int nBytesPerLine = nWidth / 8;
        byte[] data = new byte[nHeight * nBytesPerLine];
        int k = 0;

        int compresseddatalen;
        for (compresseddatalen = 0; compresseddatalen < nHeight; ++compresseddatalen) {
            for (int y = 0; y < nBytesPerLine; ++y) {
                data[compresseddatalen * nBytesPerLine + y] = (byte) ((src[k] ? 128 : 0) | (src[k + 1] ? 64 : 0) | (src[k + 2] ? 32 : 0) | (src[k + 3] ? 16 : 0) | (src[k + 4] ? 8 : 0) | (src[k + 5] ? 4 : 0) | (src[k + 6] ? 2 : 0) | (src[k + 7] ? 1 : 0));
                k += 8;
            }
        }

        compresseddatalen = 0;

        byte[] line;
        for (int y = 0; y < nHeight; ++y) {
            line = new byte[nBytesPerLine];
            System.arraycopy(data, y * nBytesPerLine, line, 0, nBytesPerLine);
            byte[] buf = CompressDataBuf(line);
            line = new byte[]{31, 40, 80, (byte) ((int) ((long) buf.length & 255L)), (byte) ((int) (((long) buf.length & 65535L) >> 8))};
            compresseddatalen += line.length;
            compresseddatalen += buf.length;
        }

        byte[] compresseddatabytes = new byte[compresseddatalen];
        int offset = 0;

        for (int y = 0; y < nHeight; ++y) {
            line = new byte[nBytesPerLine];
            System.arraycopy(data, y * nBytesPerLine, line, 0, nBytesPerLine);
            byte[] buf = CompressDataBuf(line);
            byte[] cmd = new byte[]{31, 40, 80, (byte) ((int) ((long) buf.length & 255L)), (byte) ((int) (((long) buf.length & 65535L) >> 8))};
            System.arraycopy(cmd, 0, compresseddatabytes, offset, cmd.length);
            offset += cmd.length;
            System.arraycopy(buf, 0, compresseddatabytes, offset, buf.length);
            offset += buf.length;
        }

        return compresseddatabytes;
    }


    public static byte[] CompressDataBuf(byte[] src) {
        int srclen = src.length;
        byte[] buf = new byte[srclen * 2];
        byte ch = src[0];
        buf[0] = ch;
        int cnt = 1;
        int idx = 1;

        for (int i = 1; i < srclen; ++i) {
            while (src[i] == ch) {
                ++i;
                ++cnt;
                if (i >= srclen) {
                    break;
                }
            }

            if (i >= srclen) {
                buf[idx] = (byte) cnt;
                ++idx;
                break;
            }

            buf[idx] = (byte) cnt;
            buf[idx + 1] = ch = src[i];
            cnt = 1;
            idx += 2;
        }

        if ((idx & 1) != 0) {
            buf[idx] = (byte) cnt;
            ++idx;
        }

        byte[] dst;
        if (idx >= srclen) {
            dst = new byte[srclen + 1];
            dst[0] = 0;
            System.arraycopy(src, 0, dst, 1, srclen);
            return dst;
        } else {
            dst = new byte[idx + 1];
            dst[0] = (byte) idx;
            System.arraycopy(buf, 0, dst, 1, idx);
            return dst;
        }
    }


}
