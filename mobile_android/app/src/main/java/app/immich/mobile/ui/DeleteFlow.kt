package app.immich.mobile.ui

import android.net.Uri
import android.os.Build
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import app.immich.mobile.ImmichApp
import app.immich.mobile.data.AssetItem
import app.immich.mobile.ui.local.rememberDeviceDelete

/**
 * What deleting some photos and videos touches, wherever they are deleted from:
 * - the files on this phone move to the bin of the phone ([deviceUris]),
 * - the copies on the server move to the trash of the server ([serverIds]).
 *
 * A photo that was never uploaded only has a file on the phone, so only the bin of the phone is involved and
 * nothing is sent to the server. A photo that only lives on the server only goes to the trash of the server.
 */
class DeletePlan(val items: List<AssetItem>, val deviceUris: List<Uri>, val serverIds: List<String>) {
    /** The sentence the confirmation dialog shows. */
    fun message(): String {
        val what = if (items.size == 1) "This item" else "${items.size} items"
        val bin = if (Build.VERSION.SDK_INT >= 30) "moved to the bin on this phone" else "deleted from this phone"
        return when {
            deviceUris.isNotEmpty() && serverIds.isNotEmpty() ->
                "$what will be $bin and moved to the trash on the server."

            deviceUris.isNotEmpty() -> "$what will be $bin. It was not uploaded and will not be."
            else -> "$what will be moved to the trash on the server."
        }
    }
}

/** Works out where [items] have to be deleted: on this phone, on the server, or both. */
fun planDelete(app: ImmichApp, items: Collection<AssetItem>): DeletePlan {
    val snapshot = app.backup.local.value
    // the files of this phone the server has, by the id of the photo on the server
    val filesOfServerPhoto = snapshot.assets
        .mapNotNull { file -> snapshot.remoteIds[file.cacheKey]?.let { it to file } }
        .groupBy({ it.first }, { it.second })

    val uris = LinkedHashSet<Uri>()
    val serverIds = LinkedHashSet<String>()
    for (item in items) {
        if (item.isLocal) {
            uris += Uri.parse(item.localUri)
            item.remoteId?.let { serverIds += it }
        } else {
            serverIds += item.id
            filesOfServerPhoto[item.id]?.forEach { uris += it.uri }
        }
    }
    return DeletePlan(items.toList(), uris.toList(), serverIds.toList())
}

/**
 * Returns a function that deletes a [DeletePlan] and then calls its `onDone`. The files of the phone go first, Android
 * asks the user to confirm that; if they say no nothing is deleted. Then the copies on the server follow.
 */
@Composable
fun rememberDeleteFlow(actions: AssetActions): (DeletePlan, () -> Unit) -> Unit {
    var pending by remember { mutableStateOf<Pair<DeletePlan, () -> Unit>?>(null) }
    val deleteOnDevice = rememberDeviceDelete { ok ->
        val request = pending
        pending = null
        if (ok && request != null) actions.delete(request.first, request.second)
    }
    return { plan, onDone ->
        if (plan.deviceUris.isEmpty()) {
            actions.delete(plan, onDone)
        } else {
            pending = plan to onDone
            deleteOnDevice(plan.deviceUris)
        }
    }
}
