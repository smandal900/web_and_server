package app.immich.mobile.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Share
import android.net.Uri
import app.immich.mobile.ui.local.shareUris
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PhotoAlbum
import androidx.compose.material.icons.filled.RestoreFromTrash
import androidx.compose.material.icons.filled.SelectAll
import androidx.compose.material.icons.filled.Unarchive
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import app.immich.mobile.app
import app.immich.mobile.data.AssetSource
import app.immich.mobile.data.TimelineSource
import app.immich.mobile.ui.albums.AlbumPickerDialog
import app.immich.mobile.ui.components.CenterLoading
import app.immich.mobile.ui.locked.rememberMoveToLocked
import app.immich.mobile.ui.sharing.ShareLinkFlow
import app.immich.mobile.ui.components.CenterMessage
import app.immich.mobile.ui.components.FlatGrid
import app.immich.mobile.ui.components.Selection
import app.immich.mobile.ui.components.TimelineGrid
import kotlinx.coroutines.launch

/** What a screen's assets are, which decides the actions offered for a selection. */
enum class SourceKind { Library, Album, Archive, Trash, Partner, Locked }

/**
 * A screen with a grid of assets, pull to refresh and multi-select. Used for the timeline, albums, people,
 * favorites, the archive, the trash and search results.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AssetSourceScreen(
    title: String,
    source: AssetSource,
    kind: SourceKind,
    onOpen: (position: Int) -> Unit,
    modifier: Modifier = Modifier,
    albumId: String? = null,
    onBack: (() -> Unit)? = null,
    contentPadding: PaddingValues = PaddingValues(),
    snackbar: SnackbarHostState = remember { SnackbarHostState() },
    showTopBar: Boolean = true,
    topBar: (@Composable () -> Unit)? = null,
    emptyMessage: String = "Nothing here yet",
    header: (@Composable () -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {},
) {
    val context = LocalContext.current
    val app = context.app
    val scope = rememberCoroutineScope()
    val selection = remember { Selection() }
    val assetActions = remember(source) { AssetActions(app, source, scope, snackbar) }
    var pickAlbum by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var menu by remember { mutableStateOf(false) }
    var linkIds by remember { mutableStateOf<List<String>?>(null) }
    val deleteEverywhere = rememberDeleteFlow(assetActions)
    val moveToLocked = rememberMoveToLocked(assetActions, snackbar, scope)

    BackHandler(enabled = selection.active) { selection.clear() }

    Scaffold(
        modifier = modifier,
        contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0),
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            if (selection.active) {
                TopAppBar(
                    title = { Text("${selection.count} selected") },
                    navigationIcon = {
                        IconButton({ selection.clear() }) { Icon(Icons.Filled.Close, "Clear selection") }
                    },
                    actions = {
                        val ids = selection.items.keys.toList()
                        val localItems = selection.items.values.filter { it.isLocal }
                        if (localItems.isNotEmpty()) {
                            IconButton({
                                shareUris(
                                    context,
                                    localItems.map { Uri.parse(it.localUri) },
                                    localItems.map { if (it.isVideo) "video/*" else "image/*" },
                                )
                            }) { Icon(Icons.Filled.Share, "Share") }
                            val pending = localItems.filter { it.backedUp != true }
                            if (pending.isNotEmpty() && app.session.isLoggedIn) {
                                IconButton({ assetActions.uploadLocal(pending) { selection.clear() } }) {
                                    Icon(Icons.Filled.CloudUpload, "Back up")
                                }
                            }
                            IconButton({ confirmDelete = true }) { Icon(Icons.Filled.Delete, "Delete") }
                        } else when (kind) {
                            SourceKind.Trash -> {
                                IconButton({ assetActions.restore(ids) { selection.clear() } }) {
                                    Icon(Icons.Filled.RestoreFromTrash, "Restore")
                                }
                                IconButton({ confirmDelete = true }) { Icon(Icons.Filled.DeleteForever, "Delete forever") }
                            }

                            SourceKind.Locked -> {
                                IconButton({ assetActions.setLocked(ids, false) { selection.clear() } }) {
                                    Icon(Icons.Filled.LockOpen, "Remove from the locked folder")
                                }
                                IconButton({ confirmDelete = true }) { Icon(Icons.Filled.Delete, "Delete") }
                            }

                            SourceKind.Partner -> {
                                IconButton({ pickAlbum = true }) { Icon(Icons.Filled.PhotoAlbum, "Add to album") }
                            }

                            SourceKind.Archive -> {
                                IconButton({ assetActions.setArchived(ids, false) { selection.clear() } }) {
                                    Icon(Icons.Filled.Unarchive, "Unarchive")
                                }
                                IconButton({ pickAlbum = true }) { Icon(Icons.Filled.PhotoAlbum, "Add to album") }
                                IconButton({ confirmDelete = true }) { Icon(Icons.Filled.Delete, "Delete") }
                            }

                            else -> {
                                val allFavorite = selection.items.values.all { it.isFavorite }
                                IconButton({ assetActions.setFavorite(ids, !allFavorite) { selection.clear() } }) {
                                    Icon(
                                        if (allFavorite) Icons.Filled.FavoriteBorder else Icons.Filled.Favorite,
                                        if (allFavorite) "Remove from favorites" else "Favorite",
                                    )
                                }
                                IconButton({ pickAlbum = true }) { Icon(Icons.Filled.PhotoAlbum, "Add to album") }
                                IconButton({ confirmDelete = true }) { Icon(Icons.Filled.Delete, "Delete") }
                                IconButton({ menu = true }) { Icon(Icons.Filled.MoreVert, "More") }
                                DropdownMenu(menu, { menu = false }) {
                                    DropdownMenuItem(
                                        text = { Text("Archive") },
                                        leadingIcon = { Icon(Icons.Filled.Archive, null) },
                                        onClick = {
                                            menu = false
                                            assetActions.setArchived(ids, true) { selection.clear() }
                                        },
                                    )
                                    DropdownMenuItem(
                                        text = { Text("Create link") },
                                        leadingIcon = { Icon(Icons.Filled.Link, null) },
                                        onClick = {
                                            menu = false
                                            linkIds = ids
                                        },
                                    )
                                    DropdownMenuItem(
                                        text = { Text("Move to locked folder") },
                                        leadingIcon = { Icon(Icons.Filled.Lock, null) },
                                        onClick = {
                                            menu = false
                                            moveToLocked(ids) { selection.clear() }
                                        },
                                    )
                                    if (selection.count >= 2) {
                                        DropdownMenuItem(
                                            text = { Text("Stack") },
                                            leadingIcon = { Icon(Icons.Filled.Layers, null) },
                                            onClick = {
                                                menu = false
                                                assetActions.stack(ids) { selection.clear() }
                                            },
                                        )
                                    }
                                    if (kind == SourceKind.Album && albumId != null) {
                                        DropdownMenuItem(
                                            text = { Text("Remove from album") },
                                            leadingIcon = { Icon(Icons.Filled.Close, null) },
                                            onClick = {
                                                menu = false
                                                assetActions.removeFromAlbum(albumId, ids) { selection.clear() }
                                            },
                                        )
                                    }
                                }
                            }
                        }
                    },
                )
            } else if (showTopBar && topBar != null) {
                topBar()
            } else if (showTopBar) {
                TopAppBar(
                    title = { Text(title) },
                    navigationIcon = {
                        if (onBack != null) {
                            IconButton(onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
                        }
                    },
                    actions = actions,
                )
            }
        },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = source.isLoading && source.size > 0,
            onRefresh = { scope.launch { source.refresh() } },
            modifier = Modifier
                .padding(padding)
                .fillMaxSize(),
        ) {
            when {
                source.size == 0 && source.isLoading -> CenterLoading()
                source.size == 0 && source.error != null -> CenterMessage(
                    title = "Unable to load",
                    detail = source.error,
                    action = "Try again",
                    onAction = { scope.launch { source.refresh() } },
                )

                source.size == 0 && header == null -> CenterMessage(emptyMessage)
                source is TimelineSource -> TimelineGrid(
                    source = source,
                    selection = selection,
                    onOpen = onOpen,
                    contentPadding = contentPadding,
                    header = header,
                )

                else -> FlatGrid(source, selection, onOpen, contentPadding = contentPadding, header = header)
            }
        }
    }

    linkIds?.let { ids ->
        ShareLinkFlow(assetIds = ids, albumId = null, onDismiss = { linkIds = null; selection.clear() })
    }

    if (pickAlbum) {
        AlbumPickerDialog(
            onDismiss = { pickAlbum = false },
            onPick = { id ->
                pickAlbum = false
                assetActions.addToAlbum(id, selection.items.keys.toList()) { selection.clear() }
            },
            onCreate = { name ->
                pickAlbum = false
                assetActions.addToNewAlbum(name, selection.items.keys.toList()) { selection.clear() }
            },
        )
    }

    if (confirmDelete) {
        val permanent = kind == SourceKind.Trash
        val count = selection.count
        // the files of this phone go to its bin, the copies on the server to the trash of the server
        val plan = remember { planDelete(app, selection.items.values) }
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text(if (permanent) "Delete forever?" else "Delete?") },
            text = {
                Text(
                    if (permanent) "$count selected items will be deleted for good."
                    else plan.message(),
                )
            },
            confirmButton = {
                TextButton({
                    confirmDelete = false
                    val ids = selection.items.keys.toList()
                    if (permanent) assetActions.deletePermanently(ids) { selection.clear() }
                    else deleteEverywhere(plan) { selection.clear() }
                }) { Text("Delete") }
            },
            dismissButton = { TextButton({ confirmDelete = false }) { Text("Cancel") } },
        )
    }
}
