package app.immich.mobile.data

import androidx.compose.runtime.Immutable
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull

@Serializable
data class LoginRequest(val email: String, val password: String)

@Serializable
data class LoginResponse(
    val accessToken: String,
    val userId: String,
    val userEmail: String = "",
    val name: String = "",
    val isAdmin: Boolean = false,
    val profileImagePath: String = "",
    val shouldChangePassword: Boolean = false,
)

@Serializable
data class PingResponse(val res: String = "")

@Serializable
data class ServerFeatures(
    val passwordLogin: Boolean = true,
    val smartSearch: Boolean = false,
    val trash: Boolean = true,
    val map: Boolean = false,
    val oauth: Boolean = false,
    val facialRecognition: Boolean = false,
)

@Serializable
data class ServerAbout(val version: String = "")

@Serializable
data class ServerStorage(
    val diskUse: String = "",
    val diskSize: String = "",
    val diskUsagePercentage: Double = 0.0,
)

@Serializable
data class ServerConfig(
    val trashDays: Int = 30,
    /** Bytes per chunk of a chunked upload; 0 when the server does not say. A file this small is not chunked. */
    val chunkSize: Long = 0,
    val loginPageMessage: String = "",
    val mapLightStyleUrl: String = "",
    val mapDarkStyleUrl: String = "",
    val oauthButtonText: String = "",
    val externalDomain: String = "",
)

@Serializable
data class UserDto(
    val id: String,
    val name: String = "",
    val email: String = "",
    val profileImagePath: String = "",
    val quotaSizeInBytes: Long? = null,
    val quotaUsageInBytes: Long? = null,
)

@Serializable
data class AssetStats(val images: Int = 0, val videos: Int = 0, val total: Int = 0)

@Serializable
data class TimeBucketDto(val timeBucket: String, val count: Int)

/** Column oriented response of `GET /timeline/bucket`. */
@Serializable
data class TimeBucketAssets(
    val id: List<String> = emptyList(),
    val isFavorite: List<Boolean> = emptyList(),
    val isImage: List<Boolean> = emptyList(),
    val isTrashed: List<Boolean> = emptyList(),
    val duration: List<Int?> = emptyList(),
    val fileCreatedAt: List<String> = emptyList(),
    val ratio: List<Double> = emptyList(),
    val thumbhash: List<String?> = emptyList(),
    val livePhotoVideoId: List<String?> = emptyList(),
    val ownerId: List<String> = emptyList(),
    val visibility: List<String> = emptyList(),
    val stack: List<List<String>?> = emptyList(),
)

/** What the grids and the viewer need to know about an asset. */
@Immutable
data class AssetItem(
    val id: String,
    val isImage: Boolean,
    val isFavorite: Boolean = false,
    val isTrashed: Boolean = false,
    val ratio: Double = 1.0,
    val durationMs: Int? = null,
    val thumbhash: String? = null,
    val livePhotoVideoId: String? = null,
    val ownerId: String? = null,
    val createdAt: String? = null,
    val visibility: String? = null,
    val stackCount: Int = 0,
    val stackId: String? = null,
    /** Set for photos and videos that are on this device: where to read them from. */
    val localUri: String? = null,
    /** For device photos: whether the server has them, null when that is not known yet. */
    val backedUp: Boolean? = null,
    val takenMillis: Long = 0,
    /** For device photos the server has: the id of the same photo on the server. */
    val remoteId: String? = null,
) {
    val isVideo get() = !isImage
    val isLocal get() = localUri != null
}

fun TimeBucketAssets.toItems(): List<AssetItem> = id.indices.map { i ->
    AssetItem(
        id = id[i],
        isImage = isImage.getOrElse(i) { true },
        isFavorite = isFavorite.getOrElse(i) { false },
        isTrashed = isTrashed.getOrElse(i) { false },
        ratio = ratio.getOrElse(i) { 1.0 }.takeIf { it > 0 } ?: 1.0,
        durationMs = duration.getOrNull(i),
        thumbhash = thumbhash.getOrNull(i),
        livePhotoVideoId = livePhotoVideoId.getOrNull(i),
        ownerId = ownerId.getOrNull(i),
        createdAt = fileCreatedAt.getOrNull(i),
        visibility = visibility.getOrNull(i),
        stackCount = stack.getOrNull(i)?.getOrNull(1)?.toIntOrNull() ?: 0,
        stackId = stack.getOrNull(i)?.getOrNull(0),
    )
}

@Serializable
data class ExifDto(
    val city: String? = null,
    val country: String? = null,
    val state: String? = null,
    val dateTimeOriginal: String? = null,
    val description: String? = null,
    val exifImageHeight: Int? = null,
    val exifImageWidth: Int? = null,
    val exposureTime: String? = null,
    val fNumber: Double? = null,
    val fileSizeInByte: Long? = null,
    val focalLength: Double? = null,
    val iso: Int? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val lensModel: String? = null,
    val make: String? = null,
    val model: String? = null,
    val timeZone: String? = null,
    val rating: Int? = null,
)

@Serializable
data class PersonDto(
    val id: String,
    val name: String = "",
    val isHidden: Boolean = false,
    val isFavorite: Boolean = false,
    val updatedAt: String? = null,
    val birthDate: String? = null,
)

@Serializable
data class AssetDto(
    val id: String,
    val type: String = "IMAGE",
    val originalFileName: String = "",
    val originalMimeType: String? = null,
    val fileCreatedAt: String? = null,
    val localDateTime: String? = null,
    val isFavorite: Boolean = false,
    val isArchived: Boolean = false,
    val isTrashed: Boolean = false,
    val duration: JsonElement? = null,
    val width: Int? = null,
    val height: Int? = null,
    val thumbhash: String? = null,
    val livePhotoVideoId: String? = null,
    val ownerId: String? = null,
    val visibility: String? = null,
    val exifInfo: ExifDto? = null,
    val people: List<PersonDto> = emptyList(),
    val stack: StackDto? = null,
    val tags: List<TagDto> = emptyList(),
)

