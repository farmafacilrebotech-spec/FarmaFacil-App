package com.icod.printer.adapter;

import android.annotation.SuppressLint;
import android.support.annotation.NonNull;
import android.support.v7.widget.RecyclerView;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import com.icod.printer.R;
import com.icod.printer.entity.BluetoothBean;

import java.util.List;


/**
 * Create by 梦魇
 * Date: 2020/5/18
 */
public class BleAdapter extends RecyclerView.Adapter<BleAdapter.Holder> {

    private List<BluetoothBean> bluetoothBeanList;
    private OnItemClick onItemClick;

    public BleAdapter(List<BluetoothBean> bluetoothBeanList, OnItemClick onItemClick) {
        this.bluetoothBeanList = bluetoothBeanList;
        this.onItemClick = onItemClick;
    }

    @NonNull
    @Override
    public Holder onCreateViewHolder(@NonNull ViewGroup viewGroup, int i) {
        return new Holder(LayoutInflater.from(viewGroup.getContext()).inflate(R.layout.item_bluetooth_layout, viewGroup, false));
    }

    @Override
    public void onBindViewHolder(@NonNull Holder holder, int i) {
        holder.name.setText(bluetoothBeanList.get(i).getBluetoothDevice().getName());
        holder.address.setText(bluetoothBeanList.get(i).getBluetoothDevice().getAddress());
        holder.item.setOnClickListener(v -> onItemClick.onItemClick(i));
    }

    @Override
    public int getItemCount() {
        return bluetoothBeanList.size();
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
