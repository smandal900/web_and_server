package app.immich.mobile.backup

import android.content.Context
import app.immich.mobile.data.ApiException
import app.immich.mobile.data.ChunkedUploadRequest
import app.immich.mobile.data.ChunkedUploadSession
import app.immich.mobile.data.ImmichApi
import app.immich.mobile.data.UploadResponse
import app.immich.mobile.data.await
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okio.BufferedSink
import okio.source
import java.io.IOException
import java.io.InputStream
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.min

/**
 * Sends a local file to the server, in chunks when the server supports it (`POST /assets/chunked`) and as one multipart
 * request otherwise. An interrupted chunked upload continues with the chunks the server is missing.
 */
class Uploader(private val api: ImmichApi) {
    /** The open upload session of a file, so an interrupted upload continues. Used from several workers. */
    private val resumable = ConcurrentHashMap<String, String>()

    /**
     * One upload per file at a time. Two uploads of the same file would share one session: the first to finish
     * removes it on the server and the other one fails with "Unable to read chunk 0" or a 404 on complete.
     */
    private val inFlight = ConcurrentHashMap<String, Mutex>()

    /** Returns the id of the asset on the server. */
    suspend fun upload(
        context: Context,
        asset: LocalAsset,
        checksum: String,
        onProgress: (Float) -> Unit,
    ): String = inFlight.getOrPut(asset.cacheKey) { Mutex() }.withLock {
        if (asset.size > 0) {
            val chunked = uploadChunked(context, asset, onProgress)
            if (chunked != null) return@withLock chunked
        }
        uploadMultipart(context, asset, checksum, onProgress)
    }

    private suspend fun uploadChunked(context: Context, asset: LocalAsset, onProgress: (Float) -> Unit): String? {
        val base = api.baseUrl
        val key = asset.cacheKey
        var uploadId: String? = null

        try {
            var session: ChunkedUploadSession? = null
            resumable[key]?.let { previous ->
                try {
                    session = api.json.decodeFromString(api.execute(Request.Builder().url("$base/assets/chunked/$previous").build()))
                } catch (e: ApiException) {
                    if (e.code != 404) throw e
                    resumable.remove(key)
                }
            }

            if (session == null) {
                val body = api.json.encodeToString(
                    ChunkedUploadRequest(
                        filename = asset.name,
                        size = asset.size,
                        fileCreatedAt = Instant.ofEpochMilli(asset.takenAt).toString(),
                        fileModifiedAt = Instant.ofEpochMilli(asset.modifiedAt).toString(),
                        duration = asset.durationMs.takeIf { it > 0 }?.toInt(),
                    ),
                )
                val request = Request.Builder().url("$base/assets/chunked")
                    .post(body.toRequestBody(JSON)).build()
                session = try {
                    api.json.decodeFromString(api.execute(request))
                } catch (e: ApiException) {
                    // servers without chunked uploads
                    if (e.code == 404 || e.code == 405) return null
                    throw e
                }
            }

            val active = session!!
            uploadId = active.uploadId
            resumable[key] = active.uploadId
            val received = active.receivedChunks.toSet()
            val chunkUrl = "$base/assets/chunked/${active.uploadId}"

            LocalMedia.open(context, asset).use { input ->
                for (index in 0 until active.totalChunks) {
                    val start = index * active.chunkSize
                    val length = min(active.chunkSize, asset.size - start).toInt()
                    if (index in received) {
                        input.skipFully(length.toLong())
                    } else {
                        val bytes = withContext(Dispatchers.IO) { input.readFully(length) }
                        // a chunk can take a while on a slow link, so the progress moves while it is being sent
                        sendChunk("$chunkUrl/chunks/$index", bytes) { sent -> onProgress((start + sent).toFloat() / asset.size) }
                    }
                    onProgress((start + length).toFloat() / asset.size)
                }
            }

            val complete = Request.Builder().url("$chunkUrl/complete").post(ByteArray(0).toRequestBody(null)).build()
            val response: UploadResponse = api.json.decodeFromString(api.execute(complete))
            resumable.remove(key)
            return response.id
        } catch (e: CancellationException) {
            throw e
        } catch (e: ApiException) {
            // a rejected upload cannot be resumed, a temporary problem can
            if (e.code in 400..499 && e.code != 408 && e.code != 429) {
                resumable.remove(key)
                uploadId?.let { discard(api.baseUrl, it) }
            }
            throw e
        }
    }

