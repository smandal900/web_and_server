package app.immich.mobile.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

// ---- Shared links --------------------------------------------------------------------------------------------------

@Serializable
data class SharedLinkDto(
    val id: String,
    val description: String? = null,
    val password: String? = null,
    val key: String = "",
    val type: String = "INDIVIDUAL",
    val createdAt: String? = null,
    val expiresAt: String? = null,
    val allowUpload: Boolean = false,
    val allowDownload: Boolean = true,
    val showMetadata: Boolean = true,
    val slug: String? = null,
    val album: AlbumDto? = null,
    val assets: List<AssetDto> = emptyList(),
)

@Serializable
data class SharedLinkCreate(
    val type: String,
    val assetIds: List<String>? = null,
    val albumId: String? = null,
    val description: String? = null,
    val password: String? = null,
    val expiresAt: String? = null,
    val allowUpload: Boolean = false,
    val allowDownload: Boolean = true,
    val showMetadata: Boolean = true,
)

/** The public address of a shared link, what people without an account open in their browser. */
fun ImmichApi.sharedLinkUrl(link: SharedLinkDto): String {
    val root = baseUrl.removeSuffix("/api")
    return if (!link.slug.isNullOrBlank()) "$root/s/${link.slug}" else "$root/share/${link.key}"
}

suspend fun ImmichApi.sharedLinks(): List<SharedLinkDto> = get("/shared-links")

suspend fun ImmichApi.createSharedLink(request: SharedLinkCreate): SharedLinkDto =
    json.decodeFromString(post("/shared-links", json.encodeToString(request)))

suspend fun ImmichApi.updateSharedLink(
    id: String,
    description: String?,
    allowDownload: Boolean,
    showMetadata: Boolean,
    allowUpload: Boolean,
    password: String? = null,
) {
    val body = JsonObject(
        buildMap {
            put("description", JsonPrimitive(description ?: ""))
            put("allowDownload", JsonPrimitive(allowDownload))
            put("showMetadata", JsonPrimitive(showMetadata))
            put("allowUpload", JsonPrimitive(allowUpload))
            if (password != null) put("password", JsonPrimitive(password))
        },
    )
    patch("/shared-links/$id", body.toString())
}

suspend fun ImmichApi.deleteSharedLink(id: String) {
    delete("/shared-links/$id", null)
}

// ---- Partners and users --------------------------------------------------------------------------------------------

@Serializable
data class PartnerDto(
    val id: String,
    val name: String = "",
    val email: String = "",
    val inTimeline: Boolean? = null,
)

/** [direction] is `shared-by` for the people the user shares with and `shared-with` for those who share with the user. */
suspend fun ImmichApi.partners(direction: String): List<PartnerDto> = get("/partners", mapOf("direction" to direction))

suspend fun ImmichApi.addPartner(userId: String) {
    post("/partners/$userId", null)
}

suspend fun ImmichApi.removePartner(userId: String) {
    delete("/partners/$userId", null)
}

suspend fun ImmichApi.setPartnerInTimeline(userId: String, inTimeline: Boolean) {
    put("/partners/$userId", """{"inTimeline":$inTimeline}""")
}

suspend fun ImmichApi.users(): List<UserDto> = get("/users")

// ---- Activity ------------------------------------------------------------------------------------------------------

@Serializable
data class ActivityDto(
    val id: String,
    val createdAt: String? = null,
    val user: UserDto,
    val assetId: String? = null,
    val type: String = "comment",
    val comment: String? = null,
)

suspend fun ImmichApi.activities(albumId: String, assetId: String? = null): List<ActivityDto> =
    get("/activities", buildMap {
        put("albumId", albumId)
        if (assetId != null) put("assetId", assetId)
    })

suspend fun ImmichApi.addComment(albumId: String, comment: String, assetId: String? = null): ActivityDto =
    json.decodeFromString(post("/activities", activityBody(albumId, "comment", assetId, comment)))

