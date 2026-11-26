package com.icod.printer.ui;


import android.Manifest;
import android.bluetooth.BluetoothDevice;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Message;
import android.os.SystemClock;
import android.print.PrintAttributes;
import android.support.annotation.Nullable;
import android.support.annotation.RequiresApi;
import android.support.v4.print.PrintHelper;
import android.text.TextUtils;
import android.util.Log;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.Spinner;
import android.widget.TextView;

import com.blankj.utilcode.util.AppUtils;
import com.blankj.utilcode.util.CrashUtils;
import com.blankj.utilcode.util.FileIOUtils;
import com.google.zxing.common.BitMatrix;
import com.icod.printer.R;
import com.icod.printer.base.BaseActivity;
import com.icod.printer.utils.Constant;
import com.icod.printer.utils.DataUtils;
import com.icod.printer.utils.PermissionUtil;
import com.icod.printer.utils.PrintImageUtils;
import com.icod.printer.utils.PrinterCommodityUtils;
import com.icod.printer.utils.StatusDescribe;
import com.icod.printer.utils.TwoColorImageUtils;
import com.icod.serial.SerialPortFinder;
import com.szsicod.print.escpos.BellPrinterAPI;
import com.szsicod.print.escpos.OrderPrinterAPI;
import com.szsicod.print.escpos.PrinterAPI;
import com.szsicod.print.escpos.T200PrinterAPI;
import com.szsicod.print.io.BluetoothAPI;
import com.szsicod.print.io.InterfaceAPI;
import com.szsicod.print.io.SerialAPI;
import com.szsicod.print.io.SocketAPI;
import com.szsicod.print.io.USBAPI;
import com.szsicod.print.utils.BarCode128Utils;
import com.szsicod.print.utils.BitmapUtils;

import java.io.File;
import java.io.UnsupportedEncodingException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import static com.icod.printer.utils.Constant.CONNECT_RETURN_CODE;
import static com.icod.printer.utils.Constant.TEXT_SHOW_CODE;


public class MainActivity extends BaseActivity implements View.OnClickListener {
    private static final String TAG = "MainActivity";
    private static final int REQUEST_CODE_INTENT = 10002;

    // View
    private Spinner spConnectType;
    private LinearLayout llUSB, llSerial, llWifi;
    private Spinner spDeviceList, spBaudRate, spFlowcontrol;
    private EditText etIp, etPort;
    private TextView tvPrintShow;
    private String printShowStr;

    private UsbBroadCastReceiver mUsbBroadCastReceiver;
    private PrinterAPI mPrinter;
    private Runnable runnable;

    private DataUtils dataUtils;
    private String[] connect_type_string;
    private String[] mSerialportList;
    private String[] baud_rate_string;
    private int[] baud_rate_int;
    private String[] serial_flow;


    static {
        //如果使用UsbNativeAPI 必须加载 适用root板 这个不需要权限窗口和申请权限
        System.loadLibrary("usb1.0");
        //串口
        System.loadLibrary("serial_icod");
        //图片
        System.loadLibrary("image_icod");
    }

    @Override
    protected int getLayoutId() {
        return R.layout.activity_main;
    }

