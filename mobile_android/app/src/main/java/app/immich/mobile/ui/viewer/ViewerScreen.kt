package app.immich.mobile.ui.viewer

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.calculateCentroid
import androidx.compose.foundation.gestures.calculatePan
import androidx.compose.foundation.gestures.calculateZoom
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.Image
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.CloudUpload
import android.net.Uri
import app.immich.mobile.ui.planDelete
import app.immich.mobile.ui.rememberDeleteFlow
import app.immich.mobile.ui.local.shareUris
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material.icons.filled.LayersClear
import androidx.compose.material.icons.filled.Slideshow
import androidx.compose.material.icons.filled.MotionPhotosOn
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PhotoAlbum
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.RestoreFromTrash
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Unarchive
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.isSpecified
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChanged
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.PlayerView
import app.immich.mobile.app
import app.immich.mobile.data.AssetDto
import app.immich.mobile.data.AssetItem
import app.immich.mobile.data.PagedSource
import app.immich.mobile.data.deleteStack
import app.immich.mobile.data.setStackPrimary
import app.immich.mobile.data.stack
import app.immich.mobile.data.toItem
import app.immich.mobile.ui.components.ThumbHash
import kotlinx.coroutines.delay
import app.immich.mobile.ui.AssetActions
import app.immich.mobile.ui.SourceKind
import app.immich.mobile.ui.albums.ActivitySheet
import app.immich.mobile.ui.albums.AlbumPickerDialog
import app.immich.mobile.ui.locked.rememberMoveToLocked
import app.immich.mobile.ui.components.CenterLoading
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun ViewerScreen(
    sourceKey: String,
    startIndex: Int,
    kind: SourceKind,
    albumId: String?,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val app = context.app
    val source = remember(sourceKey) { app.source(sourceKey) }
    if (source == null) {
        LaunchedEffect(Unit) { onBack() }
        return
    }

    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }
    val actions = remember(source) { AssetActions(app, source, scope, snackbar) }
    val moveToLocked = rememberMoveToLocked(actions, snackbar, scope)
    val deleteEverywhere = rememberDeleteFlow(actions)
    val pager = rememberPagerState(initialPage = startIndex.coerceIn(0, (source.size - 1).coerceAtLeast(0))) { source.size }
    var chrome by remember { mutableStateOf(true) }
    var info by remember { mutableStateOf(false) }
    var menu by remember { mutableStateOf(false) }
    var pickAlbum by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var working by remember { mutableStateOf(false) }
    var slideshow by remember { mutableStateOf(false) }
    var chooseShareQuality by remember { mutableStateOf(false) }
    var activity by remember { mutableStateOf(false) }
    // the stack member that is shown instead of the stack's cover, keyed by the cover's id
    val stackChoice = remember { mutableStateMapOf<String, AssetItem>() }
    val stackMembers = remember { mutableStateMapOf<String, List<AssetItem>>() }

    if (source.size == 0) {
        LaunchedEffect(Unit) { onBack() }
        return
    }

    val currentBase: AssetItem? = source.itemAt(pager.currentPage)
    val current: AssetItem? = currentBase?.let { stackChoice[it.id] ?: it }
    LaunchedEffect(pager.currentPage, source.size) { (source as? PagedSource)?.loadMoreNear(pager.currentPage) }

    LaunchedEffect(currentBase?.id) {
        val base = currentBase ?: return@LaunchedEffect
        val stackId = base.stackId
        if (base.stackCount > 1 && stackId != null && base.id !in stackMembers) {
            runCatching { app.api.stack(stackId) }.onSuccess { stack ->
                stackMembers[base.id] = stack.assets.map { it.toItem() }
            }
        }
    }

    LaunchedEffect(slideshow) {
        while (slideshow) {
            delay(app.prefs.slideshowSeconds * 1000L)
            if (!slideshow) break
            val last = source.size - 1
            val target = when (app.prefs.slideshowDirection) {
                "backward" -> pager.currentPage - 1
                "shuffle" -> if (last > 0) (0..last).filter { it != pager.currentPage }.random() else 0
                else -> pager.currentPage + 1
            }
            when {
                target in 0..last -> pager.animateScrollToPage(target)
                app.prefs.slideshowRepeat -> pager.animateScrollToPage(if (target < 0) last else 0)
                else -> {
                    slideshow = false
                    chrome = true
                }
            }
        }
    }

    BackHandler {
        if (slideshow) {
            slideshow = false
            chrome = true
        } else {
            onBack()
        }
    }

    val toggleChrome = {
        if (slideshow) {
            slideshow = false
            chrome = true
        } else {
            chrome = !chrome
        }
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black),
    ) {
        HorizontalPager(
            state = pager,
            beyondViewportPageCount = 1,
            key = { page -> source.itemAt(page)?.id ?: "page-$page" },
            modifier = Modifier.fillMaxSize(),
        ) { page ->
            val base = source.itemAt(page)
            val item = base?.let { stackChoice[it.id] ?: it }
            when {
                item == null -> CenterLoading()
                item.isVideo -> VideoPage(item, active = pager.settledPage == page, onTap = toggleChrome)
                else -> ImagePage(
                    item,
                    onTap = toggleChrome,
                    slideshow = slideshow,
                    onNavigate = { step -> scope.launch { pager.animateScrollToPage((pager.currentPage + step).coerceIn(0, source.size - 1)) } },
                )
            }
        }

        val members = currentBase?.let { stackMembers[it.id] }
        AnimatedVisibility(
            visible = chrome && members != null && members.size > 1,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.align(Alignment.BottomCenter),
        ) {
            if (members != null && currentBase != null) {
                StackStrip(
                    members = members,
                    selectedId = current?.id,
                    onSelect = { stackChoice[currentBase.id] = it },
                )
            }
        }

        AnimatedVisibility(
            visible = chrome,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.align(Alignment.TopCenter),
        ) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(Color(0x66000000))
                    .statusBarsPadding()
                    .padding(horizontal = 4.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                val tint = IconButtonDefaults.iconButtonColors(contentColor = Color.White)
                IconButton(onBack, colors = tint) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
                Box(Modifier.weight(1f))
                if (current != null && app.prefs.readOnlyMode) {
                    // read-only mode: the photo can be looked at and its details read, nothing else
                    if (!current.isLocal) IconButton({ info = true }, colors = tint) { Icon(Icons.Filled.Info, "Info") }
                } else if (current != null) {
                    if (current.isLocal) {
                        val localUri = Uri.parse(current.localUri)
                        IconButton({
                            shareUris(context, listOf(localUri), listOf(if (current.isVideo) "video/*" else "image/*"))
                        }, colors = tint) { Icon(Icons.Filled.Share, "Share") }
                        if (current.backedUp != true && app.session.isLoggedIn) {
                            IconButton({ actions.uploadLocal(listOf(current)) }, colors = tint) {
                                Icon(Icons.Filled.CloudUpload, "Back up")
                            }
                        }
                        IconButton({ confirmDelete = true }, colors = tint) { Icon(Icons.Filled.Delete, "Delete") }
                    } else if (kind == SourceKind.Trash) {
                        IconButton({ actions.restore(listOf(current.id)) }, colors = tint) {
                            Icon(Icons.Filled.RestoreFromTrash, "Restore")
                        }
                        IconButton({ confirmDelete = true }, colors = tint) { Icon(Icons.Filled.DeleteForever, "Delete forever") }
                    } else {
                        if (kind != SourceKind.Partner) IconButton({ actions.setFavorite(listOf(current.id), !current.isFavorite) }, colors = tint) {
                            Icon(
                                if (current.isFavorite) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                                if (current.isFavorite) "Remove from favorites" else "Favorite",
                            )
                        }
                        // a tap shares with the default quality of Settings > Preferences, a long press asks
                        Box(
                            Modifier
                                .size(48.dp)
                                .clip(androidx.compose.foundation.shape.CircleShape)
                                .combinedClickable(
                                    onClick = {
                                        scope.launch {
                                            working = true
                                            try {
                                                AssetFiles.share(context, listOf(current.id))
                                            } catch (e: Exception) {
                                                snackbar.showSnackbar(e.message ?: "Unable to share")
                                            } finally {
                                                working = false
                                            }
                                        }
                                    },
                                    onLongClick = { chooseShareQuality = true },
                                ),
                            contentAlignment = Alignment.Center,
                        ) { Icon(Icons.Filled.Share, "Share", tint = Color.White) }
                        IconButton({ info = true }, colors = tint) { Icon(Icons.Filled.Info, "Info") }
                        if (kind != SourceKind.Partner) {
                            IconButton({ confirmDelete = true }, colors = tint) { Icon(Icons.Filled.Delete, "Delete") }
                        }
                        if (albumId != null) {
                            IconButton({ activity = true }, colors = tint) { Icon(Icons.Filled.ChatBubbleOutline, "Comments") }
                        }
                        IconButton({ menu = true }, colors = tint) { Icon(Icons.Filled.MoreVert, "More") }
                        DropdownMenu(menu, { menu = false }) {
                            DropdownMenuItem(
                                text = { Text("Add to album") },
                                leadingIcon = { Icon(Icons.Filled.PhotoAlbum, null) },
                                onClick = {
                                    menu = false
                                    pickAlbum = true
                                },
                            )
                            DropdownMenuItem(
                                text = { Text("Save to device") },
                                leadingIcon = { Icon(Icons.Filled.Download, null) },
                                onClick = {
                                    menu = false
                                    scope.launch {
                                        working = true
                                        try {
                                            AssetFiles.saveToDevice(context, current.id)
                                            snackbar.showSnackbar("Saved to the gallery")
                                        } catch (e: Exception) {
                                            snackbar.showSnackbar(e.message ?: "Unable to save")
                                        } finally {
                                            working = false
                                        }
                                    }
                                },
                            )
                            val archived = kind == SourceKind.Archive
                            DropdownMenuItem(
                                text = { Text(if (archived) "Unarchive" else "Archive") },
                                leadingIcon = {
                                    Icon(if (archived) Icons.Filled.Unarchive else Icons.Filled.Archive, null)
                                },
                                onClick = {
                                    menu = false
                                    actions.setArchived(listOf(current.id), !archived)
                                },
                            )
                            if (kind == SourceKind.Locked) {
                                DropdownMenuItem(
                                    text = { Text("Remove from locked folder") },
                                    leadingIcon = { Icon(Icons.Filled.LockOpen, null) },
                                    onClick = {
                                        menu = false
                                        actions.setLocked(listOf(current.id), false)
                                    },
                                )
                            } else if (kind != SourceKind.Partner) {
                                DropdownMenuItem(
                                    text = { Text("Move to locked folder") },
                                    leadingIcon = { Icon(Icons.Filled.Lock, null) },
                                    onClick = {
                                        menu = false
                                        moveToLocked(listOf(current.id)) {}
                                    },
                                )
                            }
                            DropdownMenuItem(
                                text = { Text("Slideshow") },
                                leadingIcon = { Icon(Icons.Filled.Slideshow, null) },
                                onClick = {
                                    menu = false
                                    chrome = false
                                    slideshow = true
                                },
                            )
                            val stackId = currentBase?.stackId
                            if (currentBase != null && stackId != null && currentBase.stackCount > 1) {
                                DropdownMenuItem(
                                    text = { Text("Unstack") },
                                    leadingIcon = { Icon(Icons.Filled.LayersClear, null) },
                                    onClick = {
                                        menu = false
                                        scope.launch {
                                            runCatching { app.api.deleteStack(stackId) }
                                                .onSuccess {
                                                    stackMembers.remove(currentBase.id)
                                                    stackChoice.remove(currentBase.id)
                                                    source.refresh()
                                                    snackbar.showSnackbar("Stack removed")
                                                }
                                                .onFailure { snackbar.showSnackbar(it.message ?: "Unable to unstack") }
                                        }
                                    },
                                )
                                if (current.id != currentBase.id) {
                                    DropdownMenuItem(
                                        text = { Text("Make stack cover") },
                                        leadingIcon = { Icon(Icons.Filled.Layers, null) },
                                        onClick = {
                                            menu = false
                                            scope.launch {
                                                runCatching { app.api.setStackPrimary(stackId, current.id) }
                                                    .onSuccess {
                                                        stackMembers.remove(currentBase.id)
                                                        stackChoice.remove(currentBase.id)
                                                        source.refresh()
                                                    }
                                                    .onFailure { snackbar.showSnackbar(it.message ?: "Unable to change the cover") }
                                            }
                                        },
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        if (working) {
            CenterLoading(Modifier.align(Alignment.Center))
        }

        SnackbarHost(
            snackbar,
            Modifier
                .align(Alignment.BottomCenter)
                .navigationBarsPadding(),
        )
    }

    if (activity && current != null && albumId != null) {
        ActivitySheet(albumId, current.id, onDismiss = { activity = false })
    }

    if (info && current != null) {
        InfoSheet(current.id, onDismiss = { info = false })
    }

    if (pickAlbum && current != null) {
        AlbumPickerDialog(
            onDismiss = { pickAlbum = false },
            onPick = {
                pickAlbum = false
                actions.addToAlbum(it, listOf(current.id))
            },
            onCreate = {
                pickAlbum = false
                actions.addToNewAlbum(it, listOf(current.id))
            },
        )
    }

    if (chooseShareQuality && current != null) {
        // long press on Share: pick the quality for this share only
        AlertDialog(
            onDismissRequest = { chooseShareQuality = false },
            title = { Text("Default share quality") },
            text = { Text("Quality used when tapping share. Long press the share button to choose each time.") },
            confirmButton = {
                TextButton({
                    chooseShareQuality = false
                    scope.launch {
                        working = true
                        try {
                            AssetFiles.share(context, listOf(current.id), original = true)
                        } catch (e: Exception) {
                            snackbar.showSnackbar(e.message ?: "Unable to share")
                        } finally {
                            working = false
                        }
                    }
                }) { Text("Use original (large)") }
            },
            dismissButton = {
                TextButton({
                    chooseShareQuality = false
                    scope.launch {
                        working = true
                        try {
                            AssetFiles.share(context, listOf(current.id), original = false)
                        } catch (e: Exception) {
                            snackbar.showSnackbar(e.message ?: "Unable to share")
                        } finally {
                            working = false
                        }
                    }
                }) { Text("Use thumbnail (small)") }
            },
        )
    }

    if (confirmDelete && current != null) {
        val permanent = kind == SourceKind.Trash
        // the file of this phone goes to its bin, the copy on the server to the trash of the server
        val plan = remember(current.id) { planDelete(app, listOf(current)) }
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text(if (permanent) "Delete forever?" else "Delete?") },
            text = { if (!permanent) Text(plan.message()) },
            confirmButton = {
                TextButton({
                    confirmDelete = false
                    if (permanent) actions.deletePermanently(listOf(current.id)) else deleteEverywhere(plan) { }
                }) { Text("Delete") }
            },
            dismissButton = { TextButton({ confirmDelete = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun ImagePage(item: AssetItem, onTap: () -> Unit, slideshow: Boolean = false, onNavigate: (Int) -> Unit = {}) {
    val api = LocalContext.current.app.api
    val prefs = LocalContext.current.app.prefs
    val remote = if (prefs.preferRemoteImage) item.remoteId else null
    val liveId = item.livePhotoVideoId
    var playingLive by remember(item.id) { mutableStateOf(false) }

    Box(Modifier.fillMaxSize()) {
        ZoomableBox(onTap = onTap, onLongPress = { if (liveId != null) playingLive = true }, onNavigate = onNavigate) {
            // slideshow look: contain (default), cover, or contain over a blurred copy of the photo
            val look = if (slideshow) prefs.slideshowLook else "contain"
            val fit = if (look == "cover") ContentScale.Crop else ContentScale.Fit
            if (look == "blurred") {
                AsyncImage(
                    model = remote?.let { api.thumbnailUrl(it) } ?: item.localUri ?: api.thumbnailUrl(item.id, item.thumbhash),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxSize()
                        .blur(40.dp),
                )
            }
            ThumbHash.placeholder(item.thumbhash)?.let {
                Image(it, null, contentScale = fit, modifier = Modifier.fillMaxSize())
            }
            // the thumbnail is in the cache already, so something shows while the larger preview loads
            AsyncImage(
                model = remote?.let { api.thumbnailUrl(it) } ?: item.localUri ?: api.thumbnailUrl(item.id, item.thumbhash),
                contentDescription = null,
                contentScale = fit,
                modifier = Modifier.fillMaxSize(),
            )
            AsyncImage(
                model = remote?.let { api.previewUrl(it) } ?: item.localUri ?: api.previewUrl(item.id, item.thumbhash),
                contentDescription = null,
                contentScale = fit,
                modifier = Modifier.fillMaxSize(),
            )
            // the full file on top, when the user asked for it (the preview stays visible if it cannot be decoded)
            if (prefs.loadOriginalImage && item.localUri == null) {
                AsyncImage(
                    model = api.originalUrl(item.id),
                    contentDescription = null,
                    contentScale = fit,
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }
        if (liveId != null) {
            if (playingLive) LivePhotoPlayer(api.videoUrl(liveId), onEnded = { playingLive = false })
            Row(
                Modifier
                    .align(Alignment.TopStart)
                    .statusBarsPadding()
                    .padding(start = 12.dp, top = 60.dp)
                    .clip(RoundedCornerShape(50))
                    .background(Color(0x66000000))
                    .clickable { playingLive = !playingLive }
                    .padding(horizontal = 10.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Filled.MotionPhotosOn, null, tint = Color.White, modifier = Modifier.size(16.dp))
                Text(" LIVE", color = Color.White, style = MaterialTheme.typography.labelMedium)
            }
        }
    }
}

/** Plays the short clip of a live photo over its still image, once. */
@androidx.annotation.OptIn(UnstableApi::class)
@Composable
internal fun LivePhotoPlayer(url: String, onEnded: () -> Unit) {
    val context = LocalContext.current
    val api = context.app.api
    val player = remember(url) {
        ExoPlayer.Builder(context)
            .setMediaSourceFactory(DefaultMediaSourceFactory(OkHttpDataSource.Factory(api.client)))
            .build()
            .apply {
                setMediaItem(MediaItem.fromUri(url))
                playWhenReady = true
                prepare()
            }
    }
    DisposableEffect(player) {
        val listener = object : androidx.media3.common.Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                if (state == androidx.media3.common.Player.STATE_ENDED) onEnded()
            }

            override fun onPlayerError(error: androidx.media3.common.PlaybackException) = onEnded()
        }
        player.addListener(listener)
        onDispose {
            player.removeListener(listener)
            player.release()
        }
    }
    AndroidView(
        factory = {
            PlayerView(it).apply {
                this.player = player
                useController = false
                setBackgroundColor(android.graphics.Color.BLACK)
            }
        },
        modifier = Modifier.fillMaxSize(),
    )
}

@Composable
private fun StackStrip(members: List<AssetItem>, selectedId: String?, onSelect: (AssetItem) -> Unit) {
    val api = LocalContext.current.app.api
    LazyRow(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0x66000000))
            .navigationBarsPadding()
            .padding(vertical = 8.dp),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp),
        horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(6.dp),
    ) {
        items(members, key = { it.id }) { member ->
            val selected = member.id == selectedId
            Box(
                Modifier
                    .size(56.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .then(if (selected) Modifier.border(2.dp, Color.White, RoundedCornerShape(8.dp)) else Modifier)
                    .clickable { onSelect(member) },
            ) {
                AsyncImage(
                    model = api.thumbnailUrl(member.id, member.thumbhash),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }
    }
}

@Composable
private fun ZoomableBox(
    onTap: () -> Unit,
    onLongPress: () -> Unit = {},
    onNavigate: (Int) -> Unit = {},
    content: @Composable () -> Unit,
) {
    val tapToNavigate = LocalContext.current.app.prefs.tapToNavigate
    var scale by remember { mutableFloatStateOf(1f) }
    var offset by remember { mutableStateOf(Offset.Zero) }
    var size by remember { mutableStateOf(IntSize.Zero) }

    fun clamp(value: Offset, forScale: Float): Offset {
        val maxX = size.width * (forScale - 1) / 2f
        val maxY = size.height * (forScale - 1) / 2f
        return Offset(value.x.coerceIn(-maxX, maxX), value.y.coerceIn(-maxY, maxY))
    }

    Box(
        Modifier
            .fillMaxSize()
            .onSizeChanged { size = it }
            .pointerInput(Unit) {
                detectTapGestures(
                    onTap = { tap ->
                        // with tap to navigate the left and right quarters turn the page, the middle toggles the controls
                        when {
                            !tapToNavigate || scale > 1.02f || size.width == 0 -> onTap()
                            tap.x < size.width / 4f -> onNavigate(-1)
                            tap.x > size.width * 3f / 4f -> onNavigate(1)
                            else -> onTap()
                        }
                    },
                    onLongPress = { onLongPress() },
                    onDoubleTap = { tap ->
                        if (scale > 1f) {
                            scale = 1f
                            offset = Offset.Zero
                        } else {
                            val center = Offset(size.width / 2f, size.height / 2f)
                            scale = 2.5f
                            offset = clamp((tap - center) * (1 - scale), scale)
                        }
                    },
                )
            }
            .pointerInput(Unit) {
                awaitEachGesture {
                    awaitFirstDown(requireUnconsumed = false)
                    do {
                        val event = awaitPointerEvent()
                        val pressed = event.changes.count { it.pressed }
                        if (pressed > 1 || scale > 1f) {
                            val zoom = event.calculateZoom()
                            val pan = event.calculatePan()
                            val centroid = event.calculateCentroid(useCurrent = false)
                            val newScale = (scale * zoom).coerceIn(1f, 6f)
                            val factor = newScale / scale
                            val center = Offset(size.width / 2f, size.height / 2f)
                            val around = if (centroid.isSpecified) centroid - center else Offset.Zero
                            offset = clamp(around * (1 - factor) + offset * factor + pan, newScale)
                            scale = newScale
                            event.changes.forEach { if (it.positionChanged()) it.consume() }
                        }
                    } while (event.changes.any { it.pressed })
                    if (scale < 1.02f) {
                        scale = 1f
                        offset = Offset.Zero
                    }
                }
            },
    ) {
        Box(
            Modifier
                .fillMaxSize()
                .graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                    translationX = offset.x
                    translationY = offset.y
                },
        ) { content() }
    }
}


@androidx.annotation.OptIn(UnstableApi::class)
@Composable
private fun VideoPage(item: AssetItem, active: Boolean, onTap: () -> Unit) {
    val prefs = LocalContext.current.app.prefs
    val context = LocalContext.current
    val api = context.app.api

    if (!active) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            AsyncImage(
                model = api.previewUrl(item.id, item.thumbhash),
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize(),
            )
            Icon(Icons.Filled.PlayCircle, null, tint = Color.White, modifier = Modifier.size(64.dp))
        }
        return
    }

    val player = remember(item.id) {
        ExoPlayer.Builder(context)
            .setMediaSourceFactory(
                if (item.isLocal) DefaultMediaSourceFactory(context) else DefaultMediaSourceFactory(OkHttpDataSource.Factory(api.client)),
            )
            .build()
            .apply {
                setMediaItem(MediaItem.fromUri(item.localUri ?: if (prefs.loadOriginalVideo) api.originalUrl(item.id) else api.videoUrl(item.id)))
                repeatMode = if (prefs.loopVideo) androidx.media3.common.Player.REPEAT_MODE_ONE else androidx.media3.common.Player.REPEAT_MODE_OFF
                playWhenReady = prefs.autoPlayVideo
                prepare()
            }
    }
    DisposableEffect(player) { onDispose { player.release() } }

    AndroidView(
        factory = { PlayerView(it).apply { this.player = player; setBackgroundColor(android.graphics.Color.BLACK) } },
        modifier = Modifier.fillMaxSize(),
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun InfoSheet(id: String, onDismiss: () -> Unit, onEdited: () -> Unit = {}) {
    val app = LocalContext.current.app
    val api = app.api
    var asset by remember(id) { mutableStateOf<AssetDto?>(null) }
    var error by remember(id) { mutableStateOf<String?>(null) }
    var reload by remember { mutableStateOf(0) }
    var editDetails by remember { mutableStateOf(false) }
    var editImage by remember { mutableStateOf(false) }
    LaunchedEffect(id, reload) {
        try {
            asset = api.asset(id)
        } catch (e: Exception) {
            error = e.message ?: "Unable to load the details"
        }
    }

    asset?.let { dto ->
        if (editDetails) {
            EditDetailsDialog(dto, onDismiss = { editDetails = false }, onSaved = { editDetails = false; reload++; onEdited() })
        }
        if (editImage) {
            EditImageDialog(dto, onDismiss = { editImage = false }, onApplied = { editImage = false; reload++; onEdited() })
        }
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 32.dp),
        ) {
            val dto = asset
            when {
                dto != null -> {
                    Text(dto.originalFileName, style = MaterialTheme.typography.titleMedium)
                    val exif = dto.exifInfo
                    InfoRow("Taken", formatDate(exif?.dateTimeOriginal ?: dto.fileCreatedAt))
                    InfoRow(
                        "Size",
                        listOfNotNull(
                            exif?.fileSizeInByte?.let(::formatBytes),
                            (dto.width ?: exif?.exifImageWidth)?.let { w -> (dto.height ?: exif?.exifImageHeight)?.let { "$w × $it" } },
                        ).joinToString(" · ").ifBlank { null },
                    )
                    InfoRow("Camera", listOfNotNull(exif?.make, exif?.model).joinToString(" ").ifBlank { null })
                    InfoRow("Lens", exif?.lensModel)
                    InfoRow(
                        "Exposure",
                        listOfNotNull(
                            exif?.fNumber?.let { "ƒ/$it" },
                            exif?.exposureTime?.let { "$it s" },
                            exif?.focalLength?.let { "$it mm" },
                            exif?.iso?.takeIf { it > 0 }?.let { "ISO $it" },
                        ).joinToString("  ").ifBlank { null },
                    )
                    InfoRow("Place", listOfNotNull(exif?.city, exif?.state, exif?.country).joinToString(", ").ifBlank { null })
                    InfoRow("People", dto.people.mapNotNull { it.name.ifBlank { null } }.joinToString(", ").ifBlank { null })
                    InfoRow("Description", exif?.description?.ifBlank { null })
                    exif?.rating?.takeIf { it > 0 }?.let { InfoRow("Rating", "★".repeat(it)) }
                    if (app.prefs.troubleshooting) {
                        // Settings > Advanced > Troubleshooting
                        InfoRow("Asset ID", dto.id)
                        InfoRow("Type", dto.type)
                        InfoRow("Mime type", dto.originalMimeType)
                        InfoRow("Owner ID", dto.ownerId)
                    }
                    if (dto.ownerId == null || dto.ownerId == app.session.userId) {
                        TagsEditor(dto, onChanged = { reload++ })
                        Row(Modifier.padding(top = 8.dp)) {
                            TextButton({ editDetails = true }) { Text("Edit details") }
                            if (dto.type == "IMAGE") TextButton({ editImage = true }) { Text("Edit photo") }
                        }
                    }
                }

                error != null -> Text(error!!, color = MaterialTheme.colorScheme.error)
                else -> CenterLoading(Modifier.size(64.dp))
            }
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String?) {
    if (value.isNullOrBlank()) return
    Column(Modifier.padding(top = 12.dp)) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyLarge)
    }
}

private fun formatDate(value: String?): String? = value?.let {
    runCatching {
        OffsetDateTime.parse(it).atZoneSameInstant(java.time.ZoneId.systemDefault())
            .format(DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT).withLocale(Locale.getDefault()))
    }.getOrDefault(it)
}

private fun formatBytes(bytes: Long): String {
    if (bytes < 1024) return "$bytes B"
    val units = listOf("KB", "MB", "GB", "TB")
    var value = bytes.toDouble()
    var unit = -1
    while (value >= 1024 && unit < units.lastIndex) {
        value /= 1024
        unit++
    }
    return "%.1f %s".format(value, units[unit])
}
