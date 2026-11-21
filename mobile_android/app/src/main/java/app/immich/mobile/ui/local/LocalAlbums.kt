package app.immich.mobile.ui.local

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.immich.mobile.app
import app.immich.mobile.backup.BackupManager
import app.immich.mobile.backup.LocalAsset
import app.immich.mobile.backup.LocalMedia
import app.immich.mobile.backup.toItem
import app.immich.mobile.data.ListSource
import app.immich.mobile.ui.AssetSourceScreen
import app.immich.mobile.ui.SourceKind
import app.immich.mobile.ui.components.CenterMessage
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch

private fun BackupManager.LocalSnapshot.itemsOf(bucketId: String) =
    assets.filter { it.bucketId == bucketId }.map { asset ->
        val known = asset.cacheKey in checked || asset.cacheKey in backedUp
        asset.toItem(backedUp = if (known) asset.cacheKey in backedUp else null, remoteId = remoteIds[asset.cacheKey])
    }

/** The albums of the gallery of this device, with a badge on every photo that the server has. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocalAlbumsScreen(onBack: () -> Unit, onOpenAlbum: (bucketId: String) -> Unit) {
    val context = LocalContext.current
    val backup = context.app.backup
    val snapshot by backup.local.collectAsState()
    var granted by remember { mutableStateOf(LocalMedia.hasPermission(context)) }
    val scope = rememberCoroutineScope()
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        granted = LocalMedia.hasPermission(context)
        if (granted) scope.launch { backup.scanDevice() }
    }
    LaunchedEffect(granted) { if (granted && snapshot.assets.isEmpty()) backup.scanDevice() }

    val albums = remember(snapshot.assets) {
        snapshot.assets.groupBy { it.bucketId }
            .map { (id, list) -> Triple(id, list.first(), list.size) }
            .sortedWith(
                compareByDescending<Triple<String, LocalAsset, Int>> { it.second.bucketName == "Camera" }
                    .thenByDescending { it.third },
            )
    }

    Scaffold(
        contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0),
        topBar = {
            TopAppBar(
                title = { Text("On this device") },
                navigationIcon = { IconButton(onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
            )
        },
    ) { padding ->
        Box(
            Modifier
                .padding(padding)
                .fillMaxSize(),
        ) {
            when {
                !granted -> CenterMessage(
                    "Allow access to your photos",
                    detail = "Albums of this device show which photos are backed up",
                    action = "Allow access",
                    onAction = { permission.launch(LocalMedia.permissions()) },
                )

                albums.isEmpty() -> CenterMessage(if (snapshot.scanning) "Looking at your photos…" else "No photos on this device")
                else -> LazyVerticalGrid(
                    columns = GridCells.Adaptive(150.dp),
                    contentPadding = PaddingValues(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    items(albums, key = { it.first }) { (id, cover, count) ->
                        Column(Modifier.clickable { onOpenAlbum(id) }) {
                            Box(
                                Modifier
                                    .fillMaxWidth()
                                    .aspectRatio(1f)
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(MaterialTheme.colorScheme.surfaceVariant),
                            ) {
                                AsyncImage(
                                    model = cover.uri.toString(),
                                    contentDescription = null,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.fillMaxSize(),
                                )
                            }
                            Text(
                                cover.bucketName,
                                style = MaterialTheme.typography.titleSmall,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.padding(top = 6.dp),
                            )
                            Text(
                                "$count items",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
        }
    }
}

/** One album of the device. Pick photos to back them up, share them or delete them from the device. */
@Composable
fun LocalAlbumScreen(bucketId: String, onBack: () -> Unit, onOpen: (position: Int) -> Unit) {
    val app = LocalContext.current.app
    val snapshot by app.backup.local.collectAsState()
    val key = "device:$bucketId"
    val source = remember(bucketId) {
        (app.source(key) as? ListSource) ?: ListSource(snapshot.itemsOf(bucketId)).also { app.putSource(key, it) }
    }
    LaunchedEffect(snapshot) { source.replace(snapshot.itemsOf(bucketId)) }
    val title = snapshot.assets.firstOrNull { it.bucketId == bucketId }?.bucketName ?: "Album"

    AssetSourceScreen(
        title = title,
        source = source,
        kind = SourceKind.Library,
        emptyMessage = "This album is empty",
        onBack = onBack,
        onOpen = onOpen,
    )
}
