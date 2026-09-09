package com.mawariton.finanzas;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(IconSwitcherPlugin.class);
        super.onCreate(savedInstanceState);
    }
}