    // 打印机的连接
    private void funcPrinterConnect() {
        runnable = new Runnable() {
            @Override
            public void run() {
                try {
                    handler.obtainMessage(Constant.TEXT_SHOW_CODE, "进入连接步骤").sendToTarget();
                    /**
                     * 1、 先判断是否与打印机已有连接
                     *      a、有连接，可以断开当前的连接，重新再次建立连接
                     *      b、有连接，可以直接进入打印步骤
                     *      c、未连接，需要建立打印机后，才能进入打印
                     *      （注：为了确保后续操作的稳定性，在连接成功后延时一秒左右才执行下一步操作）
                     */
                    if (mPrinter.isConnect()) {
                        mPrinter.disconnect();
                        handler.obtainMessage(Constant.DISCONNECT_CODE, false).sendToTarget();
                    }
                    /**
                     * 2、构造连接对象
                     */
                    InterfaceAPI io = null;
                    switch (spConnectType.getSelectedItemPosition()) {
                        case 0:
                            // USB
                            io = new USBAPI(MainActivity.this);
                            break;
                        case 1:
                            // Bluetooth
                            Intent intent = new Intent(MainActivity.this, BluetoothActivity.class);
                            startActivityForResult(intent, REQUEST_CODE_INTENT);
                            handler.obtainMessage(TEXT_SHOW_CODE, "BlueTooth Select...").sendToTarget();
                            break;
                        case 2:
                            // Serial
                            io = new SerialAPI(new File(mSerialportList[spDeviceList.getSelectedItemPosition()]),
                                    baud_rate_int[spBaudRate.getSelectedItemPosition()],
                                    spFlowcontrol.getSelectedItemPosition());
                            break;
                        case 3:
                            // Wifi
                            String etIpStr = etIp.getText().toString().trim();
                            String etPortStr = etPort.getText().toString().trim();
                            if (!TextUtils.isEmpty(etIpStr) && !TextUtils.isEmpty(etPortStr))
                                io = new SocketAPI(etIpStr, Integer.parseInt(etPortStr));
                            break;
                    }
                    /**
                     * 3、调用连接
                     *     连接函数：connect()
                     *     返回值说明：
                     *           0：连接成功
                     *          -1：连接失败
                     *          -2：未找到打印机设备
                     */
                    if (io != null) {
                        int ret = mPrinter.connect(io);
                        handler.obtainMessage(CONNECT_RETURN_CODE, ret).sendToTarget();
                    }
                } catch (Exception e) {
                    handler.obtainMessage(Constant.CONNECT_ERROR_CODE).sendToTarget();
                }
            }
        };
        new Thread(runnable).start();
    }

    // 打印机断开连接
    private void funcPrinterDisConnect() {
        runnable = new Runnable() {
            @Override
            public void run() {
                try {
                    // 打印方法：disconnect()
                    // 调用例范：
                    mPrinter.disconnect();
                    handler.obtainMessage(Constant.DISCONNECT_CODE, true).sendToTarget();
                } catch (Exception e) {
                    e.printStackTrace();
                }

            }
        };
        new Thread(runnable).start();
    }

    // 打印文本
    private void funcPrintText() {

        runnable = new Runnable() {
            @Override
            public void run() {
                try {
                    /**
                     * 1、条形码打印函数：printString()
                     *      参数说明查看文档
                     */
                    String str = "文本打印文本打印文本打印\n" +
                            "文本打印\n" +
                            "文本打印\n" +
                            "文本打印\n" +
                            "ABCDEFGHIJKLMNOQPRSTUVWXYZ\n" +
                            "abcdefghijklmnoqprstuvwxyz\n" +
                            "1234567890\n" +
                            "123456789123456789123456789123456789123456789123456789123456789123456789123456789123456789123456789123456789123456789\n";

                    mPrinter.printString("1、文本测试打印1", "GBK", true);
                    mPrinter.printString("2、文本测试打印2", "GBK", true);
                    mPrinter.printString("3、文本测试打印3", "GBK", true);
                    mPrinter.printString(str, "GBK", true);
                    mPrinter.printFeed();
                    int ret = mPrinter.cutPaper(66, 0);
                    handler.obtainMessage(Constant.EXECUTE_RESULT_CODE, ret).sendToTarget();
                } catch (Exception e) {
                    handler.obtainMessage(Constant.EXECUTE_ERROR_CODE).sendToTarget();
                    e.printStackTrace();
                }
            }
        };
        new Thread(runnable).start();
    }

