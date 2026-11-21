package app.immich.mobile.backup

import android.content.ContentResolver
import android.content.ContentUris
import android.content.Context
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.core.content.ContextCompat
import android.Manifest
import android.content.pm.PackageManager
import java.io.InputStream
import java.security.MessageDigest

data class LocalAsset(
    val id: Long,
    val uri: Uri,
    val name: String,
    val mimeType: String,
    val size: Long,
    val takenAt: Long,
    val modifiedAt: Long,
    val isVideo: Boolean,
    val durationMs: Long,
    val bucketId: String,
    val bucketName: String,
    /** Marked as a favorite in the gallery of the phone (Android 11 and later). */
    val isFavorite: Boolean = false,
    /** Full path of the folder the file is in, for example `/storage/emulated/0/DCIM/Camera`. Empty when unknown. */
    val folder: String = "",
    /** When the phone empties the bin for good, in epoch milliseconds. Only set for files in the bin. */
    val expiresAt: Long = 0,
) {
    /** Lives in the folder of the camera app. */
    val isCamera get() = bucketName.equals("Camera", ignoreCase = true)

    /** Identifies this exact version of the file in the checksum cache. */
    val cacheKey get() = "${if (isVideo) "v" else "i"}$id:$modifiedAt:$size"
}

/** The original of a photo cannot be read because the "Media location" permission is missing. */
class OriginalNotAllowedException(cause: Throwable? = null) : java.io.IOException(LocalMedia.LOCATION_PERMISSION_MESSAGE, cause)

data class LocalAlbum(val id: String, val name: String, val count: Int, val videoCount: Int, val path: String = "")

object LocalMedia {
    fun hasPermission(context: Context): Boolean {
        fun granted(permission: String) =
            ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
        return if (Build.VERSION.SDK_INT >= 33) {
            granted(Manifest.permission.READ_MEDIA_IMAGES) || granted(Manifest.permission.READ_MEDIA_VIDEO)
        } else {
            granted(Manifest.permission.READ_EXTERNAL_STORAGE)
        }
    }

