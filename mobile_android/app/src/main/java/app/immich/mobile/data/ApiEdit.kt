package app.immich.mobile.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

@Serializable
data class TagDto(val id: String, val name: String = "", val value: String = "")

@Serializable
data class EditAction(val action: String, val parameters: JsonObject = JsonObject(emptyMap()))

@Serializable
data class EditsResponse(val assetId: String = "", val edits: List<EditAction> = emptyList())

/** Changes the given metadata of an asset. [rating] 0 removes the rating, null leaves it alone. */
suspend fun ImmichApi.updateAsset(
    id: String,
    description: String? = null,
    dateTimeOriginal: String? = null,
    latitude: Double? = null,
    longitude: Double? = null,
    rating: Int? = null,
) {
    val body = JsonObject(
        buildMap<String, JsonElement> {
            if (description != null) put("description", JsonPrimitive(description))
            if (dateTimeOriginal != null) put("dateTimeOriginal", JsonPrimitive(dateTimeOriginal))
            if (latitude != null && longitude != null) {
                put("latitude", JsonPrimitive(latitude))
                put("longitude", JsonPrimitive(longitude))
            }
            if (rating != null) put("rating", if (rating == 0) JsonNull else JsonPrimitive(rating))
        },
    )
    put("/assets/$id", body.toString())
}

suspend fun ImmichApi.assetEdits(id: String): List<EditAction> = get<EditsResponse>("/assets/$id/edits").edits

suspend fun ImmichApi.applyEdits(id: String, edits: List<EditAction>) {
    val body = JsonObject(
        mapOf(
            "edits" to JsonArray(
                edits.map { JsonObject(mapOf("action" to JsonPrimitive(it.action), "parameters" to it.parameters)) },
            ),
        ),
    )
    put("/assets/$id/edits", body.toString())
}

suspend fun ImmichApi.removeEdits(id: String) {
    delete("/assets/$id/edits", null)
}

/** Adds the tags, creating those that do not exist yet. */
suspend fun ImmichApi.tagAssets(names: List<String>, assetIds: List<String>) {
    val upsert = JsonObject(mapOf("tags" to JsonArray(names.map { JsonPrimitive(it) })))
    val tags: List<TagDto> = json.decodeFromString(put("/tags", upsert.toString()))
    val body = JsonObject(
        mapOf(
            "assetIds" to JsonArray(assetIds.map { JsonPrimitive(it) }),
            "tagIds" to JsonArray(tags.map { JsonPrimitive(it.id) }),
        ),
    )
    put("/tags/assets", body.toString())
}

suspend fun ImmichApi.untagAssets(tagId: String, assetIds: List<String>) {
    delete("/tags/$tagId/assets", JsonObject(mapOf("ids" to JsonArray(assetIds.map { JsonPrimitive(it) }))).toString())
}