    // 打印一维码
    private void funcPrintBarCode() {
        runnable = new Runnable() {
            @Override
            public void run() {
                try {
                    /**
                     * 1、条形码打印函数：printBarCode()
                     *      参数说明查看文档
                     */
                    String barStr = "S123456789";
                    mPrinter.printString("BarCode Print Test:\n");
                   /*
                   对齐函数：setAlignMode(int n)
                        参数：n 范围[0,2]
                            0左对齐(默认)
                            1居中
                            2右对齐
                    */
                    mPrinter.setAlignMode(1);
                    /*
                          条码内容显示在下面
                          0x00 不显示条码内容
                          0x01 条码上方显示条码内容
                          0x02 条码下方显示条码内容
                          0x03 条码上下方都显示条码内容
                     */
                    mPrinter.sendOrder(new byte[]{0x1d, 0x48, 0x02});
                    mPrinter.setBarCodeWidth(2);
                    mPrinter.setBarCodeHeight(120);

                    mPrinter.printBarCode(73, barStr.length(), barStr);

                    mPrinter.setAlignMode(0);
                    mPrinter.printString("Test End！\n");
                    mPrinter.printFeed();
                    int ret = mPrinter.cutPaper(66, 0);
                    handler.obtainMessage(Constant.EXECUTE_RESULT_CODE, ret).sendToTarget();
                } catch (Exception e) {
                    handler.obtainMessage(Constant.EXECUTE_ERROR_CODE).sendToTarget();
                    e.printStackTrace();
                }
            }
        };
        new Thread(runnable).start();
    }


    // 打印二维码
    private void funcPrintQrCode() {
        runnable = new Runnable() {
            @Override
            public void run() {
                try {
                    /**
                     * 1、二维码打印函数：printQRCode()
                     *      参数说明查看文档
                     */

                    String qrStr = "http://www.szicod.com/";
                    mPrinter.printString("QRCode Print Test:\n");
                    mPrinter.printQRCode(qrStr, 6, false);
                    mPrinter.printString("Test End！\n");
                    mPrinter.printFeed();
                    int ret = mPrinter.cutPaper(0x42, 0);
                    handler.obtainMessage(Constant.EXECUTE_RESULT_CODE, ret).sendToTarget();
                } catch (Exception e) {
                    handler.obtainMessage(Constant.EXECUTE_ERROR_CODE).sendToTarget();
                    e.printStackTrace();
                }
            }
        };
        new Thread(runnable).start();
    }

    // 打印图片
    private void funcPrintImage() {
        runnable = new Runnable() {
            @Override
            public void run() {
                try {
                    /**
                     * 1、获取需要打印的图片
                     *      BitmapUtils.reSize()函数：对图片进行缩放处理
                     */
                    int printWidth = (80 - 8) * 8;      // 80mm打印宽度
//                    int printWidth = (58 - 10) * 8;     // 58mm打印宽度
                    Bitmap bitmap = BitmapFactory.decodeResource(getResources(), R.mipmap.icod_2);
                    bitmap = BitmapUtils.reSize(bitmap, printWidth, bitmap.getHeight() * printWidth / bitmap.getWidth());


                    /**
                     * 2、执行图形打印
                     *      图片打印函数：printRasterBitmap()
                     */
                    mPrinter.printString("Image Print Test:\n");
                    mPrinter.printRasterBitmap(bitmap);
                    mPrinter.printString("Test End！\n");
                    mPrinter.printFeed();
                    int ret = mPrinter.cutPaper(0x42, 0x00);
                    handler.obtainMessage(Constant.EXECUTE_RESULT_CODE, ret).sendToTarget();
                } catch (Exception e) {
                    handler.obtainMessage(Constant.EXECUTE_ERROR_CODE).sendToTarget();
                    e.printStackTrace();
                }
            }
        };
        new Thread(runnable).start();
    }

    // 开启钱箱
    private void funcPrintCashBox() {
        runnable = new Runnable() {
            @Override
            public void run() {
                try {
                    /**
                     * 1、钱箱开启函数：openCashDrawer()
                     */
                    int ret = mPrinter.openCashDrawer(0x00, 0xE0, 0xF0);

                    handler.obtainMessage(Constant.EXECUTE_RESULT_CODE, ret).sendToTarget();
                } catch (Exception e) {
                    handler.obtainMessage(Constant.EXECUTE_ERROR_CODE).sendToTarget();
                    e.printStackTrace();
                }
            }
        };
        new Thread(runnable).start();
    }