    fun permissions(): Array<String> = buildList {
        if (Build.VERSION.SDK_INT >= 33) {
            add(Manifest.permission.READ_MEDIA_IMAGES)
            add(Manifest.permission.READ_MEDIA_VIDEO)
            add(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            add(Manifest.permission.READ_EXTERNAL_STORAGE)
        }
        if (Build.VERSION.SDK_INT >= 29) add(Manifest.permission.ACCESS_MEDIA_LOCATION)
    }.toTypedArray()

    /** All photos and videos on the device, newest first, optionally limited to some albums (buckets). */
    fun query(context: Context, bucketIds: Set<String>? = null): List<LocalAsset> {
        val result = ArrayList<LocalAsset>()
        querySource(context.contentResolver, MediaStore.Images.Media.EXTERNAL_CONTENT_URI, false, bucketIds, result)
        querySource(context.contentResolver, MediaStore.Video.Media.EXTERNAL_CONTENT_URI, true, bucketIds, result)
        result.sortByDescending { it.takenAt }
        return result
    }

    /** The photos and videos in the bin of the phone (Android 11 and later), the ones deleted last first. */
    fun queryTrashed(context: Context): List<LocalAsset> {
        if (Build.VERSION.SDK_INT < 30) return emptyList()
        val result = ArrayList<LocalAsset>()
        querySource(context.contentResolver, MediaStore.Images.Media.EXTERNAL_CONTENT_URI, false, null, result, trashed = true)
        querySource(context.contentResolver, MediaStore.Video.Media.EXTERNAL_CONTENT_URI, true, null, result, trashed = true)
        result.sortByDescending { it.takenAt }
        return result
    }

    fun albums(context: Context): List<LocalAlbum> {
        val all = query(context)
        return all.groupBy { it.bucketId }
            .map { (id, assets) ->
                LocalAlbum(id, assets.first().bucketName, assets.size, assets.count { it.isVideo }, assets.firstNotNullOfOrNull { it.folder.ifEmpty { null } }.orEmpty())
            }
            .sortedWith(compareByDescending<LocalAlbum> { it.name == "Camera" }.thenByDescending { it.count })
    }

    private fun querySource(
        resolver: ContentResolver,
        collection: Uri,
        isVideo: Boolean,
        bucketIds: Set<String>?,
        into: MutableList<LocalAsset>,
        trashed: Boolean = false,
    ) {
        val projection = buildList {
            add(MediaStore.MediaColumns._ID)
            add(MediaStore.MediaColumns.DISPLAY_NAME)
            add(MediaStore.MediaColumns.MIME_TYPE)
            add(MediaStore.MediaColumns.SIZE)
            add(MediaStore.MediaColumns.DATE_TAKEN)
            add(MediaStore.MediaColumns.DATE_ADDED)
            add(MediaStore.MediaColumns.DATE_MODIFIED)
            add(MediaStore.MediaColumns.BUCKET_ID)
            add(MediaStore.MediaColumns.BUCKET_DISPLAY_NAME)
            @Suppress("DEPRECATION")
            add(MediaStore.MediaColumns.DATA)
            if (Build.VERSION.SDK_INT >= 29) add(MediaStore.MediaColumns.RELATIVE_PATH)
            if (isVideo) add(MediaStore.Video.Media.DURATION)
            if (Build.VERSION.SDK_INT >= 30) add(MediaStore.MediaColumns.IS_FAVORITE)
            if (trashed && Build.VERSION.SDK_INT >= 30) add(MediaStore.MediaColumns.DATE_EXPIRES)
        }.toTypedArray()

        val selection: String?
        val args: Array<String>?
        if (bucketIds != null) {
            if (bucketIds.isEmpty()) return
            selection = "${MediaStore.MediaColumns.BUCKET_ID} IN (${bucketIds.joinToString(",") { "?" }})"
            args = bucketIds.toTypedArray()
        } else {
            selection = null
            args = null
        }

        val rows = if (trashed) {
            val query = android.os.Bundle().apply { putInt(MediaStore.QUERY_ARG_MATCH_TRASHED, MediaStore.MATCH_ONLY) }
            resolver.query(collection, projection, query, null)
        } else {
            resolver.query(collection, projection, selection, args, null)
        }
        rows?.use { cursor ->
            val id = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID)
            val name = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME)
            val mime = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.MIME_TYPE)
            val size = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.SIZE)
            val taken = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_TAKEN)
            val added = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_ADDED)
            val modified = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_MODIFIED)
            val bucket = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.BUCKET_ID)
            val bucketName = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.BUCKET_DISPLAY_NAME)
            @Suppress("DEPRECATION")
            val data = cursor.getColumnIndex(MediaStore.MediaColumns.DATA)
            val relative = if (Build.VERSION.SDK_INT >= 29) cursor.getColumnIndex(MediaStore.MediaColumns.RELATIVE_PATH) else -1
            val duration = if (isVideo) cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DURATION) else -1
            val favorite = if (Build.VERSION.SDK_INT >= 30) cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.IS_FAVORITE) else -1
            val expires = if (trashed && Build.VERSION.SDK_INT >= 30) cursor.getColumnIndex(MediaStore.MediaColumns.DATE_EXPIRES) else -1

            while (cursor.moveToNext()) {
                val mediaId = cursor.getLong(id)
                val modifiedAt = cursor.getLong(modified) * 1000
                val takenAt = cursor.getLong(taken).takeIf { it > 0 } ?: (cursor.getLong(added) * 1000).takeIf { it > 0 } ?: modifiedAt
                into += LocalAsset(
                    id = mediaId,
                    uri = ContentUris.withAppendedId(collection, mediaId),
                    name = cursor.getString(name) ?: "$mediaId",
                    mimeType = cursor.getString(mime) ?: if (isVideo) "video/mp4" else "image/jpeg",
                    size = cursor.getLong(size),
                    takenAt = takenAt,
                    modifiedAt = modifiedAt,
                    isVideo = isVideo,
                    durationMs = if (duration >= 0) cursor.getLong(duration) else 0,
                    bucketId = cursor.getString(bucket) ?: "",
                    bucketName = cursor.getString(bucketName) ?: "Unknown",
                    isFavorite = favorite >= 0 && cursor.getInt(favorite) == 1,
                    folder = folderOf(
                        path = if (data >= 0) cursor.getString(data) else null,
                        relative = if (relative >= 0) cursor.getString(relative) else null,
                    ),
                    expiresAt = if (expires >= 0) cursor.getLong(expires) * 1000 else 0,
                )
            }
        }
    }

    /** The folder of a file: from its full path, or from the path relative to the storage root when that is hidden. */
    private fun folderOf(path: String?, relative: String?): String = when {
        !path.isNullOrEmpty() -> path.substringBeforeLast('/', "")
        !relative.isNullOrEmpty() -> "/storage/emulated/0/" + relative.trimEnd('/')
        else -> ""
    }

    /** How many photos and videos are in the trash of the phone (Android 11 and later). */
    fun trashedCount(context: Context): Int {
        if (Build.VERSION.SDK_INT < 30) return 0
        val args = android.os.Bundle().apply {
            putInt(MediaStore.QUERY_ARG_MATCH_TRASHED, MediaStore.MATCH_ONLY)
        }
        return listOf(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, MediaStore.Video.Media.EXTERNAL_CONTENT_URI).sumOf { collection ->
            runCatching {
                context.contentResolver.query(collection, arrayOf(MediaStore.MediaColumns._ID), args, null)?.use { it.count } ?: 0
            }.getOrDefault(0)
        }
    }

    /**
     * Opens the file exactly as it is on the phone, with its GPS data.
     *
     * From Android 10 the gallery hands out a copy with the location zeroed out unless the app holds
     * ACCESS_MEDIA_LOCATION and asks for the original. Uploading that copy would lose the location of the photo for
     * good, so there is no fallback to it: without the permission this fails with [OriginalNotAllowedException].
     */
    fun open(context: Context, asset: LocalAsset): InputStream {
        val resolver = context.contentResolver
        // files shared by other apps are not in the gallery and are never redacted
        if (Build.VERSION.SDK_INT >= 29 && asset.uri.authority == MediaStore.AUTHORITY) {
            val original = MediaStore.setRequireOriginal(asset.uri)
            try {
                return resolver.openInputStream(original) ?: error("Unable to open ${asset.name}")
            } catch (e: SecurityException) {
                throw OriginalNotAllowedException(e)
            }
        }
        return resolver.openInputStream(asset.uri) ?: error("Unable to open ${asset.name}")
    }

    /** Whether the app may read the files without Android removing their location. */
    fun hasOriginalAccess(context: Context): Boolean = hasPermission(context) && hasLocationAccess(context)

    /** The "Media location" permission, which Android requires to hand out the original of a photo or video. */
    fun hasLocationAccess(context: Context): Boolean =
        Build.VERSION.SDK_INT < 29 ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_MEDIA_LOCATION) == PackageManager.PERMISSION_GRANTED

    const val LOCATION_PERMISSION_MESSAGE =
        "Allow \"Media location\" so photos are backed up with their location. Without it Android removes the GPS data."

    fun sha1(context: Context, asset: LocalAsset): String {
        val digest = MessageDigest.getInstance("SHA-1")
        open(context, asset).use { input ->
            val buffer = ByteArray(128 * 1024)
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }
}

