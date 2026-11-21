package app.immich.mobile.ui.local

import androidx.compose.foundation.layout.Row
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import app.immich.mobile.app
import app.immich.mobile.backup.LocalAsset
import app.immich.mobile.backup.LocalMedia
import app.immich.mobile.data.AppLog
import app.immich.mobile.data.clearDeviceDeletions
import app.immich.mobile.data.deviceDeletions
import kotlinx.coroutines.launch

private class PendingDeletion(val assetIds: List<String>, val files: List<LocalAsset>)

/**
 * Photos deleted on the web with "Delete from device also" are still on this phone. Whenever the app comes to the
 * front it asks the server for them and offers to remove them. Android asks for a confirmation of its own before
 * any file is deleted, so nothing disappears without the user seeing it.
 */
@Composable
fun DeviceDeletionPrompt() {
    val context = LocalContext.current
    val app = context.app
    val owner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()
    var pending by remember { mutableStateOf<PendingDeletion?>(null) }
    var asking by remember { mutableStateOf<PendingDeletion?>(null) }
    var checking by remember { mutableStateOf(false) }

    val deleteFromDevice = rememberDeviceDelete { ok ->
        val request = asking
        asking = null
        if (ok && request != null) {
            scope.launch {
                runCatching { app.api.clearDeviceDeletions(request.assetIds) }
                runCatching { app.backup.scanDevice() }
            }
        }
    }

    DisposableEffect(owner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event != Lifecycle.Event.ON_RESUME || checking) return@LifecycleEventObserver
            if (!app.session.isLoggedIn || !LocalMedia.hasPermission(context)) return@LifecycleEventObserver
            checking = true
            scope.launch {
                try {
                    val ids = app.api.deviceDeletions()
                    if (ids.isEmpty()) return@launch
                    app.backup.refreshDeviceList()
                    val snapshot = app.backup.local.value
                    val wanted = ids.toSet()
                    val files = snapshot.assets.filter { asset ->
                        snapshot.remoteIds[asset.cacheKey]?.let { it in wanted } == true
                    }
                    if (files.isEmpty()) {
                        // not on this phone, nothing to offer
                        app.api.clearDeviceDeletions(ids)
                    } else {
                        pending = PendingDeletion(ids, files)
                    }
                } catch (e: Exception) {
                    AppLog.w("DeviceDeletions", "Could not check for photos to remove from the phone", e)
                } finally {
                    checking = false
                }
            }
        }
        owner.lifecycle.addObserver(observer)
        onDispose { owner.lifecycle.removeObserver(observer) }
    }

    val request = pending ?: return
    val count = request.files.size
    val noun = if (count == 1) "photo or video" else "photos and videos"
    AlertDialog(
        onDismissRequest = { pending = null },
        title = { Text("Remove from this phone?") },
        text = {
            Text(
                "$count $noun you deleted on the web with “Delete from device also” " +
                    "${if (count == 1) "is" else "are"} still on this phone.",
            )
        },
        confirmButton = {
            TextButton({
                pending = null
                asking = request
                deleteFromDevice(request.files.map { it.uri })
            }) { Text("Remove") }
        },
        dismissButton = {
            Row {
                TextButton({ pending = null }) { Text("Later") }
                TextButton({
                    pending = null
                    scope.launch { runCatching { app.api.clearDeviceDeletions(request.assetIds) } }
                }) { Text("Keep on phone") }
            }
        },
    )
}