suspend fun ImmichApi.addLike(albumId: String, assetId: String? = null): ActivityDto =
    json.decodeFromString(post("/activities", activityBody(albumId, "like", assetId, null)))

suspend fun ImmichApi.deleteActivity(id: String) {
    delete("/activities/$id", null)
}

private fun activityBody(albumId: String, type: String, assetId: String?, comment: String?): String =
    JsonObject(
        buildMap<String, JsonElement> {
            put("albumId", JsonPrimitive(albumId))
            put("type", JsonPrimitive(type))
            if (assetId != null) put("assetId", JsonPrimitive(assetId))
            if (comment != null) put("comment", JsonPrimitive(comment))
        },
    ).toString()

// ---- Album sharing and options -------------------------------------------------------------------------------------

suspend fun ImmichApi.addAlbumUsers(albumId: String, userIds: List<String>, role: String = "editor"): AlbumDto {
    val users = userIds.joinToString(",") { """{"userId":${json.encodeToString(it)},"role":"$role"}""" }
    return json.decodeFromString(put("/albums/$albumId/users", """{"albumUsers":[$users]}"""))
}

suspend fun ImmichApi.removeAlbumUser(albumId: String, userId: String) {
    delete("/albums/$albumId/user/$userId", null)
}

suspend fun ImmichApi.setAlbumUserRole(albumId: String, userId: String, role: String) {
    put("/albums/$albumId/user/$userId", """{"role":"$role"}""")
}

/** Changes only the given settings of an album. */
suspend fun ImmichApi.updateAlbum(
    albumId: String,
    description: String? = null,
    isActivityEnabled: Boolean? = null,
    order: String? = null,
) {
    val body = JsonObject(
        buildMap<String, JsonElement> {
            if (description != null) put("description", JsonPrimitive(description))
            if (isActivityEnabled != null) put("isActivityEnabled", JsonPrimitive(isActivityEnabled))
            if (order != null) put("order", JsonPrimitive(order))
        },
    )
    patch("/albums/$albumId", body.toString())
}

// ---- People --------------------------------------------------------------------------------------------------------

/** Changes the given fields of a person. A null [birthDate] leaves it alone, an empty one clears it. */
suspend fun ImmichApi.updatePerson(
    id: String,
    name: String? = null,
    isHidden: Boolean? = null,
    isFavorite: Boolean? = null,
    birthDate: String? = null,
) {
    val body = JsonObject(
        buildMap<String, JsonElement> {
            if (name != null) put("name", JsonPrimitive(name))
            if (isHidden != null) put("isHidden", JsonPrimitive(isHidden))
            if (isFavorite != null) put("isFavorite", JsonPrimitive(isFavorite))
            if (birthDate != null) put("birthDate", if (birthDate.isEmpty()) JsonNull else JsonPrimitive(birthDate))
        },
    )
    put("/people/$id", body.toString())
}

suspend fun ImmichApi.mergePeople(targetId: String, sourceIds: List<String>) {
    post("/people/$targetId/merge", """{"ids":[${sourceIds.joinToString(",") { "\"$it\"" }}]}""")
}

suspend fun ImmichApi.allPeople(): List<PersonDto> {
    val result = ArrayList<PersonDto>()
    var page = 1
    while (true) {
        val response: PeopleResponse = get(
            "/people",
            mapOf("page" to page.toString(), "size" to "500", "withHidden" to "true"),
        )
        result += response.people
        if (response.hasNextPage != true) break
        page++
    }
    return result
}

// ---- Profile image -------------------------------------------------------------------------------------------------

suspend fun ImmichApi.uploadProfileImage(bytes: ByteArray, mimeType: String) {
    val body = MultipartBody.Builder()
        .setType(MultipartBody.FORM)
        .addFormDataPart("file", "profile", bytes.toRequestBody(mimeType.toMediaType()))
        .build()
    execute(Request.Builder().url(url("/users/profile-image")).post(body).build())
}

suspend fun ImmichApi.deleteProfileImage() {
    delete("/users/profile-image", null)
}
