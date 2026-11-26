package com.icod.printer.base;

import android.app.Application;

import com.szsicod.print.escpos.PrinterAPI;
import com.szsicod.print.log.AndroidLogCatStrategy;
import com.szsicod.print.log.Logger;
import com.szsicod.print.log.Utils;


/**
 * Created by crf on 2020/5/30.
 */
public class BaseApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        Utils.init(this);

        // 增加日志文件，true开启日志输出
        PrinterAPI.getInstance().setOutput(true);

        // 添加终端日志d
        Logger.addLogStrategy(new AndroidLogCatStrategy());
    }

}
