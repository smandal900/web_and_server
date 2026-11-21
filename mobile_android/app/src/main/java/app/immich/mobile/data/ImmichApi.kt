package app.immich.mobile.data

import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class ApiException(val code: Int, message: String) : IOException(message)

/** The filters that decide which assets a timeline shows. */
data class TimelineQuery(
    val albumId: String? = null,
    val personId: String? = null,
    val isFavorite: Boolean? = null,
    val isTrashed: Boolean? = null,
    val visibility: String? = null,
    val withStacked: Boolean = false,
    val withPartners: Boolean = false,
    val order: String? = null,
    val orderBy: String? = null,
    val userId: String? = null,
) {
    fun toParams(): Map<String, String> = buildMap {
        albumId?.let { put("albumId", it) }
        personId?.let { put("personId", it) }
        isFavorite?.let { put("isFavorite", it.toString()) }
        isTrashed?.let { put("isTrashed", it.toString()) }
        visibility?.let { put("visibility", it) }
        order?.let { put("order", it) }
        orderBy?.let { put("orderBy", it) }
        userId?.let { put("userId", it) }
        if (withStacked) put("withStacked", "true")
        if (withPartners) put("withPartners", "true")
    }
}

/** A small hand written client for the parts of the Immich REST API the app uses. */
class ImmichApi(private val session: SessionStore, private val onUnauthorized: () -> Unit) {
    val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        coerceInputValues = true
    }

    /** Rebuilt by [reloadClientCertificate] when the SSL client certificate changes. */
    @Volatile
    var client: OkHttpClient = buildClient()
        private set

    fun reloadClientCertificate() {
        client = buildClient()
    }

    private fun buildClient(): OkHttpClient = OkHttpClient.Builder()
        .apply { ClientCert.sslConfig()?.let { (factory, trust) -> sslSocketFactory(factory, trust) } }
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(120, TimeUnit.SECONDS)
        .addInterceptor { chain ->
            val request = chain.request().newBuilder().apply {
                if (session.token.isNotEmpty() && chain.request().header(TOKEN_HEADER) == null) {
                    header(TOKEN_HEADER, session.token)
                }
                header("deviceModel", Build.MODEL)
                header("deviceType", "Android")
                session.customHeaders.forEach { (name, value) ->
                    // a header the user typed wrongly must not break every request
                    runCatching { header(name, value) }
                }
            }.build()
            chain.proceed(request)
        }
        .build()

    /** The address chosen by automatic endpoint switching, or null to use the one the user signed in with. */
    @Volatile
    var endpointOverride: String? = null

    val baseUrl: String get() = endpointOverride ?: session.serverUrl

    // ---- URLs of images and videos, loaded through the authenticated client -------------------------------------

    fun thumbnailUrl(id: String, thumbhash: String? = null) = assetUrl(id, "thumbnail", "size=thumbnail", thumbhash)

    fun previewUrl(id: String, thumbhash: String? = null) = assetUrl(id, "thumbnail", "size=preview", thumbhash)

    fun originalUrl(id: String) = "$baseUrl/assets/$id/original"

    fun videoUrl(id: String) = "$baseUrl/assets/$id/video/playback"

    fun personThumbnailUrl(id: String, updatedAt: String? = null) =
        "$baseUrl/people/$id/thumbnail" + (updatedAt?.let { "?c=$it" } ?: "")

    fun userAvatarUrl(id: String) = "$baseUrl/users/$id/profile-image"

    private fun assetUrl(id: String, endpoint: String, size: String, thumbhash: String?): String =
        "$baseUrl/assets/$id/$endpoint?$size" + (thumbhash?.let { "&c=${java.net.URLEncoder.encode(it, "UTF-8")}" } ?: "")

    // ---- Connecting ------------------------------------------------------------------------------------------------

    /**
     * Finds the API root for what the user typed. A missing scheme is tried as https first and then as http.
     * Returns null when no server answers the ping.
     */
    suspend fun resolveServer(input: String): String? {
        val trimmed = input.trim().trimEnd('/')
        if (trimmed.isEmpty()) return null
        val candidates = if (trimmed.contains("://")) listOf(trimmed) else listOf("https://$trimmed", "http://$trimmed")
        for (candidate in candidates) {
            val root = candidate.removeSuffix("/api").trimEnd('/') + "/api"
            if (ping(root)) return root
        }
        return null
    }

    private suspend fun ping(root: String): Boolean = try {
        val request = Request.Builder().url("$root/server/ping").build()
        val body = execute(request, notifyUnauthorized = false)
        json.decodeFromString<PingResponse>(body).res == "pong"
    } catch (_: Exception) {
        false
    }

    /** Whether the server answers right now, a cheap request used to notice that the connection was lost or came back. */
    suspend fun isReachable(): Boolean = ping(baseUrl)

    suspend fun login(root: String, email: String, password: String): LoginResponse {
        val body = json.encodeToString(LoginRequest(email, password))
        val request = Request.Builder().url("$root/auth/login").post(body.jsonBody()).build()
        return json.decodeFromString(execute(request, notifyUnauthorized = false))
    }

    suspend fun logout() {
        runCatching { post("/auth/logout", null) }
    }

    suspend fun validateToken(): Boolean = try {
        post("/auth/validateToken", null)
        true
    } catch (e: ApiException) {
        e.code != 401
    } catch (_: IOException) {
        true // offline, keep the session
    }

    // ---- Server and user ----------------------------------------------------------------------------------------

    suspend fun me(): UserDto = get("/users/me")

    suspend fun features(): ServerFeatures = get("/server/features")

    suspend fun about(): ServerAbout = get("/server/about")

    suspend fun storage(): ServerStorage = get("/server/storage")

    suspend fun config(): ServerConfig = get("/server/config")

    suspend fun assetStats(): AssetStats = get("/assets/statistics")

    // ---- Timeline -----------------------------------------------------------------------------------------------

    suspend fun timelineBuckets(query: TimelineQuery): List<TimeBucketDto> = get("/timeline/buckets", query.toParams())

    suspend fun timelineBucket(query: TimelineQuery, bucket: String): List<AssetItem> {
        val assets: TimeBucketAssets = get("/timeline/bucket", query.toParams() + ("timeBucket" to bucket))
        return assets.toItems()
    }

    // ---- Assets -----------------------------------------------------------------------------------------------

    suspend fun asset(id: String): AssetDto = get("/assets/$id")

    suspend fun setFavorite(ids: Collection<String>, favorite: Boolean) {
        put("/assets", json.encodeToString(BulkUpdate(ids.toList(), isFavorite = favorite)))
    }

    suspend fun setVisibility(ids: Collection<String>, visibility: String) {
        put("/assets", json.encodeToString(BulkUpdate(ids.toList(), visibility = visibility)))
    }

    suspend fun trash(ids: Collection<String>, force: Boolean = false) {
        delete("/assets", json.encodeToString(BulkDelete(ids.toList(), force)))
    }

    suspend fun restore(ids: Collection<String>) {
        post("/trash/restore/assets", json.encodeToString(BulkIds(ids.toList())))
    }

    suspend fun restoreAllTrash() {
        post("/trash/restore", null)
    }

    suspend fun emptyTrash() {
        post("/trash/empty", null)
    }

    /** Downloads the original file of an asset to [target]. */
    suspend fun downloadOriginal(id: String, target: File, onProgress: (Long, Long) -> Unit = { _, _ -> }, url: String = originalUrl(id)) {
        val request = Request.Builder().url(url).build()
        client.newCall(request).await().use { response ->
            if (!response.isSuccessful) throw ApiException(response.code, "Download failed (${response.code})")
            val body = response.body ?: throw IOException("Empty response")
            val total = body.contentLength()
            withContext(Dispatchers.IO) {
                body.byteStream().use { input ->
                    target.outputStream().use { output ->
                        val buffer = ByteArray(64 * 1024)
                        var copied = 0L
                        while (true) {
                            val read = input.read(buffer)
                            if (read < 0) break
                            output.write(buffer, 0, read)
                            copied += read
                            onProgress(copied, total)
                        }
                    }
                }
            }
        }
    }

    // ---- Albums -------------------------------------------------------------------------------------------------

    suspend fun albums(): List<AlbumDto> = get("/albums")

    suspend fun sharedAlbums(): List<AlbumDto> = get("/albums", mapOf("shared" to "true"))

    suspend fun album(id: String): AlbumDto = get("/albums/$id")

    suspend fun createAlbum(name: String, assetIds: List<String> = emptyList()): AlbumDto =
        json.decodeFromString(post("/albums", json.encodeToString(CreateAlbumRequest(name, assetIds))))

    suspend fun renameAlbum(id: String, name: String) {
        patch("/albums/$id", json.encodeToString(UpdateAlbumRequest(albumName = name)))
    }

    suspend fun deleteAlbum(id: String) {
        delete("/albums/$id", null)
    }

    suspend fun addToAlbums(albumIds: List<String>, assetIds: List<String>) {
        put("/albums/assets", json.encodeToString(AddToAlbumsRequest(albumIds, assetIds)))
    }

    suspend fun removeFromAlbum(albumId: String, assetIds: List<String>) {
        delete("/albums/$albumId/assets", json.encodeToString(BulkIds(assetIds)))
    }

    // ---- People, memories, search -------------------------------------------------------------------------------

    suspend fun people(page: Int = 1, size: Int = 500): PeopleResponse =
        get("/people", mapOf("page" to page.toString(), "size" to size.toString()))

    suspend fun person(id: String): PersonDto = get("/people/$id")

    suspend fun renamePerson(id: String, name: String) {
        put("/people/$id", """{"name":${json.encodeToString(name)}}""")
    }

    suspend fun memories(): List<MemoryDto> = get("/memories")

    suspend fun searchMetadata(request: MetadataSearchRequest): SearchAssets =
        json.decodeFromString<SearchResponse>(post("/search/metadata", json.encodeToString(request))).assets

    suspend fun searchSmart(request: SmartSearchRequest): SearchAssets =
        json.decodeFromString<SearchResponse>(post("/search/smart", json.encodeToString(request))).assets

    suspend fun suggestions(type: String): List<String> =
        get("/search/suggestions", mapOf("type" to type))

    // ---- Uploads ------------------------------------------------------------------------------------------------

    suspend fun bulkUploadCheck(items: List<BulkCheckItem>): List<BulkCheckResult> =
        json.decodeFromString<BulkCheckResponse>(
            post("/assets/bulk-upload-check", json.encodeToString(BulkCheckRequest(items))),
        ).results

    // ---- HTTP plumbing -----------------------------------------------------------------------------------------

    internal fun String.jsonBody(): RequestBody = toRequestBody(JSON_TYPE)

    internal fun url(path: String, query: Map<String, String> = emptyMap()) =
        "$baseUrl$path".toHttpUrl().newBuilder().apply { query.forEach { (k, v) -> addQueryParameter(k, v) } }.build()

    internal suspend inline fun <reified T> get(path: String, query: Map<String, String> = emptyMap()): T =
        json.decodeFromString(execute(Request.Builder().url(url(path, query)).build()))

    internal suspend fun post(path: String, body: String?): String =
        execute(Request.Builder().url(url(path)).post((body ?: "{}").jsonBody()).build())

    internal suspend fun put(path: String, body: String): String =
        execute(Request.Builder().url(url(path)).put(body.jsonBody()).build())

    internal suspend fun patch(path: String, body: String): String =
        execute(Request.Builder().url(url(path)).patch(body.jsonBody()).build())

    internal suspend fun delete(path: String, body: String?): String =
        execute(Request.Builder().url(url(path)).delete(body?.jsonBody()).build())

    /** Sends [request] and returns the body, or throws an [ApiException] for a failed status. */
    suspend fun execute(request: Request, notifyUnauthorized: Boolean = true): String =
        client.newCall(request).await().use { response ->
            val body = withContext(Dispatchers.IO) { response.body?.string().orEmpty() }
            if (!response.isSuccessful) {
                AppLog.w("Api", "${request.method} ${request.url.encodedPath} failed with ${response.code}")
                if (response.code == 401 && notifyUnauthorized && session.isLoggedIn) onUnauthorized()
                throw ApiException(response.code, errorMessage(body, response.code))
            }
            body
        }

    private fun errorMessage(body: String, code: Int): String = try {
        val message = json.parseToJsonElement(body).jsonObject["message"]
        // validation errors are a list of messages
        (message?.jsonPrimitive?.content ?: "Request failed ($code)")
    } catch (_: Exception) {
        if (body.isNotBlank() && body.length < 200) body else "Request failed ($code)"
    }

    private companion object {
        const val TOKEN_HEADER = "x-immich-user-token"
        val JSON_TYPE = "application/json; charset=utf-8".toMediaType()
    }
}

suspend fun Call.await(): Response = suspendCancellableCoroutine { continuation ->
    continuation.invokeOnCancellation { cancel() }
    enqueue(object : Callback {
        override fun onFailure(call: Call, e: IOException) {
            if (continuation.isActive) continuation.resumeWithException(e)
        }

        override fun onResponse(call: Call, response: Response) {
            continuation.resume(response)
        }
    })
}
