package app.immich.mobile.ui.library

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.immich.mobile.app
import app.immich.mobile.data.ImmichApi
import app.immich.mobile.data.ListSource
import app.immich.mobile.data.AssetDto
import app.immich.mobile.data.toItem
import app.immich.mobile.ui.AssetSourceScreen
import app.immich.mobile.ui.SourceKind
import app.immich.mobile.ui.components.CenterLoading
import app.immich.mobile.ui.components.CenterMessage

/** Every folder that holds photos of the user, as the server saw them when they were uploaded. */
private suspend fun ImmichApi.folderPaths(): List<String> = get("/view/folder/unique-paths")

private suspend fun ImmichApi.folderAssets(path: String): List<AssetDto> = get("/view/folder", mapOf("path" to path))

/** The longest folder that all [paths] share, so the browser does not open on a chain of empty system folders. */
private fun commonFolder(paths: List<String>): String {
    if (paths.isEmpty()) return ""
    val split = paths.map { it.split('/') }
    var common = split.first()
    for (parts in split.drop(1)) {
        val n = common.zip(parts).takeWhile { (a, b) -> a == b }.size
        common = common.take(n)
    }
    return common.joinToString("/")
}

/**
 * Folders, like the official Library list: browse the photos by the folder they were uploaded to. [path] is empty for
 * the top, otherwise the folder to show; its sub folders are listed above its photos.
 */
@Composable
fun FolderScreen(
    path: String,
    onBack: () -> Unit,
    onOpenFolder: (String) -> Unit,
    onOpenAsset: (key: String, position: Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val app = LocalContext.current.app
    var paths by remember { mutableStateOf<List<String>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val source = remember { ListSource(emptyList()) }

    LaunchedEffect(Unit) {
        try {
            paths = app.api.folderPaths().map { it.trimEnd('/') }
        } catch (e: Exception) {
            error = e.message ?: "Unable to load the folders"
        }
    }
    val all = paths
    if (all == null) {
        androidx.compose.material3.Scaffold(
            modifier = modifier,
            contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0),
            topBar = {
                @OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
                androidx.compose.material3.TopAppBar(
                    title = { Text("Folders") },
                    navigationIcon = {
                        androidx.compose.material3.IconButton(onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                        }
                    },
                )
            },
        ) { padding ->
            Box(Modifier.padding(padding)) {
                if (error != null) CenterMessage("Unable to load folders", detail = error) else CenterLoading()
            }
        }
        return
    }

    val current = path.ifEmpty { commonFolder(all) }
    val children = remember(all, current) {
        all.filter { it.startsWith("$current/") }
            .map { it.removePrefix("$current/").substringBefore('/') }
            .distinct()
            .sortedBy { it.lowercase() }
    }
    val hasPhotos = current in all
    LaunchedEffect(current, hasPhotos) {
        if (hasPhotos) {
            runCatching { app.api.folderAssets(current) }.onSuccess { list -> source.replace(list.map { it.toItem() }) }
        }
    }
    val key = "folder:$current"

    AssetSourceScreen(
        modifier = modifier,
        title = current.substringAfterLast('/').ifEmpty { "Folders" },
        source = source,
        kind = SourceKind.Library,
        emptyMessage = "No photos in this folder",
        onBack = onBack,
        onOpen = { position ->
            app.putSource(key, source)
            onOpenAsset(key, position)
        },
        header = if (children.isEmpty()) null else {
            {
                androidx.compose.foundation.layout.Column {
                    children.forEach { name ->
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clickable { onOpenFolder("$current/$name") }
                                .padding(horizontal = 20.dp, vertical = 16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(16.dp),
                        ) {
                            Icon(Icons.Filled.Folder, null, tint = MaterialTheme.colorScheme.primary)
                            Text(name, style = MaterialTheme.typography.titleSmall)
                        }
                    }
                }
            }
        },
    )
}
