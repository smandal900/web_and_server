package app.immich.mobile.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString

@Serializable
data class StackResponse(val id: String, val primaryAssetId: String = "", val assets: List<AssetDto> = emptyList())

@Serializable
private data class StackCreate(val assetIds: List<String>)

@Serializable
private data class StackUpdate(val primaryAssetId: String)

@Serializable
data class MapMarker(
    val id: String,
    val lat: Double,
    val lon: Double,
    val city: String? = null,
    val state: String? = null,
    val country: String? = null,
)

suspend fun ImmichApi.stack(id: String): StackResponse = get("/stacks/$id")

suspend fun ImmichApi.createStack(assetIds: List<String>): StackResponse =
    json.decodeFromString(post("/stacks", json.encodeToString(StackCreate(assetIds))))

suspend fun ImmichApi.deleteStack(id: String) {
    delete("/stacks/$id", null)
}

suspend fun ImmichApi.removeFromStack(stackId: String, assetId: String) {
    delete("/stacks/$stackId/assets/$assetId", null)
}

suspend fun ImmichApi.setStackPrimary(stackId: String, assetId: String) {
    put("/stacks/$stackId", json.encodeToString(StackUpdate(assetId)))
}

/** One asset per city, used to draw the places overview. */
suspend fun ImmichApi.cities(): List<AssetDto> = get("/search/cities")

suspend fun ImmichApi.mapMarkers(): List<MapMarker> = get("/map/markers")
