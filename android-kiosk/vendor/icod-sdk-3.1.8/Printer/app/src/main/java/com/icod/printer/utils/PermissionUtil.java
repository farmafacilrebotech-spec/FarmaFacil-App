package com.icod.printer.utils;

import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.support.annotation.NonNull;
import android.support.v4.app.ActivityCompat;
import android.support.v4.content.ContextCompat;


import java.util.ArrayList;
import java.util.List;

/**
 * @User Administrator
 * @Date 2021-04-21 13:22
 */
public class PermissionUtil {
    private String TAG = "PermissionUtil";
    private static final int PERMISSION_REQUEST_CODE = 0xab;

    /**
     * 检查单个权限
     *
     * @param context
     * @return true = 已获得授权.
     * false = 未获得授权
     */
    public static boolean checkPermission(Context context, String permission) {
        int result = ContextCompat.checkSelfPermission(context, permission);
        if (result == PackageManager.PERMISSION_GRANTED) {
            return true;
        }
        return false;
    }

    /**
     * 检查一组权限
     *
     * @param context
     * @param permissionArray
     * @return 返回未授权的权限list, 如果返回null等于全部权限都已经被授予.
     */
    public static String[] checkPermissions(Context context, String[] permissionArray) {
        if (permissionArray == null || permissionArray.length == 0) {
            return null;
        }
        List<String> notPermissionList = new ArrayList<>();
        for (String permission : permissionArray) {
            int result = ContextCompat.checkSelfPermission(context, permission);
            if (result != PackageManager.PERMISSION_GRANTED) {
                notPermissionList.add(permission);
            }
        }
        if (notPermissionList.size() == 0) {
            return null;
        }
        return notPermissionList.toArray(new String[notPermissionList.size()]);
    }

    /**
     * 申请权限
     *
     * @param activity
     */
    public static void applyPermission(Activity activity, String[] permissionArray) {
        applyPermission(activity, permissionArray, PERMISSION_REQUEST_CODE);
    }

    /**
     * 申请权限
     *
     * @param activity
     */
    public static void applyPermission(Activity activity, String[] permissionArray, int designationRequestCode) {
        ActivityCompat.requestPermissions(activity, permissionArray, designationRequestCode);
    }

    /**
     * 处理申请权限返回后的结果,此方法使用默认requestCode > PERMISSION_REQUEST_CODE
     *
     * @param requestCode  返回code
     * @param permissions  申请权限
     * @param grantResults 权限申请结果
     * @return String[] == null : 1.requestCode不等于默认PERMISSION_REQUEST_CODE 2.权限申请未知错误 grantResults小于0
     * String[]长度等于0：全部权限都申请成功
     * String[]长度不等于0：未申请成功的权限
     */
    public static String[] handlerPermissionApplyResults(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        return handlerPermissionApplyResults(requestCode, PERMISSION_REQUEST_CODE, permissions, grantResults);
    }

    /**
     * 处理申请权限返回后的结果,此方法可以指定requestCode
     *
     * @param requestCode            返回code
     * @param designationRequestCode 你指定的返回code
     * @param permissions            申请权限
     * @param grantResults           权限申请结果
     * @return String[] == null : 1.requestCode不等于designationRequestCode 2.权限申请未知错误 grantResults小于0
     * String[]长度等于0：全部权限都申请成功
     * String[]长度不等于0：未申请成功的权限
     */
    public static String[] handlerPermissionApplyResults(int requestCode, int designationRequestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        return handlerResults(requestCode, designationRequestCode, permissions, grantResults);
    }

    private static String[] handlerResults(int requestCode, int designationRequestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        if (requestCode == designationRequestCode) {
            if (grantResults.length > 0) {
                List<String> notPermissionList = new ArrayList<>();
                for (int i = 0; i < grantResults.length; i++) {
                    int result = grantResults[i];
                    String permission = permissions[i];
                    if (result != PackageManager.PERMISSION_GRANTED) {
                        notPermissionList.add(permission);
                    }
                }
                if (!notPermissionList.isEmpty()) {
                    return notPermissionList.toArray(new String[notPermissionList.size()]);
                }
                return new String[0];

            } else {
                return null;
            }
        } else {
            return null;
        }
    }
}
