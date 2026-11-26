package com.icod.printer.entity;

public class CheckBean implements Cloneable {
    private int vid;
    private int pid;

    public int getVid() {
        return vid;
    }

    public void setVid(int vid) {
        this.vid = vid;
    }

    public int getPid() {
        return pid;
    }

    public void setPid(int pid) {
        this.pid = pid;
    }

    public CheckBean(int vid, int pid) {
        this.vid = vid;
        this.pid = pid;
    }

    public CheckBean clone() throws CloneNotSupportedException {
        return (CheckBean) super.clone();
    }
}
