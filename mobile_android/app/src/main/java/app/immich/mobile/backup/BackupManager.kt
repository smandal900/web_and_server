package app.immich.mobile.backup

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.edit
import androidx.work.BackoffPolicy
import androidx.work.CoroutineWorker
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.ForegroundInfo
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import app.immich.mobile.MainActivity
import app.immich.mobile.app
import app.immich.mobile.data.ApiException
import app.immich.mobile.data.AppLog
import app.immich.mobile.data.TimelineQuery
import app.immich.mobile.data.BulkCheckItem
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import java.io.File
import java.util.concurrent.TimeUnit

data class BackupUiState(
    val running: Boolean = false,
    val phase: String = "",
    val total: Int = 0,
    val done: Int = 0,
    val failed: Int = 0,
    val currentName: String? = null,
    val currentProgress: Float = 0f,
    val message: String? = null,
    val finishedAt: Long = 0,
)

class BackupSettings(context: Context) {
    private val prefs = context.getSharedPreferences("backup", Context.MODE_PRIVATE)

    var buckets: Set<String>
        get() = prefs.getStringSet(KEY_BUCKETS, emptySet()).orEmpty()
        set(value) = prefs.edit { putStringSet(KEY_BUCKETS, value) }

    /** Albums the user marked "excluded" (double tap on the album page); they are never in [buckets]. */
    var excludedBuckets: Set<String>
        get() = prefs.getStringSet(KEY_EXCLUDED, emptySet()).orEmpty()
        set(value) = prefs.edit { putStringSet(KEY_EXCLUDED, value) }

    /** Whether photos may be backed up over mobile data (Settings > Backup > Network Requirements). */
    var useCellularForPhotos: Boolean
        get() = prefs.getBoolean(KEY_CELLULAR_PHOTOS, false)
        set(value) = prefs.edit { putBoolean(KEY_CELLULAR_PHOTOS, value) }

    /** Whether videos may be backed up over mobile data. */
    var useCellularForVideos: Boolean
        get() = prefs.getBoolean(KEY_CELLULAR_VIDEOS, false)
        set(value) = prefs.edit { putBoolean(KEY_CELLULAR_VIDEOS, value) }

    /** The automatic backup only runs while the phone is charging. */
    var requireCharging: Boolean
        get() = prefs.getBoolean(KEY_CHARGING, false)
        set(value) = prefs.edit { putBoolean(KEY_CHARGING, value) }

    /** Seconds to wait before the automatic backup starts, one of 5, 30, 120 and 600. */
    var triggerDelay: Int
        get() = prefs.getInt(KEY_DELAY, 30)
        set(value) = prefs.edit { putInt(KEY_DELAY, value) }

    /** Put the backed up photos in an album on the server for every album of the device. */
    var syncAlbums: Boolean
        get() = prefs.getBoolean(KEY_SYNC_ALBUMS, false)
        set(value) = prefs.edit { putBoolean(KEY_SYNC_ALBUMS, value) }

    /**
     * "Wi-Fi only": nothing is backed up over mobile data, whatever the two cellular switches say (they keep their
     * values for when this is switched off). Until it is set once, it follows the cellular switches, so an
     * install that allowed mobile data before keeps doing so.
     */
    var wifiOnly: Boolean
        get() = if (prefs.contains(KEY_WIFI_ONLY)) prefs.getBoolean(KEY_WIFI_ONLY, true) else !(useCellularForPhotos || useCellularForVideos)
        set(value) = prefs.edit { putBoolean(KEY_WIFI_ONLY, value) }

    /** Photos may go over mobile data: Wi-Fi only is off and the photos switch is on. */
    val cellularPhotosAllowed: Boolean get() = !wifiOnly && useCellularForPhotos

    /** Videos may go over mobile data. */
    val cellularVideosAllowed: Boolean get() = !wifiOnly && useCellularForVideos

    /** Mobile data is not allowed for anything, so the backup needs an unmetered network. */
    val unmeteredOnly: Boolean get() = !cellularPhotosAllowed && !cellularVideosAllowed

    var includeVideos: Boolean
        get() = prefs.getBoolean(KEY_VIDEOS, true)
        set(value) = prefs.edit { putBoolean(KEY_VIDEOS, value) }

