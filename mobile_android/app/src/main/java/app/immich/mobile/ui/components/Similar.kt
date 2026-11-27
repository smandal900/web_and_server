package app.immich.mobile.ui.components

import android.util.Base64
import android.util.LruCache
import app.immich.mobile.data.AssetItem
import java.time.OffsetDateTime
import kotlin.math.abs

/**
 * "Similar photos" in the timeline: shots taken close together that also look alike share one tile. Display only,
 * nothing is changed on the server. The same rules as the web app (web/src/lib/similar.ts).
 */
object Similar {
    /** A photo joins a group when it was taken this close to the previous one of the group... */
    private const val GAP_MILLIS = 60_000L

    /** ...and differs this little from the group's first photo (mean per colour channel, 0-255, of the thumbhashes). */
    private const val MAX_DIFFERENCE = 30.0

    private class Pixels(val width: Int, val height: Int, val argb: IntArray)

    private val cache = LruCache<String, Pixels>(2000)

    private fun pixels(thumbhash: String?): Pixels? {
        if (thumbhash.isNullOrEmpty()) return null
        cache.get(thumbhash)?.let { return it }
        return runCatching {
            val bitmap = ThumbHash.decode(Base64.decode(thumbhash, Base64.DEFAULT))
            val argb = IntArray(bitmap.width * bitmap.height)
            bitmap.getPixels(argb, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
            Pixels(bitmap.width, bitmap.height, argb).also { cache.put(thumbhash, it) }
        }.getOrNull()
    }

    /** How different two pictures look; infinite when it cannot be told or their shapes differ. */
    private fun difference(a: String?, b: String?): Double {
        val x = pixels(a) ?: return Double.POSITIVE_INFINITY
        val y = pixels(b) ?: return Double.POSITIVE_INFINITY
        if (x.width != y.width || x.height != y.height) return Double.POSITIVE_INFINITY
        var sum = 0L
        for (i in x.argb.indices) {
            for (shift in intArrayOf(0, 8, 16)) sum += abs(((x.argb[i] shr shift) and 0xff) - ((y.argb[i] shr shift) and 0xff))
        }
        return sum.toDouble() / (x.argb.size * 3)
    }

    /** Videos, hand-made stacks and photos that are only on this phone (they have no thumbhash) keep their own tile. */
    private fun canGroup(a: AssetItem) = a.isImage && !a.isLocal && a.stackId == null && a.livePhotoVideoId == null

    private fun millis(a: AssetItem): Long? = a.createdAt?.let { runCatching { OffsetDateTime.parse(it).toInstant().toEpochMilli() }.getOrNull() }

    private fun belongs(first: AssetItem, previous: AssetItem, next: AssetItem): Boolean {
        if (!canGroup(previous) || !canGroup(next) || previous.ownerId != next.ownerId || dayOf(previous) != dayOf(next)) return false
        val before = millis(previous) ?: return false
        val after = millis(next) ?: return false
        // the pixels are compared last: it is the only costly test
        return abs(before - after) <= GAP_MILLIS && difference(first.thumbhash, next.thumbhash) <= MAX_DIFFERENCE
    }

    /** Splits [assets] (in timeline order) into runs of similar photos. Most runs hold one picture. */
    fun group(assets: List<AssetItem>): List<IntRange> {
        val groups = ArrayList<IntRange>()
        var start = 0
        for (i in 1..assets.size) {
            if (i < assets.size && belongs(assets[start], assets[i - 1], assets[i])) continue
            groups += start until i
            start = i
        }
        return groups
    }

    /** The picture shown for a group: a favorite if it has one, otherwise the first. */
    fun cover(assets: List<AssetItem>, group: IntRange): Int = group.firstOrNull { assets[it].isFavorite } ?: group.first
}
