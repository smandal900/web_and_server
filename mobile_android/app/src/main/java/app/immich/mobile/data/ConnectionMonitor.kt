package app.immich.mobile.data

import android.app.Activity
import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.os.Bundle
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import app.immich.mobile.ImmichApp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Keeps track of whether the server can be reached. It belongs to the app, not to a screen, so it keeps going while
 * another tab or screen is open and while the app is minimized (for as long as Android keeps the process running). It
 * looks every few seconds, right away when Android says the network changed, and when the app comes to the front.
 */
class ConnectionMonitor(private val app: ImmichApp) {
    /** True while the last look found the server unreachable. Read from composition, so the screen follows it. */
    var serverUnreachable by mutableStateOf(false)
        private set

    private val lock = Mutex()

    fun start() {
        app.appScope.launch {
            while (true) {
                check()
                delay(INTERVAL_MS)
            }
        }
        val manager = app.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        runCatching {
            manager?.registerDefaultNetworkCallback(object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) = checkNow()

                override fun onLost(network: Network) = checkNow()
            })
        }
        app.registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
            override fun onActivityResumed(activity: Activity) = checkNow()
            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
            override fun onActivityStarted(activity: Activity) = Unit
            override fun onActivityPaused(activity: Activity) = Unit
            override fun onActivityStopped(activity: Activity) = Unit
            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
            override fun onActivityDestroyed(activity: Activity) = Unit
        })
    }

    /** Looks now, without waiting for the next round. */
    fun checkNow() {
        app.appScope.launch { check() }
    }

    private suspend fun check() {
        if (!app.session.isLoggedIn) {
            serverUnreachable = false
            return
        }
        // one look at a time: a network change can arrive while a look is already running
        lock.withLock {
            val reachable = app.api.isReachable()
            serverUnreachable = !reachable
            (app.source("timeline") as? TimelineSource)?.connectionChecked(reachable)
        }
    }

    private companion object {
        const val INTERVAL_MS = 4_000L
    }
}
