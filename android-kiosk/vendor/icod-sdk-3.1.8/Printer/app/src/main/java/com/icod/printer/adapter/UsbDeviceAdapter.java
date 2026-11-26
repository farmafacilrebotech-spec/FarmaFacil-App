package com.icod.printer.adapter;

import android.hardware.usb.UsbDevice;
import android.support.annotation.NonNull;
import android.support.v7.widget.RecyclerView;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import com.icod.printer.R;

import java.util.List;


/**
 * Create by 梦魇
 * Date: 2020/5/18
 */
public class UsbDeviceAdapter extends RecyclerView.Adapter<UsbDeviceAdapter.Holder> {
    private String TAG = "UsbDeviceAdapter";
    private List<UsbDevice> deviceList;
    private OnItemClick onItemClick;

    public UsbDeviceAdapter(List<UsbDevice> deviceList, OnItemClick onItemClick) {
        this.deviceList = deviceList;
        this.onItemClick = onItemClick;
    }

    @Override
    public int getItemCount() {
        return deviceList.size();
    }

    @Override
    public Holder onCreateViewHolder(@NonNull ViewGroup viewGroup, int i) {
        return new Holder(LayoutInflater.from(viewGroup.getContext()).inflate(R.layout.item_bluetooth_layout, viewGroup, false));
    }

    @Override
    public void onBindViewHolder(@NonNull Holder holder, int i) {
        UsbDevice device = deviceList.get(i);
        holder.name.setText(device.getDeviceName());
        holder.address.setText("vid=" + device.getVendorId() + "  pid=" + device.getProductId());

        holder.item.setOnClickListener(v -> {
            onItemClick.onItemClick(i);
        });
    }


    public interface OnItemClick {
        void onItemClick(int position);
    }

    class Holder extends RecyclerView.ViewHolder {
        private TextView name;
        private TextView address;
        private View item;

        Holder(View itemView) {
            super(itemView);
            name = (TextView) itemView.findViewById(R.id.name);
            address = (TextView) itemView.findViewById(R.id.address);
            item = itemView;
        }
    }
}
