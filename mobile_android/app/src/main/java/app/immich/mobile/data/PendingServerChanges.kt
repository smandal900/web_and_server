package app.immich.mobile.data

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import app.immich.mobile.ImmichApp
import app.immich.mobile.app
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex

/**
 * Changes of the server that could not be made yet because the phone was offline: moving photos to its trash after they
 * were deleted on the phone, and restoring them after they were restored from the bin of the phone. They are kept on
 * disk and sent as soon as the server answers again, also when the app is closed by then.
 *
 * One line per change, `kind TAB value`: `trash` and `restore` hold the id of a photo on the server, `restore-sum` the
 * checksum of a file of the phone whose id on the server is not known yet.
 */
class PendingServerChanges(private val app: ImmichApp) {
    private val lock = Any()
    private val flushing = Mutex()

    private fun lines(): List<String> = app.prefs.pendingServerText.lines().filter { it.isNotBlank() }

    val count: Int get() = synchronized(lock) { lines().size }

    fun trash(ids: Collection<String>) = add("trash", ids, cancels = "restore")

    fun restore(ids: Collection<String>) = add("restore", ids, cancels = "trash")

    fun restoreByChecksum(checksums: Collection<String>) = add("restore-sum", checksums, cancels = null)

    private fun add(kind: String, values: Collection<String>, cancels: String?) {
        if (values.isEmpty()) return
        synchronized(lock) {
            val all = lines().toMutableList()
            for (value in values) {
                // a change that was not sent yet and is undone now needs no request at all
                if (cancels != null && all.remove("$cancels\t$value")) continue
                val line = "$kind\t$value"
                if (line !in all) all += line
            }
            app.prefs.pendingServerText = all.joinToString("\n")
        }
        schedule()
    }

    private fun remove(done: List<String>) = synchronized(lock) {
        app.prefs.pendingServerText = lines().filter { it !in done }.joinToString("\n")
    }

    /** Asks Android to run the changes once there is a network, which also works after the app was closed. */
    private fun schedule() {
        runCatching {
            val request = OneTimeWorkRequestBuilder<PendingChangesWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(app).enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.REPLACE, request)
        }
    }

    /** Sends what is waiting. Returns true when nothing is left, false when the server could not be reached. */
    suspend fun flush(): Boolean {
        if (!app.session.isLoggedIn) return true
        if (!flushing.tryLock()) return false
        try {
            while (true) {
                val batch = synchronized(lock) {
                    val all = lines()
                    if (all.isEmpty()) return true
                    val kind = all.first().substringBefore('\t')
                    all.takeWhile { it.substringBefore('\t') == kind }.take(BATCH)
                }
                val kind = batch.first().substringBefore('\t')
                val values = batch.map { it.substringAfter('\t') }
                try {
                    send(kind, values)
                    AppLog.i("Pending", "Sent $kind for ${values.size} items to the server")
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    if (!isOffline(e)) {
                        AppLog.w("Pending", "The server refused $kind, dropping it", e)
                    } else {
                        AppLog.d("Pending", "The server is not reachable, $kind waits")
                        return false
                    }
                }
                remove(batch)
            }
        } finally {
            flushing.unlock()
        }
    }

    private suspend fun send(kind: String, values: List<String>) {
        when (kind) {
            "trash" -> app.api.trash(values)
            "restore" -> app.api.restore(values)
            "restore-sum" -> {
                val ids = app.api.bulkUploadCheck(values.map { BulkCheckItem(it, it) })
                    .filter { it.action != "accept" }.mapNotNull { it.assetId }
                if (ids.isNotEmpty()) app.api.restore(ids)
            }
        }
    }

    /** Tries the waiting changes whenever the phone gets a network. */
    fun watch() {
        val manager = app.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
        runCatching {
            manager.registerDefaultNetworkCallback(object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    app.appScope.launch {
                        if (count == 0) return@launch
                        runCatching { NetworkSwitcher.refresh(app) }
                        flush()
                    }
                }
            })
        }
    }

    companion object {
        private const val WORK_NAME = "pending-server-changes"
        private const val BATCH = 100
        private val TEMPORARY_CODES = setOf(401, 408, 429)

        /** No network, a server that is down, or a sign-in to renew: the request is worth repeating later. */
        fun isOffline(e: Exception) = e !is ApiException || e.code !in 400..499 || e.code in TEMPORARY_CODES
    }
}

class PendingChangesWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result =
        if (applicationContext.app.pending.flush()) Result.success() else Result.retry()
}
