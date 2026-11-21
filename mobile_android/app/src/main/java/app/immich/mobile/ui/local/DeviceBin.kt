package app.immich.mobile.ui.local

import android.os.Build
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.RestoreFromTrash
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.immich.mobile.app
import app.immich.mobile.backup.LocalAsset
import app.immich.mobile.backup.LocalMedia
import app.immich.mobile.ui.components.CenterMessage
import coil3.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import androidx.compose.runtime.rememberCoroutineScope

/**
 * The bin of this device: photos and videos deleted from the app wait here for 30 days before the phone removes them.
 * It only holds files of the phone and has nothing to do with the trash of the server.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun DeviceBinScreen() {
    val context = LocalContext.current
    val app = context.app
    val scope = rememberCoroutineScope()
    var granted by remember { mutableStateOf(LocalMedia.hasPermission(context)) }
    var items by remember { mutableStateOf<List<LocalAsset>?>(null) }
    val selected = remember { mutableStateMapOf<Long, LocalAsset>() }
    var confirmDelete by remember { mutableStateOf<List<LocalAsset>?>(null) }
    var reload by remember { mutableStateOf(0) }
    val snackbar = remember { SnackbarHostState() }

    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        granted = LocalMedia.hasPermission(context)
    }
    LaunchedEffect(granted, reload) {
        if (granted) items = withContext(Dispatchers.IO) { LocalMedia.queryTrashed(context) }
    }

    fun done() {
        selected.clear()
        reload++
    }
    var restoring by remember { mutableStateOf<List<LocalAsset>>(emptyList()) }
    val restoreFiles = rememberDeviceRestore { ok ->
        val files = restoring
        restoring = emptyList()
        if (ok) {
            scope.launch {
                // the copies on the server leave its trash too, then the files show in the timeline again
                var message: String? = null
                if (app.session.isLoggedIn) {
                    try {
                        val (ids, checksums) = app.backup.serverRefsOf(files)
                        if (ids.isNotEmpty() || checksums.isNotEmpty()) {
                            // kept on disk and sent later when the server cannot be reached now
                            app.pending.restore(ids)
                            app.pending.restoreByChecksum(checksums)
                            message = if (app.pending.flush()) "Restored, also from the trash on the server"
                            else "Restored on this phone. The server follows when you are back online"
                        }
                    } catch (e: kotlinx.coroutines.CancellationException) {
                        throw e
                    } catch (e: Exception) {
                        message = "Restored on this phone, but not on the server: ${e.message ?: "unknown error"}"
                    }
                }
                runCatching { app.backup.scanDevice() }
                message?.let { snackbar.showSnackbar(it) }
            }
        }
        done()
    }
    val restore = { files: List<LocalAsset> ->
        restoring = files
        restoreFiles(files.map { it.uri })
    }
    val deleteForever = rememberDeviceDelete(trash = false) { done() }

    BackHandler(enabled = selected.isNotEmpty()) { selected.clear() }

    Scaffold(
        contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0),
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            if (selected.isNotEmpty()) {
                TopAppBar(
                    title = { Text("${selected.size} selected") },
                    navigationIcon = { IconButton({ selected.clear() }) { Icon(Icons.Filled.Close, "Clear selection") } },
                    actions = {
                        IconButton({ restore(selected.values.toList()) }) {
                            Icon(Icons.Filled.RestoreFromTrash, "Restore")
                        }
                        IconButton({ confirmDelete = selected.values.toList() }) {
                            Icon(Icons.Filled.DeleteForever, "Delete forever")
                        }
                    },
                )
            } else {
                TopAppBar(
                    title = { Text("Bin") },
                    actions = {
                        if (!items.isNullOrEmpty()) {
                            TextButton({ confirmDelete = items }) { Text("Empty") }
                        }
                    },
                )
            }
        },
    ) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            val list = items
            when {
                Build.VERSION.SDK_INT < 30 -> CenterMessage(
                    "The bin needs Android 11 or later",
                    detail = "On this phone deleted photos are removed right away",
                )

                !granted -> CenterMessage(
                    "Allow access to your photos",
                    detail = "The bin shows the photos and videos you deleted from this phone",
                    action = "Allow access",
                    onAction = { permission.launch(LocalMedia.permissions()) },
                )

                list == null -> CenterMessage("Looking at the bin…")
                list.isEmpty() -> CenterMessage(
                    "The bin is empty",
                    detail = "Photos and videos you delete from this phone wait here for 30 days",
                )

                else -> LazyVerticalGrid(
                    columns = GridCells.Adaptive(110.dp),
                    contentPadding = PaddingValues(bottom = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        Text(
                            "Items stay in the bin for 30 days, then the phone removes them for good. " +
                                "Restoring a photo that is also in the trash of your server restores it there too.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                        )
                    }
                    items(list, key = { it.uri.toString() }) { asset ->
                        BinCell(
                            asset = asset,
                            isSelected = asset.id in selected && selected[asset.id]?.uri == asset.uri,
                            onClick = { toggle(selected, asset) },
                            onLongClick = { toggle(selected, asset) },
                        )
                    }
                }
            }
        }
    }

    confirmDelete?.let { victims ->
        AlertDialog(
            onDismissRequest = { confirmDelete = null },
            title = { Text(if (victims.size == 1) "Delete this item forever?" else "Delete ${victims.size} items forever?") },
            text = { Text("They are removed from this phone and cannot be restored.") },
            confirmButton = {
                TextButton({
                    confirmDelete = null
                    deleteForever(victims.map { it.uri })
                }) { Text("Delete") }
            },
            dismissButton = { TextButton({ confirmDelete = null }) { Text("Cancel") } },
        )
    }
}

private fun toggle(selected: MutableMap<Long, LocalAsset>, asset: LocalAsset) {
    if (selected.remove(asset.id) == null) selected[asset.id] = asset
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun BinCell(asset: LocalAsset, isSelected: Boolean, onClick: () -> Unit, onLongClick: () -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .aspectRatio(1f)
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .combinedClickable(onClick = onClick, onLongClick = onLongClick),
    ) {
        AsyncImage(
            model = asset.uri.toString(),
            contentDescription = asset.name,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )
        if (asset.isVideo) {
            Icon(
                Icons.Filled.PlayArrow,
                null,
                tint = Color.White,
                modifier = Modifier.align(Alignment.BottomStart).padding(4.dp),
            )
        }
        val daysLeft = if (asset.expiresAt > 0) ((asset.expiresAt - System.currentTimeMillis()) / 86_400_000L).coerceAtLeast(0) else null
        if (daysLeft != null) {
            Text(
                "${daysLeft}d",
                color = Color.White,
                style = MaterialTheme.typography.labelSmall,
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(4.dp)
                    .background(Color(0x99000000), MaterialTheme.shapes.extraSmall)
                    .padding(horizontal = 4.dp, vertical = 1.dp),
            )
        }
        if (isSelected) {
            Box(Modifier.fillMaxSize().background(Color(0x55000000)))
            Icon(
                Icons.Filled.CheckCircle,
                "Selected",
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.align(Alignment.TopStart).padding(6.dp),
            )
        }
    }
}