    // 查询打印机状态
    private void funcPrintState() {

        runnable = new Runnable() {
            @Override
            public void run() {
                // 打印方法：getStatus
                // 打印例范文本
                try {
                    handler.obtainMessage(Constant.TEXT_SHOW_CODE, getString(R.string.btn_print_state_Str)).sendToTarget();
                    // Writing a
                    int s = mPrinter.getStatus();
                    mPrinter.getPrinterStatus();
                    String showStr = "code: " + s + "\nstate: " + StatusDescribe.getStatusDescribe(s);
                    handler.obtainMessage(Constant.TEXT_SHOW_CODE, showStr).sendToTarget();

//                    // Writing b
//                    byte[] bytes = new byte[]{
//                            0x10, 0x04, 0x01,
//                            0x10, 0x04, 0x02,
//                            0x10, 0x04, 0x03,
//                            0x10, 0x04, 0x04
//                    };
//                    String showStr = "write: " + m1 + "\nread: " + m2 + "\n" + DataUtils.bytesToHexString(ret);
//                    handler.obtainMessage(Constant.TEXT_SHOW_CODE, showStr).sendToTarget();
                } catch (Exception e) {
                    e.printStackTrace();
                }

            }
        };
        new Thread(runnable).start();
    }

    // 自检页
    private void funcTestPage() {

        runnable = new Runnable() {
            @Override
            public void run() {
                try {
                    /**
                     * 1、自检页打印函数：selfTestPage()
                     */


                    int ret = mPrinter.selfTestPage();

                    handler.obtainMessage(Constant.EXECUTE_RESULT_CODE, ret).sendToTarget();

                } catch (Exception e) {
                    handler.obtainMessage(Constant.EXECUTE_ERROR_CODE).sendToTarget();
                    e.printStackTrace();
                }
            }
        };
        new Thread(runnable).start();
    }