    /** Whether photos that are only on this device show up in the timeline. */
    var showDevicePhotos: Boolean
        get() = prefs.getBoolean(KEY_SHOW_LOCAL, true)
        set(value) = prefs.edit { putBoolean(KEY_SHOW_LOCAL, value) }

    var automatic: Boolean
        get() = prefs.getBoolean(KEY_AUTO, false)
        set(value) = prefs.edit { putBoolean(KEY_AUTO, value) }

    private companion object {
        const val KEY_BUCKETS = "buckets"
        const val KEY_EXCLUDED = "excludedBuckets"
        const val KEY_CELLULAR_PHOTOS = "cellularPhotos"
        const val KEY_CELLULAR_VIDEOS = "cellularVideos"
        const val KEY_WIFI_ONLY = "wifiOnly"
        const val KEY_CHARGING = "requireCharging"
        const val KEY_DELAY = "triggerDelay"
        const val KEY_SYNC_ALBUMS = "syncAlbums"
        const val KEY_VIDEOS = "videos"
        const val KEY_AUTO = "automatic"
        const val KEY_SHOW_LOCAL = "showDevicePhotos"
    }
}

@Serializable
private data class LocalState(
    val checksum: String,
    val uploaded: Boolean = false,
    val checked: Boolean = false,
    /** The id of the same file on the server, once it is known. */
    val assetId: String? = null,
)

/** Runs the backup and tells the UI how it is going. The work itself runs in [BackupWorker]. */
class BackupManager(private val context: Context) {
    val settings = BackupSettings(context)

    private val _state = MutableStateFlow(BackupUiState())
    val state: StateFlow<BackupUiState> = _state

    private val stateFile = File(context.filesDir, "backup_state.json")
    private val stateSerializer = MapSerializer(String.serializer(), LocalState.serializer())
    private val stateLock = Mutex()
    private var known: MutableMap<String, LocalState>? = null

    private val uploader by lazy { Uploader(context.app.api) }

