package app.immich.mobile.ui.albums

import app.immich.mobile.ui.components.ImmichTopBar
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.PhotoAlbum
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.automirrored.filled.ViewList
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.IconButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.ui.graphics.Color
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.immich.mobile.app
import app.immich.mobile.data.AlbumDto
import app.immich.mobile.ui.components.CenterLoading
import app.immich.mobile.ui.components.CenterMessage
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch

@Composable
fun rememberAlbums(): Triple<List<AlbumDto>?, String?, () -> Unit> {
    val api = LocalContext.current.app.api
    var albums by remember { mutableStateOf<List<AlbumDto>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var reload by remember { mutableStateOf(0) }
    LaunchedEffect(reload) {
        try {
            albums = api.albums().sortedByDescending { it.updatedAt }
            error = null
        } catch (e: Exception) {
            error = e.message ?: "Unable to load albums"
        }
    }
    return Triple(albums, error) { reload++ }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AlbumsScreen(onOpenAlbum: (AlbumDto) -> Unit, onNavigate: (String) -> Unit = {}, modifier: Modifier = Modifier) {
    val app = LocalContext.current.app
    val scope = rememberCoroutineScope()
    val (albums, error, reload) = rememberAlbums()
    var creating by remember { mutableStateOf(false) }
    var query by remember { mutableStateOf("") }
    var filter by remember { mutableStateOf(AlbumFilter.All) }
    var sort by remember { mutableStateOf(AlbumSort.MostRecentPhoto) }
    var grid by remember { mutableStateOf(true) }

    Scaffold(
        modifier = modifier,
        contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0),
        topBar = {
            ImmichTopBar(onNavigate = onNavigate, actions = {
                androidx.compose.material3.IconButton({ creating = true }) { Icon(Icons.Filled.Add, "New album") }
            })
        },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = false,
            onRefresh = reload,
            modifier = Modifier
                .padding(padding)
                .fillMaxSize(),
        ) {
            when {
                albums == null && error == null -> CenterLoading()
                albums == null -> CenterMessage("Unable to load albums", detail = error, action = "Try again", onAction = reload)
                else -> {
                    val shown = albums
                        .filter { filter.matches(it, app.session.userId) }
                        .filter { query.isBlank() || it.albumName.contains(query.trim(), ignoreCase = true) }
                        .let { sort.apply(it) }
                    Column(Modifier.fillMaxSize()) {
                        AlbumControls(
                            query = query, onQuery = { query = it },
                            filter = filter, onFilter = { filter = it },
                            sort = sort, onSort = { sort = it },
                            grid = grid, onToggleGrid = { grid = !grid },
                        )
                        if (shown.isEmpty()) {
                            CenterMessage("No albums found matching your search")
                        } else if (grid) {
                            LazyVerticalGrid(
                                columns = GridCells.Adaptive(160.dp),
                                contentPadding = PaddingValues(12.dp),
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                verticalArrangement = Arrangement.spacedBy(16.dp),
                            ) {
                                items(shown, key = { it.id }) { album -> AlbumCard(album) { onOpenAlbum(album) } }
                            }
                        } else {
                            LazyColumn(contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                items(shown, key = { it.id }) { album -> AlbumRow(album) { onOpenAlbum(album) } }
                            }
                        }
                    }
                }
            }
        }
    }

    if (creating) {
        NameDialog(
            title = "New album",
            confirm = "Create",
            onDismiss = { creating = false },
            onConfirm = { name ->
                creating = false
                scope.launch {
                    runCatching { app.api.createAlbum(name) }.onSuccess { onOpenAlbum(it) }
                    reload()
                }
            },
        )
    }
}

/** The chips under the search field, like the official Albums page. */
enum class AlbumFilter(val label: String) {
    All("All"), SharedWithMe("Shared with me"), Mine("My albums");

    fun matches(album: AlbumDto, userId: String) = when (this) {
        All -> true
        SharedWithMe -> album.ownerId != null && album.ownerId != userId
        Mine -> album.ownerId == null || album.ownerId == userId
    }
}

enum class AlbumSort(val label: String) {
    MostRecentPhoto("Most recent photo"), LastModified("Last modified"), Created("Created"), Title("Album title"), ItemCount("Number of items");

    fun apply(albums: List<AlbumDto>): List<AlbumDto> = when (this) {
        MostRecentPhoto -> albums.sortedByDescending { it.endDate ?: "" }
        LastModified -> albums.sortedByDescending { it.updatedAt ?: "" }
        Created -> albums.sortedByDescending { it.startDate ?: "" }
        Title -> albums.sortedBy { it.albumName.lowercase() }
        ItemCount -> albums.sortedByDescending { it.assetCount }
    }
}

