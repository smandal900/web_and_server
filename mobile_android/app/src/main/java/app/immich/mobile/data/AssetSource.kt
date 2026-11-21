package app.immich.mobile.data

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/**
 * An ordered list of assets that a grid shows and the viewer pages through. Reading [size] or calling [itemAt] from
 * composition makes the caller recompose when the data changes.
 */
abstract class AssetSource {
    abstract val size: Int

    /** The asset at [position], or null while it is still loading. Asking for it starts the loading. */
    abstract fun itemAt(position: Int): AssetItem?

    abstract fun remove(ids: Set<String>)

    abstract fun update(id: String, transform: (AssetItem) -> AssetItem)

    abstract suspend fun refresh()

    var isLoading by mutableStateOf(false)
        protected set

    var error by mutableStateOf<String?>(null)
        protected set
}

class TimelineBucket(
    val timeBucket: String,
    val count: Int,
    val assets: List<AssetItem>? = null,
    /** Identifies the device photos that were merged into this bucket, to notice when they change. */
    val localSig: Int = 0,
) {
    val size get() = assets?.size ?: count
}

/** Assets grouped in the time buckets of `GET /timeline/buckets`, each bucket loaded when it first scrolls into view. */
class TimelineSource(
    private val api: ImmichApi,
    private val scope: CoroutineScope,
    private val query: TimelineQuery,
    /** Photos that are only on this device, merged into the months they were taken in. */
    private var locals: (() -> List<AssetItem>)? = null,
    /** The device photos to show instead while the server cannot be reached, including the ones the server has. */
    private var offlineLocals: (() -> List<AssetItem>)? = null,
) : AssetSource() {
    /** The last request to the server failed, so only what is on this device can be shown. */
    var offline by mutableStateOf(false)
        private set

    private fun currentLocals(): List<AssetItem> {
        val whileOffline = offlineLocals
        return if (offline && whileOffline != null) whileOffline() else locals?.invoke().orEmpty()
    }

    /**
     * Changes where the device photos come from. The timeline is created once and kept, so when the phone's photos
     * become readable later (access was just given) or are switched off, the sources have to be replaced here.
     */
    fun useLocals(locals: (() -> List<AssetItem>)?, offlineLocals: (() -> List<AssetItem>)?) {
        val changed = (locals != null) != (this.locals != null)
        this.locals = locals
        this.offlineLocals = offlineLocals
        if (changed) rebuild()
    }

    var buckets by mutableStateOf<List<TimelineBucket>>(emptyList())
        private set

    private var offsets = IntArray(0)
    private val loading = HashSet<String>()

    override var size by mutableStateOf(0)
        private set

    init {
        scope.launch { refresh() }
    }

    /** The buckets the server reported, kept so the device photos can be merged again without asking the server. */
    private var serverBuckets: List<TimeBucketDto> = emptyList()

    override suspend fun refresh() {
        isLoading = true
        try {
            serverReached(api.timelineBuckets(query))
        } catch (e: Exception) {
            serverLost(e.message)
        } finally {
            isLoading = false
        }
    }

    private fun serverLost(message: String?) {
        // without the server the photos of the device can still be shown, all of them: the server's copies are out of reach
        if (locals != null) {
            offline = true
            serverBuckets = emptyList()
            loading.clear()
            rebuild()
        }
        error = message ?: "Unable to load the timeline"
    }

    private var failedChecks = 0

    /**
     * Told by the connection monitor, every few seconds, whether the server answered. Switches to the device photos
     * after two failed checks in a row (one lost request is not enough), and back to the server's timeline once it
     * answers again.
     */
    suspend fun connectionChecked(reachable: Boolean) {
        if (offline) {
            if (reachable) retryIfOffline()
            return
        }
        if (isLoading) return
        if (reachable) {
            failedChecks = 0
        } else if (++failedChecks >= 2) {
            failedChecks = 0
            serverLost("The server cannot be reached")
        }
    }

    private fun serverReached(reported: List<TimeBucketDto>) {
        serverBuckets = reported.filter { it.count > 0 }
        offline = false
        loading.clear()
        rebuild()
        error = null
    }

    /**
     * While [offline], asks the server again without any loading indicator, and switches back to the server's timeline
     * as soon as it answers. Does nothing while online.
     */
    suspend fun retryIfOffline() {
        if (!offline) return
        try {
            serverReached(api.timelineBuckets(query))
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (_: Exception) {
            // still unreachable, the next try follows
        }
    }

    /** Call when the list of device photos changed. */
    fun localsChanged() = rebuild()

    private fun rebuild() {
        val localByBucket = currentLocals().groupBy { monthKey(it.takenMillis) }
        val server = serverBuckets.associate { it.timeBucket to it.count }
        val keys = (server.keys + localByBucket.keys).sortedDescending()
        // keep the buckets that did not change, so the grid does not flash while it refreshes
        val previous = buckets.associateBy { it.timeBucket }
        applyBuckets(
            keys.map { key ->
                val localItems = localByBucket[key].orEmpty()
                val sig = localItems.fold(localItems.size) { acc, item -> acc * 31 + item.id.hashCode() }
                val count = (server[key] ?: 0) + localItems.size
                val old = previous[key]
                when {
                    old?.assets != null && old.count == count && old.localSig == sig -> old
                    server[key] == null -> TimelineBucket(key, count, mergeLocals(emptyList(), localItems), sig)
                    else -> TimelineBucket(key, count, null, sig)
                }
            },
        )
    }

    private fun localsOf(bucket: String): List<AssetItem> =
        currentLocals().filter { monthKey(it.takenMillis) == bucket }

    private fun mergeLocals(remote: List<AssetItem>, local: List<AssetItem>): List<AssetItem> {
        if (local.isEmpty()) return remote
        return (remote + local).sortedByDescending { if (it.isLocal) it.takenMillis else millisOf(it.createdAt) }
    }

    private fun millisOf(iso: String?): Long = iso?.let { runCatching { java.time.OffsetDateTime.parse(it).toInstant().toEpochMilli() }.getOrNull() } ?: 0L

    /** `2024-03-01T00:00:00.000Z`, the way the server names the bucket of a month. */
    private fun monthKey(millis: Long): String {
        val date = java.time.Instant.ofEpochMilli(millis).atZone(java.time.ZoneId.systemDefault()).toLocalDate()
        return "%04d-%02d-01T00:00:00.000Z".format(date.year, date.monthValue)
    }

    private fun applyBuckets(list: List<TimelineBucket>) {
        offsets = IntArray(list.size + 1)
        for (i in list.indices) offsets[i + 1] = offsets[i] + list[i].size
        buckets = list
        size = offsets[list.size]
    }

    /** The first position of the bucket at [bucketIndex]. */
    fun offsetOf(bucketIndex: Int): Int = offsets[bucketIndex]

    fun bucketIndexOf(position: Int): Int {
        var low = 0
        var high = buckets.size - 1
        while (low < high) {
            val mid = (low + high + 1) ushr 1
            if (offsets[mid] <= position) low = mid else high = mid - 1
        }
        return low
    }

    /** The bucket a grid item belongs to when every bucket is a header item followed by its assets. */
    fun bucketForGridItem(item: Int): Int {
        var low = 0
        var high = buckets.size - 1
        while (low < high) {
            val mid = (low + high + 1) ushr 1
            if (mid + offsets[mid] <= item) low = mid else high = mid - 1
        }
        return low.coerceAtLeast(0)
    }

    fun loadBucket(index: Int) {
        val bucket = buckets.getOrNull(index) ?: return
        if (bucket.assets != null || !loading.add(bucket.timeBucket)) return
        scope.launch {
            try {
                val localItems = localsOf(bucket.timeBucket)
                val assets = mergeLocals(api.timelineBucket(query, bucket.timeBucket), localItems)
                val current = buckets.indexOfFirst { it.timeBucket == bucket.timeBucket }
                if (current >= 0) {
                    val sig = localItems.fold(localItems.size) { acc, item -> acc * 31 + item.id.hashCode() }
                    applyBuckets(buckets.toMutableList().also { it[current] = TimelineBucket(bucket.timeBucket, assets.size, assets, sig) })
                }
            } catch (e: Exception) {
                error = e.message
            } finally {
                loading.remove(bucket.timeBucket)
            }
        }
    }

    override fun itemAt(position: Int): AssetItem? {
        if (position < 0 || position >= size) return null
        val index = bucketIndexOf(position)
        val bucket = buckets[index]
        val assets = bucket.assets
        if (assets == null) {
            loadBucket(index)
            return null
        }
        return assets.getOrNull(position - offsets[index])
    }

    override fun remove(ids: Set<String>) {
        applyBuckets(
            buckets.mapNotNull { bucket ->
                val assets = bucket.assets ?: return@mapNotNull bucket
                val kept = assets.filterNot { it.id in ids }
                when {
                    kept.size == assets.size -> bucket
                    kept.isEmpty() -> null
                    else -> TimelineBucket(bucket.timeBucket, kept.size, kept, bucket.localSig)
                }
            },
        )
    }

    override fun update(id: String, transform: (AssetItem) -> AssetItem) {
        applyBuckets(
            buckets.map { bucket ->
                val assets = bucket.assets
                if (assets == null || assets.none { it.id == id }) {
                    bucket
                } else {
                    TimelineBucket(bucket.timeBucket, bucket.count, assets.map { if (it.id == id) transform(it) else it }, bucket.localSig)
                }
            },
        )
    }
}

/** Assets of a paged search, the next page is requested when the end of the list comes into view. */
class PagedSource(
    private val scope: CoroutineScope,
    private val loadPage: suspend (page: Int) -> SearchAssets,
) : AssetSource() {
    private var items by mutableStateOf<List<AssetItem>>(emptyList())
    private var nextPage: Int? = 1
    private var loadingPage = false

    override val size: Int get() = items.size

    val hasMore: Boolean get() = nextPage != null

    var total by mutableStateOf(0)
        private set

    init {
        loadMore()
    }

    fun loadMore() {
        val page = nextPage ?: return
        if (loadingPage) return
        loadingPage = true
        isLoading = true
        scope.launch {
            try {
                val result = loadPage(page)
                items = items + result.items.map { it.toItem() }
                total = maxOf(result.total, items.size)
                nextPage = result.nextPage?.toIntOrNull()
                error = null
            } catch (e: Exception) {
                error = e.message ?: "Search failed"
                nextPage = null
            } finally {
                loadingPage = false
                isLoading = false
            }
        }
    }

    override fun itemAt(position: Int): AssetItem? = items.getOrNull(position)

    /** Starts the next page when [position] is close to the end of what is loaded. Call it from an effect. */
    fun loadMoreNear(position: Int) {
        if (position >= items.size - PREFETCH) loadMore()
    }

    override fun remove(ids: Set<String>) {
        items = items.filterNot { it.id in ids }
    }

    override fun update(id: String, transform: (AssetItem) -> AssetItem) {
        items = items.map { if (it.id == id) transform(it) else it }
    }

    override suspend fun refresh() {
        items = emptyList()
        nextPage = 1
        loadMore()
    }

    private companion object {
        const val PREFETCH = 30
    }
}

/** A fixed list, used for the assets of a memory. */
class ListSource(initial: List<AssetItem>) : AssetSource() {
    private var items by mutableStateOf(initial)

    override val size: Int get() = items.size

    fun replace(list: List<AssetItem>) {
        items = list
    }

    override fun itemAt(position: Int) = items.getOrNull(position)

    override fun remove(ids: Set<String>) {
        items = items.filterNot { it.id in ids }
    }

    override fun update(id: String, transform: (AssetItem) -> AssetItem) {
        items = items.map { if (it.id == id) transform(it) else it }
    }

    override suspend fun refresh() = Unit
}

/**
 * A list known only by asset ids, such as the photos on a part of the map. The details of an asset (is it a video,
 * its size) are fetched when it is first asked for, until then it shows as an image.
 */
class IdSource(
    private val api: ImmichApi,
    private val scope: CoroutineScope,
    ids: List<String>,
) : AssetSource() {
    private var items by mutableStateOf(ids.map { AssetItem(id = it, isImage = true) })
    private val requested = HashSet<String>()

    override val size: Int get() = items.size

    override fun itemAt(position: Int): AssetItem? {
        val item = items.getOrNull(position) ?: return null
        if (requested.add(item.id)) {
            scope.launch {
                runCatching { api.asset(item.id).toItem() }.onSuccess { full ->
                    items = items.map { if (it.id == full.id) full else it }
                }
            }
        }
        return item
    }

    override fun remove(ids: Set<String>) {
        items = items.filterNot { it.id in ids }
    }

    override fun update(id: String, transform: (AssetItem) -> AssetItem) {
        items = items.map { if (it.id == id) transform(it) else it }
    }

    override suspend fun refresh() = Unit
}
