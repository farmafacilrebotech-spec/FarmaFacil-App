package com.icod.printer.ui;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Handler;
import android.os.Message;
import android.support.v4.widget.SwipeRefreshLayout;
import android.support.v7.widget.DividerItemDecoration;
import android.support.v7.widget.LinearLayoutManager;
import android.support.v7.widget.RecyclerView;
import android.util.Log;
import android.view.View;
import android.widget.Button;

import com.icod.printer.R;
import com.icod.printer.adapter.BleAdapter;
import com.icod.printer.base.BaseActivity;
import com.icod.printer.entity.BluetoothBean;
import com.szsicod.print.io.BluetoothAPI;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Created by crf on 2020/5/19.
 */
public class BluetoothActivity extends BaseActivity  {
    private static final String TAG = "BluetoothActivity";
    public static final int EB_DIALOG = 10000;
    public static final int RESULTCODE_CODE_INTENT = 10003;

    // View
    private RecyclerView rcvBle;
    private SwipeRefreshLayout srlRefresh;
    private Button btnSearch;

    private BluetoothAdapter bluetoothAdapter;
    private List<BluetoothBean> bluetoothBeanList;
    private BleAdapter bleAdapter;

    @Override
    protected int getLayoutId() {
        return R.layout.bluetooth_main;
    }

    @Override
    protected void initView() {
        rcvBle = findViewById(R.id.rcv_Ble);
        srlRefresh = findViewById(R.id.srl_Refresh);
        btnSearch = findViewById(R.id.btn_Search);
        btnSearch.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                bluetoothSearch();
            }
        });

        LinearLayoutManager linearLayoutManager = new LinearLayoutManager(this);
        rcvBle.setLayoutManager(linearLayoutManager);
        rcvBle.addItemDecoration(new DividerItemDecoration(this, DividerItemDecoration.VERTICAL));
        bluetoothBeanList = new ArrayList<>();
        bleAdapter = new BleAdapter(bluetoothBeanList, new BleAdapter.OnItemClick() {
            @Override
            public void onItemClick(int position) {
                Intent intent = new Intent();
                intent.putExtra("device", bluetoothBeanList.get(position).getBluetoothDevice());
                setResult(RESULTCODE_CODE_INTENT, intent);
                finish();

//                connectThread = new ConnectThread(bluetoothBeanList.get(position).getBluetoothDevice(), bluetoothAdapter, mUIHandler);
//                connectThread.start();
            }
        });
        rcvBle.setAdapter(bleAdapter);
        srlRefresh.setOnRefreshListener(() ->
                bluetoothSearch()
        );
    }

    @Override
    protected void initData() {
        bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
        // 表示手机不支持蓝牙
        if (bluetoothAdapter == null)
            return;
        // 判断本机蓝牙是否打开
        if (!bluetoothAdapter.isEnabled())
            bluetoothAdapter.enable();

        IntentFilter intentFilter = new IntentFilter();
        intentFilter.addAction(BluetoothDevice.ACTION_FOUND);       // 发现远程设备
        intentFilter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);       // 扫描结束
        registerReceiver(bluetoothReceiver, intentFilter);//用BroadcastReceiver 来取得结果
    }

    private void bluetoothSearch() {
        // 获取已配对
        bluetoothBeanList.clear();
        Set<BluetoothDevice> devices = bluetoothAdapter.getBondedDevices();
        for (BluetoothDevice bluetoothDevice : devices)
            bluetoothBeanList.add(new BluetoothBean(bluetoothDevice, true));
        bleAdapter.notifyDataSetChanged();
        // 开始搜索
        btnSearch.setText(getString(R.string.btn_Search_Bluetooth_ing));
        if (bluetoothAdapter.isDiscovering())
            bluetoothAdapter.cancelDiscovery();
        bluetoothAdapter.startDiscovery();
    }

    private BroadcastReceiver bluetoothReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            switch (action) {
                case BluetoothDevice.ACTION_FOUND:
                    BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                    bluetoothBeanList.add(new BluetoothBean(device));
                    bleAdapter.notifyDataSetChanged();
                    if (srlRefresh.isRefreshing())
                        srlRefresh.setRefreshing(false);
                    break;
                case BluetoothAdapter.ACTION_DISCOVERY_FINISHED:
                    btnSearch.setText(getString(R.string.btn_Search_Bluetooth_end));
                    break;
            }
        }
    };

    protected void onDestroy() {
        super.onDestroy();
        if (bluetoothReceiver != null)
            unregisterReceiver(bluetoothReceiver);
    }

}