/** How a photo or video of this device shows up in the grids next to the ones on the server. */
fun LocalAsset.toItem(backedUp: Boolean?, remoteId: String? = null): app.immich.mobile.data.AssetItem = app.immich.mobile.data.AssetItem(
    id = "local:$cacheKey",
    isImage = !isVideo,
    durationMs = durationMs.takeIf { it > 0 }?.toInt(),
    createdAt = java.time.Instant.ofEpochMilli(takenAt).toString(),
    localUri = uri.toString(),
    backedUp = backedUp,
    remoteId = remoteId,
    takenMillis = takenAt,
)

/** Describes a file another app handed over, for example through the share sheet. */
fun LocalMedia.fromUri(context: Context, uri: Uri): LocalAsset {
    val resolver = context.contentResolver
    var name: String? = null
    var size = 0L
    runCatching {
        resolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME, android.provider.OpenableColumns.SIZE), null, null, null)
            ?.use { cursor ->
                if (cursor.moveToFirst()) {
                    name = cursor.getString(0)
                    size = if (cursor.isNull(1)) 0 else cursor.getLong(1)
                }
            }
    }
    val mime = resolver.getType(uri) ?: "application/octet-stream"
    val now = System.currentTimeMillis()
    val fileName = name ?: uri.lastPathSegment ?: "shared-${now}"
    return LocalAsset(
        id = uri.toString().hashCode().toLong(),
        uri = uri,
        name = fileName,
        mimeType = mime,
        size = size,
        takenAt = now,
        modifiedAt = now,
        isVideo = mime.startsWith("video/"),
        durationMs = 0,
        bucketId = "",
        bucketName = "",
    )
}
