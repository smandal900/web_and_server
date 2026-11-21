package app.immich.mobile.ui.viewer

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.media.MediaScannerConnection
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.FileProvider
import app.immich.mobile.app
import app.immich.mobile.data.AssetDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

object AssetFiles {
    private fun safeName(dto: AssetDto): String {
        val name = dto.originalFileName.ifBlank { dto.id }
        return name.replace(Regex("[\\\\/:*?\"<>|]"), "_")
    }

    /** Downloads the original of an asset into the cache and returns it with its server side description. */
    private suspend fun fetch(context: Context, id: String, preview: Boolean = false): Pair<File, AssetDto> {
        val api = context.app.api
        val dto = api.asset(id)
        val directory = File(context.cacheDir, "shared").apply { mkdirs() }
        // the preview is a smaller JPEG, only photos have one worth sending
        val usePreview = preview && dto.type == "IMAGE"
        val name = if (usePreview) safeName(dto).substringBeforeLast('.') + "-preview.jpg" else safeName(dto)
        val file = File(directory, "${dto.id.take(8)}-$name")
        if (!file.exists() || file.length() == 0L) {
            if (usePreview) api.downloadOriginal(id, file, url = api.previewUrl(id)) else api.downloadOriginal(id, file)
        }
        return file to (if (usePreview) dto.copy(originalMimeType = "image/jpeg") else dto)
    }

    /** Opens the system share sheet with the original files of [ids]. */
    suspend fun share(context: Context, ids: List<String>, original: Boolean? = null) {
        val preview = if (original != null) !original else !context.app.prefs.shareOriginal
        val files = ids.map { fetch(context, it, preview) }
        val uris = files.map { (file, _) ->
            FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        }
        val mimeTypes = files.mapNotNull { it.second.originalMimeType }.distinct()
        val mime = when {
            mimeTypes.size == 1 -> mimeTypes.first()
            mimeTypes.all { it.startsWith("image/") } -> "image/*"
            else -> "*/*"
        }
        val intent = if (uris.size == 1) {
            Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM, uris.first())
        } else {
            Intent(Intent.ACTION_SEND_MULTIPLE).putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(uris))
        }
        intent.setType(mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        context.startActivity(Intent.createChooser(intent, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    /** Saves the original of an asset into the device gallery. */
    suspend fun saveToDevice(context: Context, id: String) {
        val (file, dto) = fetch(context, id)
        val mime = dto.originalMimeType ?: "application/octet-stream"
        val isVideo = mime.startsWith("video/")
        withContext(Dispatchers.IO) {
            if (Build.VERSION.SDK_INT >= 29) {
                val values = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, safeName(dto))
                    put(MediaStore.MediaColumns.MIME_TYPE, mime)
                    put(
                        MediaStore.MediaColumns.RELATIVE_PATH,
                        (if (isVideo) Environment.DIRECTORY_MOVIES else Environment.DIRECTORY_PICTURES) + "/Immich",
                    )
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }
                val collection = if (isVideo) {
                    MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                } else {
                    MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                }
                val resolver = context.contentResolver
                val uri = resolver.insert(collection, values) ?: error("Unable to save the file")
                resolver.openOutputStream(uri)?.use { out -> file.inputStream().use { it.copyTo(out) } }
                resolver.update(uri, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
            } else {
                val directory = File(
                    Environment.getExternalStoragePublicDirectory(
                        if (isVideo) Environment.DIRECTORY_MOVIES else Environment.DIRECTORY_PICTURES,
                    ),
                    "Immich",
                ).apply { mkdirs() }
                val target = File(directory, safeName(dto))
                file.copyTo(target, overwrite = true)
                MediaScannerConnection.scanFile(context, arrayOf(target.path), arrayOf(mime), null)
            }
        }
    }
}
