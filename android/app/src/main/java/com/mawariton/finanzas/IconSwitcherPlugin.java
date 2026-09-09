package com.mawariton.finanzas;

import android.content.ComponentName;
import android.content.pm.PackageManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "IconSwitcher")
public class IconSwitcherPlugin extends Plugin {

    private static final String[] ALIASES = {
            ".MainActivityCuarzo",
            ".MainActivityEsmeralda",
            ".MainActivityZafiro"
    };

    public void setTheme(PluginCall call) {
        String theme = call.getString("theme", "cuarzo");
        String pkg = getContext().getPackageName();
        String target = null;
        if ("esmeralda".equals(theme)) {
            target = pkg + ".MainActivityEsmeralda";
        } else if ("zafiro".equals(theme)) {
            target = pkg + ".MainActivityZafiro";
        } else {
            target = pkg + ".MainActivityCuarzo";
        }
        try {
            PackageManager pm = getContext().getPackageManager();
            pm.setComponentEnabledSetting(
                    new ComponentName(pkg, target),
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                    PackageManager.DONT_KILL_APP);
            for (String alias : ALIASES) {
                String component = pkg + alias;
                if (!component.equals(target)) {
                    pm.setComponentEnabledSetting(
                            new ComponentName(pkg, component),
                            PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                            PackageManager.DONT_KILL_APP);
                }
            }
            call.resolve(new JSObject().put("ok", true));
        } catch (Exception ex) {
            call.reject(ex.getMessage());
        }
    }
}