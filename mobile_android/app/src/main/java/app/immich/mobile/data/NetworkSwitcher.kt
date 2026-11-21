package app.immich.mobile.data

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.wifi.WifiManager
import androidx.core.content.ContextCompat
import app.immich.mobile.ImmichApp
import kotlinx.coroutines.launch

/**
 * Automatic endpoint switching (Settings > Networking): on the home Wi-Fi the local address is used, anywhere else the
 * external addresses are tried in order, and when none answers the address the user signed in with is kept.
 */
object NetworkSwitcher {
    /** The name of the Wi-Fi network the phone is on, or null when it is not on Wi-Fi or Android does not tell. */
    @Suppress("DEPRECATION")
    fun currentWifiName(context: Context): String? {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            return null
        }
        val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager ?: return null
        val name = wifi.connectionInfo?.ssid?.trim('"') ?: return null
        return name.takeUnless { it.isBlank() || it == WifiManager.UNKNOWN_SSID }
    }

    /** Chooses the address to use right now and tells the API client about it. */
    suspend fun refresh(app: ImmichApp) {
        val prefs = app.prefs
        if (!prefs.autoSwitchEndpoint || !app.session.isLoggedIn) {
            app.api.endpointOverride = null
            return
        }
        val candidates = buildList {
            val wifi = prefs.localWifiName
            if (wifi.isNotBlank() && prefs.localEndpoint.isNotBlank() && currentWifiName(app) == wifi) add(prefs.localEndpoint)
            addAll(prefs.externalEndpoints)
        }
        for (candidate in candidates) {
            val root = app.api.resolveServer(candidate)
            if (root != null) {
                app.api.endpointOverride = root.takeUnless { it == app.session.serverUrl }
                AppLog.i("Network", "Using the server at $root")
                return
            }
        }
        app.api.endpointOverride = null
    }

    /** Chooses again whenever the phone connects to another network. */
    fun watch(app: ImmichApp) {
        val manager = app.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
        runCatching {
            manager.registerDefaultNetworkCallback(object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    app.appScope.launch { refresh(app) }
                }
            })
        }
    }
}