    private suspend fun sendChunk(url: String, bytes: ByteArray, onSent: (Int) -> Unit = {}) {
        var attempt = 0
        val body = object : RequestBody() {
            override fun contentType() = "application/octet-stream".toMediaType()

            override fun contentLength() = bytes.size.toLong()

            override fun writeTo(sink: BufferedSink) {
                var offset = 0
                while (offset < bytes.size) {
                    val count = min(64 * 1024, bytes.size - offset)
                    sink.write(bytes, offset, count)
                    sink.emitCompleteSegments()
                    offset += count
                    onSent(offset)
                }
            }
        }
        while (true) {
            try {
                val request = Request.Builder().url(url).put(body).build()
                api.execute(request)
                return
            } catch (e: IOException) {
                val temporary = e !is ApiException || e.code >= 500 || e.code == 408 || e.code == 429
                if (!temporary || ++attempt >= MAX_CHUNK_ATTEMPTS) throw e
                delay(1000L * (1 shl min(attempt, 4)))
            }
        }
    }

    private suspend fun discard(base: String, uploadId: String) {
        runCatching {
            api.client.newCall(Request.Builder().url("$base/assets/chunked/$uploadId").delete().build()).await().close()
        }
    }

    private suspend fun uploadMultipart(
        context: Context,
        asset: LocalAsset,
        checksum: String,
        onProgress: (Float) -> Unit,
    ): String {
        val fileBody = object : RequestBody() {
            override fun contentType() = asset.mimeType.toMediaTypeOrNull() ?: "application/octet-stream".toMediaType()

            override fun contentLength() = asset.size.takeIf { it > 0 } ?: -1

            override fun writeTo(sink: BufferedSink) {
                LocalMedia.open(context, asset).use { input ->
                    val source = input.source()
                    var written = 0L
                    while (true) {
                        val read = source.read(sink.buffer, 256 * 1024)
                        if (read < 0) break
                        written += read
                        sink.emitCompleteSegments()
                        if (asset.size > 0) onProgress(written.toFloat() / asset.size)
                    }
                }
            }
        }

        val body = MultipartBody.Builder().setType(MultipartBody.FORM)
            .addFormDataPart("fileCreatedAt", Instant.ofEpochMilli(asset.takenAt).toString())
            .addFormDataPart("fileModifiedAt", Instant.ofEpochMilli(asset.modifiedAt).toString())
            .addFormDataPart("filename", asset.name)
            .apply { if (asset.durationMs > 0) addFormDataPart("duration", asset.durationMs.toString()) }
            .addFormDataPart("assetData", asset.name, fileBody)
            .build()

        val request = Request.Builder().url("${api.baseUrl}/assets")
            .header("x-immich-checksum", checksum)
            .post(body).build()
        val response: UploadResponse = api.json.decodeFromString(api.execute(request))
        return response.id
    }

    private companion object {
        const val MAX_CHUNK_ATTEMPTS = 6
        val JSON = "application/json; charset=utf-8".toMediaType()
    }
}

private fun InputStream.readFully(length: Int): ByteArray {
    val bytes = ByteArray(length)
    var read = 0
    while (read < length) {
        val count = read(bytes, read, length - read)
        if (count < 0) throw IOException("The file changed while it was being uploaded")
        read += count
    }
    return bytes
}

private fun InputStream.skipFully(count: Long) {
    var remaining = count
    while (remaining > 0) {
        val skipped = skip(remaining)
        if (skipped <= 0) {
            if (read() < 0) throw IOException("The file changed while it was being uploaded")
            remaining--
        } else {
            remaining -= skipped
        }
    }
}
