package app.immich.mobile.ui.components

import android.graphics.Bitmap
import android.util.Base64
import android.util.LruCache
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** Decodes the tiny blurred previews the server stores for every asset (https://evanw.github.io/thumbhash/). */
object ThumbHash {
    private val cache = LruCache<String, ImageBitmap>(512)
    private val failed = HashSet<String>()

    /** The placeholder for a base64 thumbhash, or null when the hash is missing or invalid. */
    fun placeholder(thumbhash: String?): ImageBitmap? {
        if (thumbhash.isNullOrEmpty()) return null
        cache.get(thumbhash)?.let { return it }
        if (thumbhash in failed) return null
        val decoded = runCatching { decode(Base64.decode(thumbhash, Base64.DEFAULT)) }.getOrNull()
        if (decoded == null) {
            failed += thumbhash
            return null
        }
        val image = decoded.asImageBitmap()
        cache.put(thumbhash, image)
        return image
    }

    fun decode(hash: ByteArray): Bitmap {
        require(hash.size >= 5) { "thumbhash too short" }
        fun b(i: Int) = hash[i].toInt() and 0xff

        val header24 = b(0) or (b(1) shl 8) or (b(2) shl 16)
        val header16 = b(3) or (b(4) shl 8)
        val lDc = (header24 and 63) / 63f
        val pDc = ((header24 shr 6) and 63) / 31.5f - 1f
        val qDc = ((header24 shr 12) and 63) / 31.5f - 1f
        val lScale = ((header24 shr 18) and 31) / 31f
        val hasAlpha = (header24 shr 23) != 0
        val pScale = ((header16 shr 3) and 63) / 63f
        val qScale = ((header16 shr 9) and 63) / 63f
        val isLandscape = (header16 shr 15) != 0
        val lx = max(3, if (isLandscape) (if (hasAlpha) 5 else 7) else header16 and 7)
        val ly = max(3, if (isLandscape) header16 and 7 else (if (hasAlpha) 5 else 7))
        val aDc = if (hasAlpha) (b(5) and 15) / 15f else 1f
        val aScale = (b(5) shr 4) / 15f

        val acStart = if (hasAlpha) 6 else 5
        var acIndex = 0
        fun channel(nx: Int, ny: Int, scale: Float): FloatArray {
            val out = ArrayList<Float>()
            for (cy in 0 until ny) {
                var cx = if (cy > 0) 0 else 1
                while (cx * ny < nx * (ny - cy)) {
                    val byte = b(acStart + (acIndex shr 1))
                    val nibble = (byte shr ((acIndex and 1) shl 2)) and 15
                    acIndex++
                    out += (nibble / 7.5f - 1f) * scale
                    cx++
                }
            }
            return out.toFloatArray()
        }

        val lAc = channel(lx, ly, lScale)
        val pAc = channel(3, 3, pScale * 1.25f)
        val qAc = channel(3, 3, qScale * 1.25f)
        val aAc = if (hasAlpha) channel(5, 5, aScale) else FloatArray(0)

        val ratio = lx.toFloat() / ly
        val w = (if (ratio > 1f) 32f else 32f * ratio).roundToInt().coerceAtLeast(1)
        val h = (if (ratio > 1f) 32f / ratio else 32f).roundToInt().coerceAtLeast(1)
        val pixels = IntArray(w * h)
        val fx = FloatArray(max(lx, if (hasAlpha) 5 else 3))
        val fy = FloatArray(max(ly, if (hasAlpha) 5 else 3))

        for (y in 0 until h) {
            for (x in 0 until w) {
                var l = lDc
                var p = pDc
                var q = qDc
                var a = aDc
                for (cx in fx.indices) fx[cx] = cos(PI.toFloat() / w * (x + 0.5f) * cx)
                for (cy in fy.indices) fy[cy] = cos(PI.toFloat() / h * (y + 0.5f) * cy)

                var j = 0
                for (cy in 0 until ly) {
                    var cx = if (cy > 0) 0 else 1
                    val fy2 = fy[cy] * 2f
                    while (cx * ly < lx * (ly - cy)) {
                        l += lAc[j] * fx[cx] * fy2
                        cx++
                        j++
                    }
                }
                j = 0
                for (cy in 0 until 3) {
                    var cx = if (cy > 0) 0 else 1
                    val fy2 = fy[cy] * 2f
                    while (cx < 3 - cy) {
                        val f = fx[cx] * fy2
                        p += pAc[j] * f
                        q += qAc[j] * f
                        cx++
                        j++
                    }
                }
                if (hasAlpha) {
                    j = 0
                    for (cy in 0 until 5) {
                        var cx = if (cy > 0) 0 else 1
                        val fy2 = fy[cy] * 2f
                        while (cx < 5 - cy) {
                            a += aAc[j] * fx[cx] * fy2
                            cx++
                            j++
                        }
                    }
                }

                val bl = l - 2f / 3f * p
                val r = (3f * l - bl + q) / 2f
                val g = r - q
                fun c(v: Float) = (255f * min(1f, max(0f, v))).roundToInt()
                pixels[y * w + x] = (c(a) shl 24) or (c(r) shl 16) or (c(g) shl 8) or c(bl)
            }
        }
        return Bitmap.createBitmap(pixels, w, h, Bitmap.Config.ARGB_8888)
    }
}