@Serializable
data class StackDto(val id: String = "", val assetCount: Int = 0, val primaryAssetId: String = "")

fun AssetDto.toItem(): AssetItem {
    val w = width ?: exifInfo?.exifImageWidth
    val h = height ?: exifInfo?.exifImageHeight
    return AssetItem(
        id = id,
        isImage = type == "IMAGE",
        isFavorite = isFavorite,
        isTrashed = isTrashed,
        ratio = if (w != null && h != null && w > 0 && h > 0) w.toDouble() / h else 1.0,
        durationMs = durationToMillis(duration),
        thumbhash = thumbhash,
        livePhotoVideoId = livePhotoVideoId,
        ownerId = ownerId,
        createdAt = fileCreatedAt,
        visibility = visibility,
        stackCount = stack?.assetCount ?: 0,
        stackId = stack?.id?.ifBlank { null },
    )
}

/** The duration is a number of milliseconds on current servers and an `h:mm:ss.SSS` string on older ones. */
fun durationToMillis(element: JsonElement?): Int? {
    if (element == null || element is JsonNull) return null
    val primitive = element as? JsonPrimitive ?: return null
    primitive.doubleOrNull?.let { return it.toInt() }
    val text = primitive.contentOrNull ?: return null
    val parts = text.split(":")
    if (parts.size != 3) return null
    val seconds = parts[2].toDoubleOrNull() ?: return null
    val total = (parts[0].toDoubleOrNull() ?: 0.0) * 3600 + (parts[1].toDoubleOrNull() ?: 0.0) * 60 + seconds
    return (total * 1000).toInt()
}

@Serializable
data class AlbumDto(
    val id: String,
    val albumName: String = "",
    val description: String = "",
    val albumThumbnailAssetId: String? = null,
    val assetCount: Int = 0,
    val shared: Boolean = false,
    val startDate: String? = null,
    val endDate: String? = null,
    val updatedAt: String? = null,
    val ownerId: String? = null,
    val order: String? = null,
    val isActivityEnabled: Boolean = true,
    val owner: UserDto? = null,
    val albumUsers: List<AlbumUserDto> = emptyList(),
)

@Serializable
data class PeopleResponse(val people: List<PersonDto> = emptyList(), val hasNextPage: Boolean? = null, val total: Int = 0)

@Serializable
data class SearchResponse(val assets: SearchAssets = SearchAssets())

@Serializable
data class SearchAssets(
    val items: List<AssetDto> = emptyList(),
    val nextPage: String? = null,
    val total: Int = 0,
)

@Serializable
data class CreateAlbumRequest(val albumName: String, val assetIds: List<String> = emptyList())

@Serializable
data class UpdateAlbumRequest(val albumName: String? = null, val description: String? = null)

@Serializable
data class AddToAlbumsRequest(val albumIds: List<String>, val assetIds: List<String>)

@Serializable
data class BulkIds(val ids: List<String>)

@Serializable
data class BulkUpdate(val ids: List<String>, val isFavorite: Boolean? = null, val visibility: String? = null)

@Serializable
data class BulkDelete(val ids: List<String>, val force: Boolean = false)

@Serializable
data class MetadataSearchRequest(
    val originalFileName: String? = null,
    val type: String? = null,
    val isFavorite: Boolean? = null,
    val city: String? = null,
    val country: String? = null,
    val personIds: List<String>? = null,
    val takenAfter: String? = null,
    val takenBefore: String? = null,
    val createdAfter: String? = null,
    val make: String? = null,
    val model: String? = null,
    val order: String? = null,
    val withExif: Boolean = false,
    val page: Int = 1,
    val size: Int = 100,
)

@Serializable
data class SmartSearchRequest(
    val query: String,
    val type: String? = null,
    val isFavorite: Boolean? = null,
    val personIds: List<String>? = null,
    val city: String? = null,
    val country: String? = null,
    val takenAfter: String? = null,
    val takenBefore: String? = null,
    val createdAfter: String? = null,
    val make: String? = null,
    val model: String? = null,
    val page: Int = 1,
    val size: Int = 100,
)

@Serializable
data class MemoryDto(
    val id: String,
    val type: String = "",
    val memoryAt: String? = null,
    val data: MemoryData? = null,
    val assets: List<AssetDto> = emptyList(),
)

@Serializable
data class MemoryData(val year: Int? = null)

@Serializable
data class BulkCheckItem(val id: String, val checksum: String)

@Serializable
data class BulkCheckRequest(val assets: List<BulkCheckItem>)

@Serializable
data class BulkCheckResult(val id: String, val action: String, val reason: String? = null, val assetId: String? = null)

@Serializable
data class BulkCheckResponse(val results: List<BulkCheckResult> = emptyList())

@Serializable
data class ChunkedUploadRequest(
    val filename: String,
    val size: Long,
    val fileCreatedAt: String,
    val fileModifiedAt: String,
    val duration: Int? = null,
    val isFavorite: Boolean? = null,
    /** The time on this phone when the upload started; every chunk is sent with it and the server ignores any other. */
    val timestamp: String,
)

@Serializable
data class ChunkedUploadSession(
    val uploadId: String,
    val chunkSize: Long,
    val totalChunks: Int,
    val receivedChunks: List<Int> = emptyList(),
    val resumeWindowMinutes: Int? = null,
    val timestamp: String? = null,
)

@Serializable
data class UploadResponse(val id: String, @SerialName("status") val status: String = "created")

@Serializable
data class AlbumUserDto(val user: UserDto, val role: String = "editor")
