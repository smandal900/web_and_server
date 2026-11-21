package app.immich.mobile.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString

@Serializable
private data class DeviceDeletions(val assetIds: List<String> = emptyList())

/**
 * The assets that were deleted on the web with "Delete from device also" and that this phone should drop too.
 * Servers without the feature answer 404, which counts as nothing pending.
 */
suspend fun ImmichApi.deviceDeletions(): List<String> = try {
    get<DeviceDeletions>("/assets/device-deletions").assetIds
} catch (e: ApiException) {
    if (e.code == 404) emptyList() else throw e
}

/** Tells the server the phone has dealt with these assets, so they are not offered again. */
suspend fun ImmichApi.clearDeviceDeletions(assetIds: List<String>) {
    if (assetIds.isEmpty()) return
    delete("/assets/device-deletions", json.encodeToString(DeviceDeletions(assetIds)))
}