@Composable
private fun AlbumControls(
    query: String, onQuery: (String) -> Unit,
    filter: AlbumFilter, onFilter: (AlbumFilter) -> Unit,
    sort: AlbumSort, onSort: (AlbumSort) -> Unit,
    grid: Boolean, onToggleGrid: () -> Unit,
) {
    var sortMenu by remember { mutableStateOf(false) }
    Column {
        TextField(
            value = query,
            onValueChange = onQuery,
            placeholder = { Text("Search albums") },
            leadingIcon = { Icon(Icons.Filled.Search, null) },
            trailingIcon = { if (query.isNotEmpty()) IconButton({ onQuery("") }) { Icon(Icons.Filled.Clear, "Clear") } },
            singleLine = true,
            shape = RoundedCornerShape(28.dp),
            colors = TextFieldDefaults.colors(
                focusedIndicatorColor = Color.Transparent,
                unfocusedIndicatorColor = Color.Transparent,
                disabledIndicatorColor = Color.Transparent,
                focusedContainerColor = MaterialTheme.colorScheme.surfaceContainer,
                unfocusedContainerColor = MaterialTheme.colorScheme.surfaceContainer,
            ),
            modifier = Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 8.dp),
        )
        Row(Modifier.padding(horizontal = 12.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            AlbumFilter.entries.forEach { f ->
                FilterChip(
                    selected = filter == f,
                    onClick = { onFilter(f) },
                    label = { Text(f.label) },
                    shape = RoundedCornerShape(50),
                )
            }
        }
        Row(Modifier.fillMaxWidth().padding(start = 12.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Box {
                Row(Modifier.clickable { sortMenu = true }.padding(vertical = 8.dp, horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.KeyboardArrowUp, null, Modifier.size(22.dp))
                    Text(sort.label, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(start = 8.dp))
                }
                DropdownMenu(sortMenu, { sortMenu = false }) {
                    AlbumSort.entries.forEach { s ->
                        DropdownMenuItem(text = { Text(s.label) }, onClick = { onSort(s); sortMenu = false })
                    }
                }
            }
            Box(Modifier.weight(1f))
            IconButton(onToggleGrid) {
                Icon(if (grid) Icons.AutoMirrored.Filled.ViewList else Icons.Filled.GridView, if (grid) "List layout" else "Grid layout")
            }
        }
    }
}

@Composable
private fun AlbumRow(album: AlbumDto, onClick: () -> Unit) {
    val api = LocalContext.current.app.api
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick), verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier.size(72.dp).clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.PhotoAlbum, null, tint = MaterialTheme.colorScheme.outline)
            album.albumThumbnailAssetId?.let { id ->
                AsyncImage(api.thumbnailUrl(id), null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
            }
        }
        Column(Modifier.padding(start = 12.dp)) {
            Text(album.albumName.ifBlank { "Untitled" }, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(
                "${album.assetCount} items" + if (album.shared) " · Shared" else "",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun AlbumCard(album: AlbumDto, onClick: () -> Unit) {
    val api = LocalContext.current.app.api
    Column(Modifier.clickable(onClick = onClick)) {
        Box(
            Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
                .clip(RoundedCornerShape(16.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center,
        ) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.PhotoAlbum, null, tint = MaterialTheme.colorScheme.outline, modifier = Modifier.size(40.dp))
            }
            album.albumThumbnailAssetId?.let { id ->
                AsyncImage(
                    model = api.thumbnailUrl(id),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }
        Text(
            album.albumName.ifBlank { "Untitled" },
            style = MaterialTheme.typography.titleSmall,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 6.dp),
        )
        Text(
            "${album.assetCount} items" + if (album.shared) " · Shared" else "",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
fun NameDialog(
    title: String,
    confirm: String,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit,
    initial: String = "",
) {
    var name by remember { mutableStateOf(initial) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Name") },
                singleLine = true,
            )
        },
        confirmButton = {
            TextButton({ onConfirm(name.trim()) }, enabled = name.isNotBlank()) { Text(confirm) }
        },
        dismissButton = { TextButton(onDismiss) { Text("Cancel") } },
    )
}

/** Lets the user pick one of their albums, or start a new one, for the selected assets. */
@Composable
fun AlbumPickerDialog(onDismiss: () -> Unit, onPick: (albumId: String) -> Unit, onCreate: (name: String) -> Unit) {
    val (albums, error, _) = rememberAlbums()
    var creating by remember { mutableStateOf(false) }

    if (creating) {
        NameDialog("New album", "Create", onDismiss = { creating = false }, onConfirm = onCreate)
        return
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add to album") },
        text = {
            when {
                albums == null && error == null -> Box(Modifier.fillMaxWidth().padding(16.dp), Alignment.Center) { CenterLoading(Modifier.size(48.dp)) }
                albums == null -> Text(error ?: "Unable to load albums")
                else -> LazyColumn {
                    items(albums) { album ->
                        ListItem(
                            headlineContent = { Text(album.albumName.ifBlank { "Untitled" }, maxLines = 1) },
                            supportingContent = { Text("${album.assetCount} items") },
                            modifier = Modifier.clickable { onPick(album.id) },
                        )
                    }
                }
            }
        },
        confirmButton = { TextButton({ creating = true }) { Text("New album") } },
        dismissButton = { TextButton(onDismiss) { Text("Cancel") } },
    )
}