    init {
        if (Build.VERSION.SDK_INT >= 26) {
            val manager = context.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL, "Backup", NotificationManager.IMPORTANCE_LOW),
            )
        }
    }

    private fun constraints() = Constraints.Builder()
        .setRequiredNetworkType(if (settings.unmeteredOnly) NetworkType.UNMETERED else NetworkType.CONNECTED)
        .build()

    /**
     * Starts a backup now. With [force] the run does not trust what it remembers about earlier uploads: every selected
     * photo and video is asked about on the server again, and the ones the server does not have are uploaded. A run
     * that is already queued or running is replaced by it.
     */
    fun start(force: Boolean = false) {
        val request = OneTimeWorkRequestBuilder<BackupWorker>()
            .setConstraints(constraints())
            .setBackoffCriteria(BackoffPolicy.LINEAR, 30, TimeUnit.SECONDS)
            .setInputData(androidx.work.workDataOf(KEY_FORCE to force))
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(WORK_NAME, if (force) ExistingWorkPolicy.REPLACE else ExistingWorkPolicy.KEEP, request)
        _state.update { it.copy(running = true, phase = "Waiting for a connection", message = null) }
    }

    fun cancel() {
        WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        WorkManager.getInstance(context).cancelUniqueWork(PERIODIC_NAME)
        _state.update { it.copy(running = false) }
    }

    fun applyAutomatic() {
        val work = WorkManager.getInstance(context)
        if (settings.automatic) {
            val request = PeriodicWorkRequestBuilder<BackupWorker>(6, TimeUnit.HOURS)
                .setInitialDelay(settings.triggerDelay.toLong(), TimeUnit.SECONDS)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(if (settings.unmeteredOnly) NetworkType.UNMETERED else NetworkType.CONNECTED)
                        .setRequiresBatteryNotLow(true)
                        .setRequiresCharging(settings.requireCharging)
                        .build(),
                )
                .build()
            work.enqueueUniquePeriodicWork(PERIODIC_NAME, ExistingPeriodicWorkPolicy.UPDATE, request)
        } else {
            work.cancelUniqueWork(PERIODIC_NAME)
        }
    }

    /** How many of the selected photos and videos are not on the server yet, as far as is known locally. */
    suspend fun pendingCount(): Int = withContext(Dispatchers.IO) {
        if (!LocalMedia.hasPermission(context)) return@withContext 0
        val states = loadState()
        selectedAssets().count { states[it.cacheKey]?.uploaded != true }
    }

    private fun selectedAssets(): List<LocalAsset> {
        val all = LocalMedia.query(context, settings.buckets)
        val chosen = if (settings.includeVideos) all else all.filterNot { it.isVideo }
        // on mobile data only the kinds of files the user allowed there are sent
        val manager = context.getSystemService(android.net.ConnectivityManager::class.java)
        if (manager?.isActiveNetworkMetered != true) return chosen
        return chosen.filter { if (it.isVideo) settings.cellularVideosAllowed else settings.cellularPhotosAllowed }
    }

    private var albumIds: MutableMap<String, String>? = null

    /** The id of the server album with this name, created when it does not exist yet. */
    private suspend fun serverAlbum(name: String): String {
        val api = context.app.api
        val known = albumIds ?: api.albums().associate { it.albumName to it.id }.toMutableMap().also { albumIds = it }
        return known.getOrPut(name) { api.createAlbum(name).id }
    }

    /** Adds the given server assets to the album that has the name of their device album. */
    suspend fun addToServerAlbum(albumName: String, assetIds: List<String>) {
        if (assetIds.isEmpty()) return
        context.app.api.addToAlbums(listOf(serverAlbum(albumName)), assetIds)
    }

    /**
     * Puts the photos that are on the server already into albums named like the device albums
     * (Settings > Backup > Organize into albums). Returns how many photos were added.
     */
    suspend fun organizeIntoAlbums(): Int {
        val states = loadState()
        val wanted = withContext(Dispatchers.IO) { LocalMedia.query(context, settings.buckets) }
            .filter { states[it.cacheKey]?.uploaded == true && states[it.cacheKey]?.checksum != null }
        var added = 0
        for (batch in wanted.chunked(CHECK_BATCH)) {
            val results = context.app.api
                .bulkUploadCheck(batch.map { BulkCheckItem(it.cacheKey, states.getValue(it.cacheKey).checksum) })
                .associateBy { it.id }
            val byAlbum = batch.groupBy { it.bucketName }
            for ((album, assets) in byAlbum) {
                val ids = assets.mapNotNull { results[it.cacheKey]?.assetId }
                addToServerAlbum(album, ids)
                added += ids.size
            }
        }
        return added
    }

    /**
     * Settings > Advanced > Sync remote deletions: a photo that was moved to the trash on the server is moved to the
     * trash of the phone too, and put back when it is restored. Needs the media management access of Android 12.
     * Returns how many device photos were changed.
     */
    suspend fun syncRemoteDeletions(): Int {
        val app = context.app
        if (!app.prefs.syncRemoteDeletions || Build.VERSION.SDK_INT < 31 || !android.provider.MediaStore.canManageMedia(context)) return 0
        val api = app.api
        val trashedOnServer = HashSet<String>()
        val query = TimelineQuery(isTrashed = true)
        for (bucket in api.timelineBuckets(query)) {
            api.timelineBucket(query, bucket.timeBucket).forEach { trashedOnServer += it.id }
        }
        var changed = 0
        val resolver = context.contentResolver
        val recorded = app.prefs.syncTrashedText.lines().filter { it.isNotBlank() }.map { it.split('\t') }.filter { it.size == 3 }.toMutableList()

        // 1. trashed on the server, still on the phone
        for (asset in _local.value.assets) {
            val remote = _local.value.remoteIds[asset.cacheKey] ?: continue
            if (remote !in trashedOnServer || recorded.any { it[0] == asset.cacheKey }) continue
            try {
                val values = android.content.ContentValues().apply { put(android.provider.MediaStore.MediaColumns.IS_TRASHED, 1) }
                if (resolver.update(asset.uri, values, null, null) > 0) {
                    recorded += listOf(asset.cacheKey, remote, asset.uri.toString())
                    changed++
                    AppLog.i("SyncDeletions", "Moved ${asset.name} to the trash of the phone")
                }
            } catch (e: Exception) {
                AppLog.w("SyncDeletions", "Could not trash ${asset.name}", e)
            }
        }

        // 2. restored on the server, still in the trash of the phone
        val iterator = recorded.iterator()
        while (iterator.hasNext()) {
            val (_, remote, uri) = iterator.next()
            if (remote in trashedOnServer) continue
            val stillThere = runCatching { api.asset(remote) }.getOrNull()
            if (stillThere == null) {
                iterator.remove() // deleted for good on the server, the phone keeps it in the trash
                continue
            }
            try {
                val target = android.net.Uri.parse(uri)
                val values = android.content.ContentValues().apply { put(android.provider.MediaStore.MediaColumns.IS_TRASHED, 0) }
                val args = android.os.Bundle().apply {
                    putInt(android.provider.MediaStore.QUERY_ARG_MATCH_TRASHED, android.provider.MediaStore.MATCH_INCLUDE)
                }
                if (resolver.update(target, values, args) > 0) {
                    iterator.remove()
                    changed++
                    AppLog.i("SyncDeletions", "Restored a photo on the phone")
                }
            } catch (e: Exception) {
                AppLog.w("SyncDeletions", "Could not restore a photo", e)
            }
        }
        app.prefs.syncTrashedText = recorded.joinToString("\n") { it.joinToString("\t") }
        if (changed > 0) scanDevice()
        return changed
    }

    /** Forgets the checksums of the device photos, so the next scan reads them all again. */
    suspend fun resetLocalData() {
        stateLock.withLock { known = mutableMapOf() }
        withContext(Dispatchers.IO) { stateFile.delete() }
        publishLocal(emptyList(), emptyMap(), scanning = false)
    }

    /** Reads the gallery without hashing anything (Settings > Sync Status > Sync Local). */
    suspend fun refreshDeviceList() {
        if (!LocalMedia.hasPermission(context)) return
        val states = loadState()
        val assets = withContext(Dispatchers.IO) { LocalMedia.query(context, null) }
        publishLocal(assets, states, scanning = false)
    }

    private suspend fun loadState(): MutableMap<String, LocalState> = stateLock.withLock {
        known ?: (try {
            if (stateFile.exists()) {
                Json.decodeFromString(stateSerializer, stateFile.readText()).toMutableMap()
            } else {
                mutableMapOf()
            }
        } catch (_: Exception) {
            mutableMapOf()
        }).also { known = it }
    }

    private suspend fun saveState() = stateLock.withLock {
        val snapshot = known ?: return@withLock
        withContext(Dispatchers.IO) {
            val temp = File(stateFile.parentFile, "backup_state.tmp")
            temp.writeText(Json.encodeToString(stateSerializer, HashMap(snapshot)))
            temp.renameTo(stateFile)
        }
    }

    /**
     * Only one backup runs at a time. Turning backup on starts a run now and schedules the periodic one, and the
     * periodic one is also rescheduled whenever a backup setting changes, so two runs used to overlap and upload the
     * same files in parallel. The later run waits, then finds everything uploaded and has little left to do.
     */
    private val runLock = Mutex()

    /** Hashes, checks and uploads everything selected that the server does not have. Returns false to retry later. */
    suspend fun run(force: Boolean = false, reportForeground: suspend (Notification) -> Unit): Boolean =
        runLock.withLock { runLocked(force, reportForeground) }

    private suspend fun runLocked(force: Boolean, reportForeground: suspend (Notification) -> Unit): Boolean {
        val app = context.app
        if (!app.session.isLoggedIn) return true
        if (!LocalMedia.hasPermission(context)) {
            _state.value = BackupUiState(message = "Allow access to photos and videos to back them up")
            return true
        }
        // without it Android gives the app copies with the location removed, and they would be uploaded like that
        if (!LocalMedia.hasLocationAccess(context)) {
            AppLog.w("Backup", "Backup not started: the Media location permission is missing")
            _state.value = BackupUiState(message = LocalMedia.LOCATION_PERMISSION_MESSAGE)
            return true
        }
        if (settings.buckets.isEmpty()) {
            _state.value = BackupUiState(message = "Choose the albums to back up first")
            return true
        }

        _state.value = BackupUiState(running = true, phase = if (force) "Comparing with the server" else "Looking for new photos")
        AppLog.i("Backup", if (force) "Forced backup started" else "Backup started")
        var lastNotification = 0L
        suspend fun publish(update: (BackupUiState) -> BackupUiState) {
            val next = update(_state.value)
            _state.value = next
            val now = System.currentTimeMillis()
            if (now - lastNotification > 1000) {
                lastNotification = now
                reportForeground(notification(next))
            }
        }

        try {
            reportForeground(notification(_state.value))
            val states = loadState()
            val assets = withContext(Dispatchers.IO) { selectedAssets() }
            // a forced run asks the server about everything, so a photo that was deleted there is sent again
            val fresh = if (force) assets else assets.filter { states[it.cacheKey]?.uploaded != true }

            // The files are dealt with in small batches: checksums, then what the server lacks, then the upload of what it
            // lacks, and only then the next batch. The first upload starts after the first batch, not after every
            // selected file was read, which takes very long when thousands of files are selected.
            var settled = 0 // files of the albums that are on the server by now, or were skipped
            var needed = 0 // files the server did not have
            var failed = 0
            var temporaryFailure = false
            // the bar only ever moves forward, although a batch first counts checked files and then uploaded ones
            fun forward(done: Int) = maxOf(_state.value.done, minOf(done, fresh.size))
            publish { it.copy(phase = "Checking", total = fresh.size, done = 0, failed = 0, currentName = null, currentProgress = 0f) }
            for (batch in fresh.chunked(PIPELINE_BATCH)) {
                // 1. checksums, the server tells from them what it already has
                val hashed = ArrayList<Pair<LocalAsset, String>>()
                for ((index, asset) in batch.withIndex()) {
                    val cached = states[asset.cacheKey]?.checksum
                    val checksum = cached ?: try {
                        withContext(Dispatchers.IO) { LocalMedia.sha1(context, asset) }.also {
                            states[asset.cacheKey] = LocalState(it)
                        }
                    } catch (e: CancellationException) {
                        throw e
                    } catch (_: Exception) {
                        continue
                    }
                    hashed += asset to checksum
                    if (index % 10 == 0) publish { it.copy(phase = "Checking", done = forward(settled + index), currentName = asset.name, currentProgress = 0f) }
                }
                saveState()

                // 2. what is missing on the server
                val missing = ArrayList<Pair<LocalAsset, String>>()
                if (hashed.isNotEmpty()) {
                    val results = app.api.bulkUploadCheck(hashed.map { (asset, sum) -> BulkCheckItem(asset.cacheKey, sum) })
                        .associateBy { it.id }
                    for ((asset, sum) in hashed) {
                        val result = results[asset.cacheKey]
                        if (result == null || result.action == "accept") {
                            missing += asset to sum
                            states[asset.cacheKey] = LocalState(sum, uploaded = false, checked = true)
                        } else {
                            states[asset.cacheKey] = LocalState(sum, uploaded = true, checked = true, assetId = result.assetId)
                        }
                    }
                }
                saveState()
                // the grids of the app learn at once which photos the server has
                publishLocal(_local.value.assets, states, scanning = false)

                // 3. upload what the server lacks from this batch
                needed += missing.size
                val alreadyThere = batch.size - missing.size
                if (missing.isNotEmpty()) publish { it.copy(phase = "Uploading", done = forward(settled + alreadyThere), currentName = null, currentProgress = 0f) }
                for ((index, pair) in missing.withIndex()) {
                    val (asset, checksum) = pair
                    publish { it.copy(phase = "Uploading", done = forward(settled + alreadyThere + index), currentName = asset.name, currentProgress = 0f) }
                    try {
                        var lastProgressNotice = 0L
                        val serverId = uploader.upload(context, asset, checksum) { progress ->
                            _state.update { it.copy(currentProgress = progress) }
                            // the percentage of the file being sent moves the notification too, twice a second at most
                            val now = System.currentTimeMillis()
                            if (now - lastProgressNotice > 500) {
                                lastProgressNotice = now
                                context.getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification(_state.value))
                            }
                        }
                        states[asset.cacheKey] = LocalState(checksum, uploaded = true, checked = true, assetId = serverId)
                        // Settings > Backup > Sync albums: the photo also goes in the album of its device folder
                        if (settings.syncAlbums && serverId != null) {
                            runCatching { addToServerAlbum(asset.bucketName, listOf(serverId)) }
                        }
                    } catch (e: CancellationException) {
                        saveState()
                        throw e
                    } catch (e: ApiException) {
                        if (e.code == 401) {
                            saveState()
                            _state.value = BackupUiState(message = "Signed out, sign in again to continue the backup")
                            return true
                        }
                        failed++
                        if (e.code >= 500) temporaryFailure = true
                        publish { it.copy(failed = failed, message = e.message) }
                    } catch (e: Exception) {
                        failed++
                        temporaryFailure = true
                        publish { it.copy(failed = failed, message = e.message) }
                    }
                    if (index % 5 == 0) saveState()
                }
                saveState()
                settled += batch.size
                publish { it.copy(phase = "Checking", done = forward(settled), currentName = null, currentProgress = 0f) }
            }

            publishLocal(_local.value.assets, states, scanning = false)
            val uploaded = needed - failed
            AppLog.i("Backup", "Backup finished: $uploaded uploaded, $failed failed")
            runCatching { syncRemoteDeletions() }
            _state.value = BackupUiState(
                phase = "Done",
                total = needed,
                done = uploaded,
                failed = failed,
                message = if (failed > 0) "$failed could not be uploaded" else null,
                finishedAt = System.currentTimeMillis(),
            )
            return !temporaryFailure
        } catch (e: CancellationException) {
            _state.update { it.copy(running = false, phase = "Stopped") }
            throw e
        } catch (e: Exception) {
            AppLog.e("Backup", "Backup failed", e)
            _state.value = BackupUiState(message = e.message ?: "Backup failed")
            return false
        }
    }


    // ---- The photos of this device next to the ones on the server -------------------------------------------------------

    /** Everything on the device and what is known about it: [backedUp] and [checked] hold [LocalAsset.cacheKey]s. */
    data class LocalSnapshot(
        val assets: List<LocalAsset> = emptyList(),
        val backedUp: Set<String> = emptySet(),
        val checked: Set<String> = emptySet(),
        /** For the photos the server has: the id of the photo on the server. */
        val remoteIds: Map<String, String> = emptyMap(),
        val scanning: Boolean = false,
        val done: Int = 0,
        val total: Int = 0,
    ) {
        /** Device photos the server does not have, newest first. */
        val localOnly: List<LocalAsset> by lazy { assets.filter { it.cacheKey in checked && it.cacheKey !in backedUp } }

        /**
         * The device photos the timeline mixes in: only the ones of the albums picked for the backup. While no album
         * is picked nothing of this device is shown, the timeline then has the photos of the server only.
         */
        fun timelineItems(pickedAlbums: Set<String>): List<app.immich.mobile.data.AssetItem> {
            if (pickedAlbums.isEmpty()) return emptyList()
            // asked once per month of the timeline, so the last answer is kept
            pickedCache?.let { (albums, items) -> if (albums == pickedAlbums) return items }
            return localOnly.filter { it.bucketId in pickedAlbums }.map { it.toItem(backedUp = false) }
                .also { pickedCache = pickedAlbums to it }
        }

        private var pickedCache: Pair<Set<String>, List<app.immich.mobile.data.AssetItem>>? = null

        /**
         * What the timeline shows while the server cannot be reached: every photo and video in the albums picked for
         * the backup, whether or not the server has it, because the server cannot supply its copy and the files were
         * never compared with it. Nothing while no album is picked.
         */
        fun offlineItems(pickedAlbums: Set<String>): List<app.immich.mobile.data.AssetItem> {
            if (pickedAlbums.isEmpty()) return emptyList()
            return assets.filter { it.bucketId in pickedAlbums }.map { asset ->
                val key = asset.cacheKey
                asset.toItem(backedUp = if (key in checked) key in backedUp else null, remoteId = remoteIds[key])
            }
        }
    }

    private val _local = MutableStateFlow(LocalSnapshot())
    val local: StateFlow<LocalSnapshot> = _local
    private val scanLock = Mutex()

    private fun publishLocal(assets: List<LocalAsset>, states: Map<String, LocalState>, scanning: Boolean, done: Int = 0, total: Int = 0) {
        _local.value = LocalSnapshot(
            assets = assets,
            backedUp = states.filterValues { it.uploaded }.keys,
            checked = states.filterValues { it.checked || it.uploaded }.keys,
            remoteIds = states.mapNotNull { (key, value) -> value.assetId?.let { key to it } }.toMap(),
            scanning = scanning,
            done = done,
            total = total,
        )
    }

    fun localAsset(item: app.immich.mobile.data.AssetItem): LocalAsset? =
        _local.value.assets.firstOrNull { "local:${it.cacheKey}" == item.id }

    /**
     * Reads the gallery, then works out which photos the server already has: new files are hashed and the checksums
     * are sent to the server. Photos that were checked before are not read again. Safe to call often.
     */
    suspend fun scanDevice() {
        if (!context.app.session.isLoggedIn || !LocalMedia.hasPermission(context)) return
        if (!scanLock.tryLock()) return
        AppLog.d("Scan", "Scanning the photos of this device")
        try {
            val states = loadState()
            val assets = withContext(Dispatchers.IO) { LocalMedia.query(context, null) }
            publishLocal(assets, states, scanning = true)

            // checksums of the redacted copies would never match the server, so nothing is hashed without the permission
            if (!LocalMedia.hasLocationAccess(context)) {
                publishLocal(assets, states, scanning = false)
                return
            }

            val unknown = assets.filter { val s = states[it.cacheKey]; s == null || (!s.checked && !s.uploaded) }
            if (unknown.isEmpty()) {
                publishLocal(assets, states, scanning = false)
                return
            }

            var done = 0
            for (batch in unknown.chunked(SCAN_BATCH)) {
                // A running backup reads and checks the files of the chosen albums itself. Doing the same work next to it
                // only slows both down (and the backup is the one that uploads), so the scan goes on once it is done.
                if (runLock.isLocked) {
                    publishLocal(assets, states, scanning = false)
                    return
                }
                val hashed = ArrayList<Pair<LocalAsset, String>>()
                for (asset in batch) {
                    val cached = states[asset.cacheKey]?.checksum
                    val checksum = cached ?: try {
                        withContext(Dispatchers.IO) { LocalMedia.sha1(context, asset) }
                    } catch (e: CancellationException) {
                        throw e
                    } catch (_: Exception) {
                        null
                    }
                    if (checksum != null) hashed += asset to checksum
                }
                val results = try {
                    context.app.api.bulkUploadCheck(hashed.map { (asset, sum) -> BulkCheckItem(asset.cacheKey, sum) })
                        .associateBy { it.id }
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) {
                    return // offline or signed out, try again the next time
                }
                for ((asset, sum) in hashed) {
                    val result = results[asset.cacheKey]
                    val exists = result != null && result.action != "accept"
                    states[asset.cacheKey] = LocalState(sum, uploaded = exists, checked = true, assetId = result?.assetId)
                }
                done += batch.size
                saveState()
                publishLocal(assets, states, scanning = true, done = done, total = unknown.size)
            }
            publishLocal(assets, states, scanning = false)
        } finally {
            _local.update { it.copy(scanning = false) }
            scanLock.unlock()
        }
    }

    /**
     * What identifies the given device files on the server, without asking the server (it may not be reachable). The
     * files may be in the bin of the phone and so are missing from [local]. Returns the ids on the server the backup
     * remembers, and the checksums of the files whose id is not known and that the server may have. Files that are
     * known not to be on the server give nothing.
     */
    suspend fun serverRefsOf(assets: List<LocalAsset>): Pair<List<String>, List<String>> {
        val states = loadState()
        val ids = LinkedHashSet<String>()
        val checksums = LinkedHashSet<String>()
        for (asset in assets) {
            val state = states[asset.cacheKey]
            val id = state?.assetId
            when {
                id != null -> ids += id
                state != null && state.checked && !state.uploaded -> {}
                else -> {
                    val checksum = state?.checksum ?: try {
                        withContext(Dispatchers.IO) { LocalMedia.sha1(context, asset) }
                    } catch (e: CancellationException) {
                        throw e
                    } catch (_: Exception) {
                        null
                    }
                    if (checksum != null) checksums += checksum
                }
            }
        }
        return ids.toList() to checksums.toList()
    }

    /** Uploads the given device photos right away. Returns how many could not be uploaded. */
    suspend fun uploadNow(assets: List<LocalAsset>, onProgress: (done: Int, total: Int) -> Unit = { _, _ -> }): Int {
        val app = context.app
        val states = loadState()
        var failed = 0
        for ((index, asset) in assets.withIndex()) {
            onProgress(index, assets.size)
            try {
                val checksum = states[asset.cacheKey]?.checksum
                    ?: withContext(Dispatchers.IO) { LocalMedia.sha1(context, asset) }
                val check = app.api.bulkUploadCheck(listOf(BulkCheckItem(asset.cacheKey, checksum))).firstOrNull()
                val serverId = if (check == null || check.action == "accept") uploader.upload(context, asset, checksum) { } else check.assetId
                states[asset.cacheKey] = LocalState(checksum, uploaded = true, checked = true, assetId = serverId)
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                failed++
            }
        }
        saveState()
        onProgress(assets.size, assets.size)
        publishLocal(_local.value.assets, states, scanning = false)
        return failed
    }

    /** Uploads files that another app shared with this one. Returns how many were not uploaded. */
    suspend fun uploadShared(assets: List<LocalAsset>, onProgress: (done: Int, total: Int) -> Unit): Int {
        var failed = 0
        for ((index, asset) in assets.withIndex()) {
            onProgress(index, assets.size)
            try {
                val checksum = withContext(Dispatchers.IO) { LocalMedia.sha1(context, asset) }
                val check = context.app.api.bulkUploadCheck(listOf(BulkCheckItem(asset.cacheKey, checksum))).firstOrNull()
                if (check == null || check.action == "accept") uploader.upload(context, asset, checksum) { }
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                failed++
            }
        }
        onProgress(assets.size, assets.size)
        return failed
    }
    /** What tapping the backup notification does: brings the app to the front, or starts it when it was closed. */
    private fun openAppIntent(): PendingIntent {
        val launch = Intent(context, MainActivity::class.java)
            .setAction(Intent.ACTION_MAIN)
            .addCategory(Intent.CATEGORY_LAUNCHER)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        return PendingIntent.getActivity(context, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

    private fun notification(state: BackupUiState): Notification {
        // while uploading, how much of the current file has been sent
        val percent = if (state.phase == "Uploading" && state.total > 0) (state.currentProgress * 100).toInt().coerceIn(0, 100) else null
        val summary = (if (state.total > 0) "${state.phase} · ${minOf(state.done + 1, state.total)}/${state.total}" else state.phase) +
            (percent?.let { " · $it%" } ?: "")
        val name = state.currentName
        val builder = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            // the collapsed notification of many phones shows only the title and the progress bar, so the file name is the title
            .setContentTitle(if (name.isNullOrBlank()) "Backing up" else name)
            .setSubText(if (name.isNullOrBlank()) null else if (percent != null) "$percent%" else "Backing up")
            .setContentText(summary)
            .setStyle(NotificationCompat.BigTextStyle().bigText(summary))
            .setContentIntent(openAppIntent())
            .setOngoing(true)
            .setOnlyAlertOnce(true)
        // the bar counts the files and moves a little inside the current one
        if (state.total > 0) builder.setProgress(state.total * 100, (state.done.coerceAtMost(state.total) * 100) + (percent ?: 0), false)
        else builder.setProgress(0, 0, true)
        return builder.build()
    }

    fun foregroundInfo(notification: Notification): ForegroundInfo =
        if (Build.VERSION.SDK_INT >= 29) {
            ForegroundInfo(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            ForegroundInfo(NOTIFICATION_ID, notification)
        }

    companion object {
        const val WORK_NAME = "backup"
        const val PERIODIC_NAME = "backup-periodic"
        private const val CHANNEL = "backup"
        private const val NOTIFICATION_ID = 1001
        private const val CHECK_BATCH = 200

        /** Files checked before their missing ones are uploaded: small, so the first upload starts soon. */
        private const val PIPELINE_BATCH = 100
        private const val SCAN_BATCH = 100
        const val KEY_FORCE = "force"
    }
}

class BackupWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val manager = applicationContext.app.backup
        val done = manager.run(force = inputData.getBoolean(BackupManager.KEY_FORCE, false)) { notification ->
            try {
                setForeground(manager.foregroundInfo(notification))
            } catch (_: CancellationException) {
                throw CancellationException()
            } catch (_: Exception) {
                // Android may refuse a foreground service when the work starts in the background, the backup still runs
            }
        }
        return if (done) Result.success() else Result.retry()
    }
}
