package com.icod.printer.base;

import android.app.ProgressDialog;
import android.os.Bundle;
import android.support.annotation.Nullable;
import android.support.v7.app.AppCompatActivity;
import android.widget.Toast;

import com.icod.printer.R;


/**
 * Create by 梦魇
 * Date: 2020/4/22
 */
public abstract class BaseActivity extends AppCompatActivity {
    private static final String TAG = "BaseActivity";

    public ProgressDialog progressDialog;

    @Override
    protected final void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(getLayoutId());

        // 控件数据初始化
        initView();
        initData();
    }

    /**
     * 获取布局id
     *
     * @return
     */
    protected abstract int getLayoutId();

    /**
     * 初始化控件
     */
    protected abstract void initView();

    /**
     * 初始化数据
     */
    protected abstract void initData();

    // 加载窗的弹出
    public void onProgressRun(String msg ) {
        progressDialog = new ProgressDialog(this);
        progressDialog.setTitle(getString(R.string.str_In_Operation));
        progressDialog.setMessage(msg);
        progressDialog.setProgressStyle(ProgressDialog.STYLE_SPINNER);
        progressDialog.setCancelable(false);
        progressDialog.show();
    }

    // 关闭加载窗
    public void onDismissProgress() {
        if (progressDialog != null && progressDialog.isShowing())
            progressDialog.dismiss();// 销毁对话框
    }

    // 吐司弹出
    public void onToast(Object msg) {
        Toast.makeText(getApplicationContext(), "" + msg, Toast.LENGTH_SHORT).show();
    }

}
