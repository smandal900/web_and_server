package app.immich.mobile

import android.app.Application
import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import app.immich.mobile.backup.BackupManager
import app.immich.mobile.data.AppLog
import app.immich.mobile.data.AppPrefs
import app.immich.mobile.data.ClientCert
import app.immich.mobile.data.ConnectionMonitor
import app.immich.mobile.data.AssetSource
import app.immich.mobile.data.ImmichApi
import app.immich.mobile.data.NetworkSwitcher
import app.immich.mobile.data.PendingServerChanges
import app.immich.mobile.data.SessionStore
import app.immich.mobile.data.TimelineQuery
import app.immich.mobile.data.TimelineSource
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.disk.DiskCache
import coil3.memory.MemoryCache
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.video.VideoFrameDecoder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import app.immich.mobile.data.finishOAuth
import okio.Path.Companion.toOkioPath

class ImmichApp : Application(), SingletonImageLoader.Factory {
    lateinit var session: SessionStore
        private set
    lateinit var api: ImmichApi
        private set
    lateinit var prefs: AppPrefs
        private set
    lateinit var backup: BackupManager
        private set
    lateinit var pending: PendingServerChanges
        private set
    lateinit var connection: ConnectionMonitor
        private set

    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    /** The memories of the photos tab, kept so the memory screen can move on to the next one. */
    var memories: List<app.immich.mobile.data.MemoryDto> = emptyList()

    /** The lists behind the open screens, so the viewer can page through the same assets a grid shows. */
    private val sources = HashMap<String, AssetSource>()

    override fun onCreate() {
        super.onCreate()
        session = SessionStore(this)
        prefs = AppPrefs(this)
        ClientCert.init(this)
        AppLog.init(this, prefs.logLevel)
        AppLog.i("App", "Started version ${BuildConfig.VERSION_NAME} on Android ${android.os.Build.VERSION.SDK_INT}")
        api = ImmichApi(session) { signOut() }
        backup = BackupManager(this)
        pending = PendingServerChanges(this)
        NetworkSwitcher.watch(this)
        pending.watch()
        connection = ConnectionMonitor(this).also { it.start() }
    }

    var oauthError by mutableStateOf<String?>(null)
    var oauthBusy by mutableStateOf(false)

    /** Files another app shared with this one, waiting to be uploaded. */
    var pendingShare by mutableStateOf<List<android.net.Uri>>(emptyList())

    /** A photo or video another app asked this one to open. */
    var pendingView by mutableStateOf<android.net.Uri?>(null)

    /** Finishes a login that was started in the browser, called with the address the browser sent the user back to. */
    fun completeOAuth(callbackUrl: String) {
        val pending = session.oauthPending
        if (pending.size < 3) {
            oauthError = "The sign-in was not started in this app"
            return
        }
        val (root, state, verifier) = pending
        val url = callbackUrl.replace("app.immich:/oauth-callback", "app.immich:///oauth-callback")
        appScope.launch {
            oauthBusy = true
            oauthError = null
            try {
                val login = api.finishOAuth(root, url, state, verifier)
                session.oauthPending = emptyList()
                session.setServer(root)
                session.signIn(login)
            } catch (e: Exception) {
                oauthError = e.message ?: "Unable to sign in"
            } finally {
                oauthBusy = false
            }
        }
    }

    fun signOut() {
        sources.clear()
        backup.cancel()
        api.endpointOverride = null
        session.signOut()
    }

    fun timeline(
        key: String,
        query: TimelineQuery,
        locals: (() -> List<app.immich.mobile.data.AssetItem>)? = null,
        offlineLocals: (() -> List<app.immich.mobile.data.AssetItem>)? = null,
    ): TimelineSource =
        sources.getOrPut(key) { TimelineSource(api, appScope, query, locals, offlineLocals) } as TimelineSource

    fun source(key: String): AssetSource? = sources[key]

    fun putSource(key: String, source: AssetSource) {
        sources[key] = source
    }

    fun dropSource(key: String) {
        sources.remove(key)
    }

    override fun newImageLoader(context: PlatformContext): ImageLoader = ImageLoader.Builder(context)
        .components {
            add(OkHttpNetworkFetcherFactory(callFactory = { api.client }))
            add(VideoFrameDecoder.Factory())
        }
        .memoryCache { MemoryCache.Builder().maxSizePercent(context, 0.25).build() }
        .diskCache {
            DiskCache.Builder()
                .directory(cacheDir.resolve("image_cache").toOkioPath())
                .maxSizeBytes(768L * 1024 * 1024)
                .build()
        }
        .build()
}

val Context.app: ImmichApp get() = applicationContext as ImmichApp
