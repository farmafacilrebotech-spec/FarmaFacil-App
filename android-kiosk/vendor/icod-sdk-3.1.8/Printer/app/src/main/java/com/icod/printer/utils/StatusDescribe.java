package com.icod.printer.utils;


public class StatusDescribe {

    /**
     * @param getStatus getState参数说明：
     *                  (getState & 0x01) >0 : 脱机
     *                  (getState & 0x02) >0 : 按纸键接通
     *                  (getState & 0x04) >0 : 发送错误
     *                  (getState & 0x08) >0 : 打印纸用完，停止打印
     *                  (getState & 0x10) >0 : 通过进纸键进纸
     *                  (getState & 0x20) >0 : 机头抬杠已打开
     *                  (getState & 0x40) >0 : 出现可自动恢复的错误
     *                  (getState & 0x80) >0 : 出现不可恢复的错误
     *                  (getState & 0x100) >0 : 发生机械错误
     *                  (getState & 0x200) >0 : 纸将尽检测器检测到纸张接近末端
     *                  (getState & 0x400) >0 : 纸尽传感器检测到卷纸末端
     * @return
     */
    public static String getStatusDescribe(int getStatus) {
        try {
            int status = getStatus;
            if (status < 0) {
                return "数据传输错误,请检查连接或者重新发送";
            }
            StringBuffer descriptorBuffer = new StringBuffer();
            StringBuffer troubleBuffer = new StringBuffer();
            //传感应状态
            if ((status & 0x200) > 0) {
                descriptorBuffer.append("少纸, ");//[1]
                troubleBuffer.append("PaperFew|");
            }
            // 缺纸
            if ((status & 0x400) > 0 || (status & 0x08) > 0) {
                descriptorBuffer.append("缺纸, ");
                troubleBuffer.append("OutOfPaper|");
            }
            //脱机状态
            if ((status & 0x4) > 0) {
                descriptorBuffer.append("发生错误, ");
                troubleBuffer.append("happen error|");
            }
            //
            if ((status & 0x20) > 0) {
                descriptorBuffer.append("盖板打开, ");
                troubleBuffer.append("box open|");
            }
            //打印机状态
            if ((status & 0x1) > 0) {
                descriptorBuffer.append("脱机, ");
                troubleBuffer.append("Offline|");
            }
            if ((status & 0x2) > 0 || (status & 0x10) > 0) {
                descriptorBuffer.append("通过进纸键进纸, ");//[8]
                troubleBuffer.append("feeding|");
            }
            //错误状态
            if ((status & 0x100) > 0) {
                descriptorBuffer.append("机械错误, ");
                troubleBuffer.append("MachineError|");
            }
            if ((status & 0x40) > 0) {
                descriptorBuffer.append("可自动恢复错误, ");
                troubleBuffer.append("CorrectingError|");
            }
            if ((status & 0x80) > 0) {
                descriptorBuffer.append("不可恢复错误, ");
                troubleBuffer.append("NotCorrectError|");
            }

            String descriptor = descriptorBuffer.toString().trim();

            if (!descriptor.isEmpty()) {
                descriptor = descriptor.substring(0, descriptor.length() - 1);
            } else {
                descriptor = "正常";
            }

            return descriptor;
        } catch (Exception e) {

            return "Offline123123";
        }
    }

    //解析用控制通道获取的状态

    /**
     * @param getStatus getState参数说明：
     *                  0x01位  出纸器有纸
     *                  0x02位  过温
     *                  0x04位  切刀错误
     *                  0x08位  为打印状态正常
     *                  0x10位  机器选择位
     *                  0x20位  缺纸
     *                  0x40位  PNE 纸将尽
     *                  0x80位  开盖
     * @return
     */
    public static String getStatusDescribeWithControl(int getStatus) {
        try {
            int status = getStatus;
            if (status == -1) {
                return "数据传输错误,请检查连接或者重新发送";
            }
            StringBuffer descriptBuffer = new StringBuffer();
            StringBuffer troubleBuffer = new StringBuffer();
            //传感应状态
            if ((status & 0x40) > 0) {
                descriptBuffer.append("少纸, ");//[1]
                troubleBuffer.append("PaperFew|");
            }

            if ((status & 0x20) > 0) {
                descriptBuffer.append("缺纸, ");
                troubleBuffer.append("OutOfPaper|");

            }

            if ((status & 0x80) > 0) {
                descriptBuffer.append("开盖, ");
                troubleBuffer.append("box open|");

            }

            if ((status & 0x02) > 0) {
                descriptBuffer.append("过温, ");
                troubleBuffer.append("happen error|");
            }

            if ((status & 0x04) > 0) {
                descriptBuffer.append("卡纸, ");
                troubleBuffer.append("happen error|");
            }


            String descript = descriptBuffer.toString().trim();

            if (!descript.isEmpty()) {
                descript = descript.substring(0, descript.length() - 1);
            } else {
                descript = "正常";
            }


            return descript;
        } catch (Exception e) {

            return "Offline123123";
        }
    }
}