    // 测试打印
    private void funcTestPrint() {
        new Thread() {
            @RequiresApi(api = Build.VERSION_CODES.KITKAT)
            @Override
            public void run() {
                super.run();
                try {


                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }.start();

    }


    @Override
    protected void initView() {
        spConnectType = findViewById(R.id.sp_connect_type);
        llUSB = findViewById(R.id.ll_usb);
        llSerial = findViewById(R.id.ll_serial);
        llWifi = findViewById(R.id.ll_wifi);
        spDeviceList = findViewById(R.id.sp_device_list);
        spBaudRate = findViewById(R.id.sp_baud_rate);
        spFlowcontrol = findViewById(R.id.sp_flowcontrol);
        etIp = findViewById(R.id.et_ip);
        etPort = findViewById(R.id.et_port);

        findViewById(R.id.btn_connect).setOnClickListener(this);
        findViewById(R.id.btn_disconnect).setOnClickListener(this);
        findViewById(R.id.btn_print_text).setOnClickListener(this);
        findViewById(R.id.btn_print_barcode).setOnClickListener(this);
        findViewById(R.id.btn_print_qrcode).setOnClickListener(this);
        findViewById(R.id.btn_print_image).setOnClickListener(this);
        findViewById(R.id.btn_print_cashbox).setOnClickListener(this);
        findViewById(R.id.btn_print_state).setOnClickListener(this);
        findViewById(R.id.btn_self_page).setOnClickListener(this);
        findViewById(R.id.btn_test_print).setOnClickListener(this);
        findViewById(R.id.tv_usb).setOnClickListener(this);

        tvPrintShow = findViewById(R.id.tv_print_show);

        spConnectType.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                String sInfo = parent.getItemAtPosition(position).toString();
                if (connect_type_string[0].equals(sInfo)) {
                    if (mUsbBroadCastReceiver == null) {
                        IntentFilter intentFilter = new IntentFilter();
                        intentFilter.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);
                        intentFilter.addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED);
                        mUsbBroadCastReceiver = new UsbBroadCastReceiver();
                        registerReceiver(mUsbBroadCastReceiver, intentFilter);
                    }
                    llUSB.setVisibility(View.VISIBLE);
                    llSerial.setVisibility(View.GONE);
                    llWifi.setVisibility(View.GONE);
                } else if (connect_type_string[1].equals(sInfo)) {
                    llUSB.setVisibility(View.GONE);
                    llSerial.setVisibility(View.GONE);
                    llWifi.setVisibility(View.GONE);
                } else if (connect_type_string[2].equals(sInfo)) {
                    llUSB.setVisibility(View.GONE);
                    llSerial.setVisibility(View.VISIBLE);
                    llWifi.setVisibility(View.GONE);

                    mSerialportList = SerialPortFinder.getAllDevicesPath();
                    if (mSerialportList.length <= 0) mSerialportList = new String[]{"NONE"};
                    ArrayAdapter<String> adapterTemp = new ArrayAdapter<>(MainActivity.this, android.R.layout.simple_spinner_item, mSerialportList);
                    adapterTemp.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
                    spDeviceList.setAdapter(adapterTemp);

                    ArrayAdapter<String> adapterTemp2 = new ArrayAdapter<>(MainActivity.this, android.R.layout.simple_spinner_item, baud_rate_string);
                    adapterTemp2.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
                    spBaudRate.setAdapter(adapterTemp2);

                    ArrayAdapter<String> adapterTemp3 = new ArrayAdapter<>(MainActivity.this, android.R.layout.simple_spinner_item, serial_flow);
                    adapterTemp3.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
                    spFlowcontrol.setAdapter(adapterTemp3);
                } else if (connect_type_string[3].equals(sInfo)) {
                    llUSB.setVisibility(View.GONE);
                    llSerial.setVisibility(View.GONE);
                    llWifi.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {

            }
        });
    }

    @Override
    protected void initData() {
        mPrinter = PrinterAPI.getInstance();

        dataUtils = DataUtils.getInstance(this);
        connect_type_string = dataUtils.getStringArr(R.array.connect_type_string);
        mSerialportList = dataUtils.getStringArr(R.array.serial_port_list);
        baud_rate_string = dataUtils.getStringArr(R.array.baud_rate_string);
        baud_rate_int = dataUtils.getIntegerArr(R.array.baud_rate);
        serial_flow = dataUtils.getStringArr(R.array.serial_flow);


        ArrayAdapter<String> adapterTemp = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, connect_type_string);
        adapterTemp.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spConnectType.setAdapter(adapterTemp);
        initPermission();

        CrashUtils.init(Environment.getExternalStorageDirectory().toString() + File.separator + "icod" + File.separator);
    }

    @Override
    public void onClick(View v) {
        switch (v.getId()) {
            case R.id.btn_connect:
                onProgressRun("进行连接打印机操作..");
                funcPrinterConnect();
                break;
            case R.id.btn_disconnect:
                onProgressRun("进行断开打印机操作..");
                funcPrinterDisConnect();
                break;
            case R.id.tv_usb:
                Intent intent = new Intent(MainActivity.this, USBActivity.class);
                startActivity(intent);
                break;
            case R.id.btn_print_text:
                onProgressRun("进行打印文本操作..");
                funcPrintText();
                break;
            case R.id.btn_print_barcode:
                onProgressRun("进行打印条形码操作..");
                funcPrintBarCode();
                break;
            case R.id.btn_print_qrcode:
                onProgressRun("进行打印二维码操作..");
                funcPrintQrCode();
                break;
            case R.id.btn_print_image:
                onProgressRun("进行打印图片操作..");
                funcPrintImage();
                break;
            case R.id.btn_print_cashbox:
                onProgressRun("进行钱箱开启操作..");
                funcPrintCashBox();
                break;
            case R.id.btn_print_state:
                onProgressRun("进行状态查询操作..");
                funcPrintState();
                break;
            case R.id.btn_self_page:
//                onProgressRun("进行打印自检页操作..");
                funcTestPage();
                break;
            case R.id.btn_test_print:
                funcTestPrint();
                break;
        }
    }

    //usb 插拔监听
    private class UsbBroadCastReceiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            UsbDevice device = (UsbDevice) intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
            switch (intent.getAction()) {
                case UsbManager.ACTION_USB_DEVICE_ATTACHED:
                    // 当USB设备连接到USB总线时，在主机模式下发送此意图。
                    onToast("插入设备 vid:" + device.getVendorId() + "  pid:" + device.getProductId());
                    break;
                case UsbManager.ACTION_USB_DEVICE_DETACHED:
                    // 当USB设备在主机模式下脱离USB总线时发送此意图。
                    onToast("拔出设备 vid:" + device.getVendorId() + "  pid:" + device.getProductId());
                    break;
            }
        }

    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (data != null)
            if (resultCode == BluetoothActivity.RESULTCODE_CODE_INTENT && requestCode == REQUEST_CODE_INTENT) {
                // 蓝牙返回
                BluetoothDevice bluetoothDevice = data.getParcelableExtra("device");
                Log.d(TAG, "Device: " + bluetoothDevice.getName() + " - " + bluetoothDevice.getAddress());
                onProgressRun(getString(R.string.str_In_Operation));
                runnable = new Runnable() {
                    @Override
                    public void run() {
                        BluetoothAPI mBluetoothApi = new BluetoothAPI(MainActivity.this);
                        mBluetoothApi.checkDevice(bluetoothDevice.getAddress());
                        mBluetoothApi.setPin("0000");
                        int ret = mPrinter.connect(mBluetoothApi);

                        handler.obtainMessage(CONNECT_RETURN_CODE, ret).sendToTarget();
                    }
                };
                new Thread(runnable).start();
            }
    }

    public Handler handler = new Handler(new Handler.Callback() {
        @Override
        public boolean handleMessage(Message msg) {
            switch (msg.what) {
                case Constant.DISCONNECT_CODE:
                    printShowStr = getString(R.string.str_Connect_Cancel);
                    tvPrintShow.setText(printShowStr);
                    if ((Boolean) msg.obj) {
                        onDismissProgress();
                    }
                    break;
                case Constant.CONNECT_RETURN_CODE:
                    printShowStr =
                            (int) msg.obj == PrinterAPI.SUCCESS ? getString(R.string.str_Connect_Succeed) : getString(R.string.str_Connect_Fail) + "\n" +
                                    "code: " + (int) msg.obj;
                    tvPrintShow.setText(printShowStr);

                    onDismissProgress();
                    break;
                case Constant.CONNECT_ERROR_CODE:
                    tvPrintShow.setText("连接中发生参数错误!!");
                    onDismissProgress();
                    break;

                case Constant.EXECUTE_RESULT_CODE:
                    printShowStr = (int) msg.obj == PrinterAPI.SUCCESS ? getString(R.string.str_Func_Success) : getString(R.string.str_Func_Failed);
                    tvPrintShow.setText(printShowStr);

                    onDismissProgress();
                    break;
                case Constant.EXECUTE_ERROR_CODE:
                    tvPrintShow.setText("打印中发生未知错误!!");
                    onDismissProgress();
                    break;

                case Constant.TEXT_SHOW_CODE:
                    tvPrintShow.setText((String) msg.obj);

                    onDismissProgress();
                    break;

                case Constant.TOAST_CODE:
                    onToast(msg.obj);
                    break;
                case Constant.STATE_RESULT_CODE:
                    printShowStr = (int) msg.obj + ": " + StatusDescribe.getStatusDescribe((int) msg.obj);
                    tvPrintShow.setText(printShowStr);
                    onDismissProgress();
                    break;
            }
            return false;
        }
    });


    private void initPermission() {
        String[] permissionArray = new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE, Manifest.permission.READ_EXTERNAL_STORAGE, Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION};
        String[] noCheckPermissionArray = PermissionUtil.checkPermissions(this, permissionArray);
        if (noCheckPermissionArray != null && noCheckPermissionArray.length > 0) {
            PermissionUtil.applyPermission(this, noCheckPermissionArray);
        }
    }

    protected void onDestroy() {
        if (mUsbBroadCastReceiver != null)
            unregisterReceiver(mUsbBroadCastReceiver);
        mPrinter.disconnect();

        super.onDestroy();
    }
}
