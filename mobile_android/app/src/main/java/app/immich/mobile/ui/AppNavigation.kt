package app.immich.mobile.ui

import app.immich.mobile.ui.components.ImmichTopBar
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.SpaceDashboard
import androidx.compose.material.icons.filled.PhotoAlbum
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.SpaceDashboard
import androidx.compose.material.icons.outlined.PhotoAlbum
import androidx.compose.material.icons.outlined.PhotoLibrary
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.compose.foundation.background
import androidx.compose.material3.MaterialTheme
import androidx.lifecycle.compose.LocalLifecycleOwner
import app.immich.mobile.app
import app.immich.mobile.data.AlbumDto
import app.immich.mobile.data.AssetItem
import app.immich.mobile.backup.LocalMedia
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.collectAsState
import app.immich.mobile.data.IdSource
import app.immich.mobile.data.ListSource
import app.immich.mobile.data.MetadataSearchRequest
import app.immich.mobile.data.PagedSource
import app.immich.mobile.ui.map.MapScreen
import app.immich.mobile.ui.memories.MemoryScreen
import app.immich.mobile.ui.places.PlacesScreen
import app.immich.mobile.data.MemoryDto
import app.immich.mobile.data.PersonDto
import app.immich.mobile.data.TimelineQuery
import app.immich.mobile.data.TimelineSource
import app.immich.mobile.data.toItem
import app.immich.mobile.ui.albums.AlbumsScreen
import app.immich.mobile.ui.albums.ActivitySheet
import app.immich.mobile.ui.albums.AlbumOptionsDialog
import app.immich.mobile.ui.albums.AlbumUsersDialog
import app.immich.mobile.ui.albums.NameDialog
import app.immich.mobile.ui.sharing.PartnersScreen
import app.immich.mobile.ui.sharing.SharedLinksScreen
import app.immich.mobile.ui.sharing.ShareLinkFlow
import app.immich.mobile.ui.library.FolderScreen
import app.immich.mobile.ui.library.LibraryScreen
import app.immich.mobile.ui.local.DeviceBinScreen
import app.immich.mobile.ui.local.DeviceViewerNavigation
import app.immich.mobile.ui.local.CleanupScreen
import app.immich.mobile.ui.local.LocalAlbumScreen
import app.immich.mobile.ui.local.ShareUploadScreen
import app.immich.mobile.ui.local.LocalAlbumsScreen
import app.immich.mobile.ui.locked.LockedFolderScreen
import app.immich.mobile.ui.settings.ChangePasswordDialog
import app.immich.mobile.ui.settings.HeadersSettingsScreen
import app.immich.mobile.data.mergePeople
import app.immich.mobile.data.updatePerson
import app.immich.mobile.ui.library.BirthdayDialog
import app.immich.mobile.ui.library.MergePeopleDialog
import app.immich.mobile.ui.library.PeopleScreen
import app.immich.mobile.ui.library.Routes
import app.immich.mobile.ui.local.DeviceDeletionPrompt
import app.immich.mobile.ui.login.LoginScreen
import app.immich.mobile.ui.search.SearchScreen
import app.immich.mobile.ui.settings.BackupCloudButton
import app.immich.mobile.ui.settings.BackupOptionsScreen
import app.immich.mobile.ui.settings.BackupScreen
import app.immich.mobile.ui.settings.SettingsScreen
import app.immich.mobile.ui.viewer.ViewerScreen
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch
import java.time.LocalDate

@Composable
fun AppNavigation() {
    val session = LocalContext.current.app.session
    val owner = LocalLifecycleOwner.current
    val appRef = LocalContext.current.app
    // look at the gallery whenever the app comes to the front, new photos show up in the timeline
    DisposableEffect(owner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME && appRef.backup.settings.showDevicePhotos) {
                appRef.appScope.launch { runCatching { appRef.backup.scanDevice() } }
            }
        }
        owner.lifecycle.addObserver(observer)
        onDispose { owner.lifecycle.removeObserver(observer) }
    }
    if (!session.isLoggedIn) {
        // without an account the app works as a photo viewer for the camera folder of the phone
        if (session.showLogin) LoginScreen() else DeviceViewerNavigation()
    } else {
        MainNavigation()
    }
}

private data class Tab(val route: String, val label: String, val icon: ImageVector, val selectedIcon: ImageVector)

private val tabs = listOf(
    Tab(Routes.PHOTOS, "Photos", Icons.Outlined.PhotoLibrary, Icons.Filled.PhotoLibrary),
    Tab(Routes.SEARCH, "Search", Icons.Outlined.Search, Icons.Filled.Search),
    Tab(Routes.ALBUMS, "Albums", Icons.Outlined.PhotoAlbum, Icons.Filled.PhotoAlbum),
    Tab(Routes.LIBRARY, "Library", Icons.Outlined.SpaceDashboard, Icons.Filled.SpaceDashboard),
    Tab(Routes.BIN, "Bin", Icons.Outlined.Delete, Icons.Filled.Delete),
)

@Composable
private fun MainNavigation() {
    val nav = rememberNavController()
    val entry by nav.currentBackStackEntryAsState()
    val route = entry?.destination?.route
    val showBar = tabs.any { it.route == route }
    val session = LocalContext.current.app.session
    val owner = LocalLifecycleOwner.current
    val appRef = LocalContext.current.app
    // look at the gallery whenever the app comes to the front, new photos show up in the timeline
    DisposableEffect(owner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME && appRef.backup.settings.showDevicePhotos) {
                appRef.appScope.launch { runCatching { appRef.backup.scanDevice() } }
            }
        }
        owner.lifecycle.addObserver(observer)
        onDispose { owner.lifecycle.removeObserver(observer) }
    }
    fun openTab(target: String) {
        nav.navigate(target) {
            popUpTo(Routes.PHOTOS) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }
    if (session.mustChangePassword) {
        ChangePasswordDialog(forced = true, onDismiss = {}, onDone = {})
    }
    // photos deleted on the web with "Delete from device also"
    DeviceDeletionPrompt()

    // files shared with the app, and photos other apps ask the app to open
    LaunchedEffect(appRef.pendingShare) {
        if (appRef.pendingShare.isNotEmpty()) nav.navigate(Routes.SHARE) { launchSingleTop = true }
    }
    LaunchedEffect(appRef.pendingView) {
        val uri = appRef.pendingView ?: return@LaunchedEffect
        appRef.pendingView = null
        val mime = appRef.contentResolver.getType(uri).orEmpty()
        val item = AssetItem(
            id = "view:$uri",
            isImage = !mime.startsWith("video/"),
            localUri = uri.toString(),
            backedUp = null,
        )
        appRef.putSource("view", ListSource(listOf(item)))
        nav.navigate(Routes.viewer("view", 0))
    }

    Scaffold(
        contentWindowInsets = WindowInsets(0),
        bottomBar = {
            if (showBar) {
                NavigationBar {
                    tabs.forEach { tab ->
                        val selected = route == tab.route
                        NavigationBarItem(
                            selected = selected,
                            onClick = { if (!selected) openTab(tab.route) },
                            icon = { Icon(if (selected) tab.selectedIcon else tab.icon, tab.label) },
                            label = { Text(tab.label) },
                        )
                    }
                }
            }
        },
    ) { padding ->
        NavHost(nav, startDestination = Routes.PHOTOS, modifier = Modifier.padding(padding)) {
            composable(Routes.PHOTOS) { PhotosTab(nav) }
            composable(Routes.SEARCH) {
                SearchScreen(
                    onOpenViewer = { key, position -> nav.navigate(Routes.viewer(key, position)) },
                    onOpenPerson = { nav.navigate(Routes.person(it.id)) },
                )
            }
            composable(Routes.ALBUMS) { AlbumsScreen(onOpenAlbum = { nav.navigate(Routes.album(it.id)) }, onNavigate = { nav.navigate(it) }) }
            composable(Routes.LIBRARY) { LibraryScreen(onOpen = { nav.navigate(it) }) }
            // the bin holds files of this device only, the trash of the server stays under Library
            composable(Routes.BIN) { DeviceBinScreen() }

            composable(Routes.FAVORITES) {
                val source = rememberTimeline("favorites", TimelineQuery(isFavorite = true))
                AssetSourceScreen(
                    title = "Favorites",
                    source = source,
                    kind = SourceKind.Library,
                    emptyMessage = "No favorites yet",
                    onBack = { nav.popBackStack() },
                    onOpen = { nav.navigate(Routes.viewer("favorites", it)) },
                )
            }
            composable(Routes.ARCHIVE) {
                val source = rememberTimeline("archive", TimelineQuery(visibility = "archive"))
                AssetSourceScreen(
                    title = "Archive",
                    source = source,
                    kind = SourceKind.Archive,
                    emptyMessage = "The archive is empty",
                    onBack = { nav.popBackStack() },
                    onOpen = { nav.navigate(Routes.viewer("archive", it, "Archive")) },
                )
            }
            composable(Routes.TRASH) { TrashScreen(nav) }
            composable(
                Routes.FOLDERS,
                arguments = listOf(navArgument("path") { type = NavType.StringType; defaultValue = "" }),
            ) {
                FolderScreen(
                    path = android.net.Uri.decode(it.arguments?.getString("path").orEmpty()),
                    onBack = { nav.popBackStack() },
                    onOpenFolder = { folder -> nav.navigate(Routes.folder(folder)) },
                    onOpenAsset = { key, position -> nav.navigate(Routes.viewer(key, position)) },
                )
            }
            composable(Routes.PEOPLE) {
                PeopleScreen(onBack = { nav.popBackStack() }, onOpenPerson = { nav.navigate(Routes.person(it.id)) })
            }
            composable(Routes.LINKS) { SharedLinksScreen(onBack = { nav.popBackStack() }) }
            composable(Routes.LOCKED) {
                LockedFolderScreen(
                    onBack = { nav.popBackStack() },
                    onOpen = { nav.navigate(Routes.viewer("locked", it, "Locked")) },
                )
            }
            composable(Routes.HEADERS) { HeadersSettingsScreen(onBack = { nav.popBackStack() }) }
            composable(Routes.LOGS) { app.immich.mobile.ui.settings.LogsScreen(onBack = { nav.popBackStack() }) }
            composable(Routes.SHARE) {
                ShareUploadScreen(onClose = { nav.popBackStack() })
            }
            composable(Routes.CLEANUP) { CleanupScreen(onBack = { nav.popBackStack() }) }
            composable(Routes.DEVICE) {
                LocalAlbumsScreen(
                    onBack = { nav.popBackStack() },
                    onOpenAlbum = { nav.navigate(Routes.deviceAlbum(it)) },
                )
            }
            composable(Routes.DEVICE_ALBUM, arguments = listOf(navArgument("id") { type = NavType.StringType })) {
                val id = android.net.Uri.decode(it.arguments?.getString("id").orEmpty())
                LocalAlbumScreen(
                    bucketId = id,
                    onBack = { nav.popBackStack() },
                    onOpen = { pos -> nav.navigate(Routes.viewer("device:$id", pos)) },
                )
            }
            composable(Routes.PARTNERS) {
                PartnersScreen(
                    onBack = { nav.popBackStack() },
                    onOpenPartner = { nav.navigate(Routes.partner(it.id)) },
                )
            }
            composable(Routes.PARTNER, arguments = listOf(navArgument("id") { type = NavType.StringType })) {
                val id = it.arguments?.getString("id").orEmpty()
                val source = rememberTimeline("partner:$id", TimelineQuery(userId = id, visibility = "timeline", withStacked = true))
                AssetSourceScreen(
                    title = "Shared with you",
                    source = source,
                    kind = SourceKind.Partner,
                    emptyMessage = "Nothing shared yet",
                    onBack = { nav.popBackStack() },
                    onOpen = { pos -> nav.navigate(Routes.viewer("partner:$id", pos, "Partner")) },
                )
            }
            composable(Routes.PLACES) {
                PlacesScreen(onBack = { nav.popBackStack() }, onOpenPlace = { nav.navigate(Routes.place(it)) })
            }
            composable(Routes.PLACE, arguments = listOf(navArgument("city") { type = NavType.StringType })) {
                PlaceDetail(android.net.Uri.decode(it.arguments?.getString("city").orEmpty()), nav)
            }
            composable(Routes.MAP) {
                val app = LocalContext.current.app
                MapScreen(
                    onBack = { nav.popBackStack() },
                    onOpenAssets = { ids, index ->
                        val key = "map:${ids.hashCode()}"
                        app.putSource(key, IdSource(app.api, app.appScope, ids))
                        nav.navigate(Routes.viewer(key, index))
                    },
                )
            }
            composable(Routes.RECENT) {
                val source = rememberTimeline(
                    "recent",
                    TimelineQuery(withStacked = true, visibility = "timeline", orderBy = "createdAt"),
                )
                AssetSourceScreen(
                    title = "Recently added",
                    source = source,
                    kind = SourceKind.Library,
                    emptyMessage = "Nothing has been added yet",
                    onBack = { nav.popBackStack() },
                    onOpen = { nav.navigate(Routes.viewer("recent", it)) },
                )
            }
            composable(Routes.MEMORY, arguments = listOf(navArgument("index") { type = NavType.IntType })) {
                val app = LocalContext.current.app
                MemoryScreen(
                    startIndex = it.arguments?.getInt("index") ?: 0,
                    onBack = { nav.popBackStack() },
                    onOpenAll = { memory ->
                        val key = "memory:${memory.id}"
                        app.putSource(key, ListSource(memory.assets.map { a -> a.toItem() }))
                        nav.navigate(Routes.viewer(key, 0))
                    },
                )
            }
            composable(Routes.BACKUP) {
                BackupScreen(onBack = { nav.popBackStack() }, onOpenSettings = { nav.navigate(Routes.BACKUP_OPTIONS) })
            }
            composable(Routes.BACKUP_OPTIONS) {
                BackupOptionsScreen(onBack = { nav.popBackStack() })
            }
            composable(Routes.SETTINGS) {
                SettingsScreen(
                    onBack = { nav.popBackStack() },
                    onOpenHeaders = { nav.navigate(Routes.HEADERS) },
                )
            }

            composable(Routes.ALBUM, arguments = listOf(navArgument("id") { type = NavType.StringType })) {
                AlbumDetail(it.arguments?.getString("id").orEmpty(), nav)
            }
            composable(Routes.PERSON, arguments = listOf(navArgument("id") { type = NavType.StringType })) {
                PersonDetail(it.arguments?.getString("id").orEmpty(), nav)
            }

            composable(
                Routes.VIEWER,
                arguments = listOf(
                    navArgument("key") { type = NavType.StringType },
                    navArgument("index") { type = NavType.IntType },
                    navArgument("kind") { type = NavType.StringType; defaultValue = "Library" },
                    navArgument("album") { type = NavType.StringType; defaultValue = "" },
                ),
            ) {
                val args = it.arguments
                ViewerScreen(
                    sourceKey = android.net.Uri.decode(args?.getString("key").orEmpty()),
                    startIndex = args?.getInt("index") ?: 0,
                    kind = runCatching { SourceKind.valueOf(args?.getString("kind").orEmpty()) }.getOrDefault(SourceKind.Library),
                    albumId = args?.getString("album")?.ifBlank { null },
                    onBack = { nav.popBackStack() },
                )
            }
        }
    }
}

/** The timeline behind [key], kept in the app so the viewer can page through it. It is refreshed when it comes back. */
@Composable
private fun rememberTimeline(
    key: String,
    query: TimelineQuery,
    locals: (() -> List<AssetItem>)? = null,
    offlineLocals: (() -> List<AssetItem>)? = null,
): TimelineSource {
    val app = LocalContext.current.app
    val existed = remember(key) { app.source(key) != null }
    val source = remember(key) { app.timeline(key, query, locals, offlineLocals) }
    LaunchedEffect(source) { if (existed) source.refresh() }
    return source
}

@Composable
private fun PhotosTab(nav: NavHostController) {
    val context = LocalContext.current
    val app = context.app
    val backup = app.backup
    val snapshot by backup.local.collectAsState()

    val showLocal = backup.settings.showDevicePhotos && LocalMedia.hasPermission(context)
    val locals: (() -> List<AssetItem>)? = if (showLocal) ({ backup.local.value.timelineItems(backup.settings.buckets) }) else null
    val offlineLocals: (() -> List<AssetItem>)? = if (showLocal) ({ backup.local.value.offlineItems(backup.settings.buckets) }) else null
    val source = rememberTimeline(
        "timeline",
        TimelineQuery(withStacked = true, visibility = "timeline", withPartners = true),
        locals = locals,
        offlineLocals = offlineLocals,
    )
    // the timeline is kept from the first time it was shown: hand it the device photos once access is given
    LaunchedEffect(source, showLocal) { source.useLocals(locals, offlineLocals) }
    // photos that were found on the device, or that were uploaded, move in or out of the grid
    LaunchedEffect(snapshot.checked.size, snapshot.backedUp.size, snapshot.assets.size, backup.settings.buckets) {
        if (showLocal) source.localsChanged()
    }

    var memories by remember { mutableStateOf<List<MemoryDto>>(emptyList()) }
    LaunchedEffect(Unit) {
        memories = runCatching { app.api.memories().filter { it.assets.isNotEmpty() } }.getOrDefault(emptyList())
        app.memories = memories
    }

    // the scan runs in the background anyway, but its progress only matters while device photos are shown
    val scanShown = showLocal && snapshot.scanning && backup.settings.buckets.isNotEmpty()

    AssetSourceScreen(
        title = "Photos",
        source = source,
        kind = SourceKind.Library,
        emptyMessage = "No photos yet. Back up your gallery from the Library tab.",
        similar = app.prefs.groupSimilar,
        onOpen = { nav.navigate(Routes.viewer("timeline", it)) },
        header = if (memories.isEmpty()) null else {
            { MemoriesRow(memories) { memory -> nav.navigate(Routes.memory(memories.indexOf(memory))) } }
        },
        topBar = {
            ImmichTopBar(onNavigate = { nav.navigate(it) }, actions = {
                // the scan of the device photos shows in the cloud, which turns into a "Checking" pill like "Offline".
                // A running backup does not change it: the cloud stays the cloud while files are uploaded.
                BackupCloudButton(
                    offline = source.offline,
                    scanning = scanShown,
                    scanProgress = if (snapshot.total > 0) snapshot.done.toFloat() / snapshot.total else null,
                ) { nav.navigate(Routes.BACKUP) }
            })
        },
    )
}

@Composable
private fun MemoriesRow(memories: List<MemoryDto>, onOpen: (MemoryDto) -> Unit) {
    val api = LocalContext.current.app.api
    val year = LocalDate.now().year
    LazyRow(
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(memories, key = { it.id }) { memory ->
            val cover = memory.assets.first()
            val years = memory.data?.year?.let { year - it }
            Box(
                Modifier
                    .width(110.dp)
                    .height(150.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .clickable { onOpen(memory) },
            ) {
                AsyncImage(
                    model = api.thumbnailUrl(cover.id, cover.thumbhash),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
                Box(
                    Modifier
                        .fillMaxSize()
                        .background(Brush.verticalGradient(listOf(Color.Transparent, Color(0xAA000000)))),
                )
                Text(
                    when {
                        years == null -> "Memory"
                        years == 1 -> "1 year ago"
                        else -> "$years years ago"
                    },
                    color = Color.White,
                    style = MaterialTheme.typography.labelLarge,
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(10.dp),
                )
            }
        }
    }
}

@Composable
private fun AlbumDetail(id: String, nav: NavHostController) {
    val app = LocalContext.current.app
    val scope = rememberCoroutineScope()
    var album by remember(id) { mutableStateOf<AlbumDto?>(null) }
    var menu by remember { mutableStateOf(false) }
    var renaming by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf(false) }
    var sharing by remember { mutableStateOf(false) }
    var linking by remember { mutableStateOf(false) }
    var options by remember { mutableStateOf(false) }
    var activity by remember { mutableStateOf(false) }

    LaunchedEffect(id) { album = runCatching { app.api.album(id) }.getOrNull() }
    val source = rememberTimeline("album:$id", TimelineQuery(albumId = id))

    AssetSourceScreen(
        title = album?.albumName ?: "Album",
        source = source,
        kind = SourceKind.Album,
        albumId = id,
        emptyMessage = "This album is empty. Select photos in the Photos tab and add them here.",
        onBack = { nav.popBackStack() },
        onOpen = { nav.navigate(Routes.viewer("album:$id", it, "Album", id)) },
        actions = {
            IconButton({ menu = true }) { Icon(Icons.Filled.MoreVert, "More") }
            DropdownMenu(menu, { menu = false }) {
                DropdownMenuItem(text = { Text("Rename") }, onClick = { menu = false; renaming = true })
                DropdownMenuItem(text = { Text("Share with people") }, onClick = { menu = false; sharing = true })
                DropdownMenuItem(text = { Text("Create link") }, onClick = { menu = false; linking = true })
                if (album?.isActivityEnabled != false) {
                    DropdownMenuItem(text = { Text("Activity") }, onClick = { menu = false; activity = true })
                }
                DropdownMenuItem(text = { Text("Options") }, onClick = { menu = false; options = true })
                DropdownMenuItem(text = { Text("Delete album") }, onClick = { menu = false; deleting = true })
            }
        },
    )

    album?.let { current ->
        if (sharing) AlbumUsersDialog(current, onDismiss = { sharing = false }, onChanged = { album = it })
        if (options) AlbumOptionsDialog(current, onDismiss = { options = false }, onSaved = { album = it; options = false })
    }
    if (linking) ShareLinkFlow(assetIds = null, albumId = id, onDismiss = { linking = false })
    if (activity) ActivitySheet(albumId = id, assetId = null, onDismiss = { activity = false })

    if (renaming) {
        NameDialog(
            title = "Rename album",
            confirm = "Save",
            initial = album?.albumName.orEmpty(),
            onDismiss = { renaming = false },
            onConfirm = { name ->
                renaming = false
                scope.launch {
                    runCatching { app.api.renameAlbum(id, name) }.onSuccess { album = album?.copy(albumName = name) }
                }
            },
        )
    }
    if (deleting) {
        AlertDialog(
            onDismissRequest = { deleting = false },
            title = { Text("Delete album?") },
            text = { Text("The photos in it stay in your library.") },
            confirmButton = {
                TextButton({
                    deleting = false
                    scope.launch {
                        runCatching { app.api.deleteAlbum(id) }.onSuccess {
                            app.dropSource("album:$id")
                            nav.popBackStack()
                        }
                    }
                }) { Text("Delete") }
            },
            dismissButton = { TextButton({ deleting = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun PlaceDetail(city: String, nav: NavHostController) {
    val app = LocalContext.current.app
    val key = "place:$city"
    val source = remember(key) {
        (app.source(key) as? PagedSource) ?: PagedSource(app.appScope) { page ->
            app.api.searchMetadata(MetadataSearchRequest(city = city, withExif = true, page = page))
        }.also { app.putSource(key, it) }
    }
    AssetSourceScreen(
        title = city,
        source = source,
        kind = SourceKind.Library,
        emptyMessage = "No photos taken in $city",
        onBack = { nav.popBackStack() },
        onOpen = { nav.navigate(Routes.viewer(key, it)) },
    )
}

@Composable
private fun PersonDetail(id: String, nav: NavHostController) {
    val app = LocalContext.current.app
    val scope = rememberCoroutineScope()
    var person by remember(id) { mutableStateOf<PersonDto?>(null) }
    var renaming by remember { mutableStateOf(false) }
    var personMenu by remember { mutableStateOf(false) }
    var birthday by remember { mutableStateOf(false) }
    var merging by remember { mutableStateOf(false) }
    LaunchedEffect(id) { person = runCatching { app.api.person(id) }.getOrNull() }
    val source = rememberTimeline("person:$id", TimelineQuery(personId = id))

    AssetSourceScreen(
        title = person?.name?.ifBlank { null } ?: "Person",
        source = source,
        kind = SourceKind.Library,
        onBack = { nav.popBackStack() },
        onOpen = { nav.navigate(Routes.viewer("person:$id", it)) },
        actions = {
            IconButton({ personMenu = true }) { Icon(Icons.Filled.MoreVert, "More") }
            DropdownMenu(personMenu, { personMenu = false }) {
                DropdownMenuItem(text = { Text("Rename") }, onClick = { personMenu = false; renaming = true })
                DropdownMenuItem(text = { Text("Date of birth") }, onClick = { personMenu = false; birthday = true })
                DropdownMenuItem(
                    text = { Text(if (person?.isFavorite == true) "Remove from favorites" else "Favorite") },
                    onClick = {
                        personMenu = false
                        val favorite = person?.isFavorite != true
                        scope.launch {
                            runCatching { app.api.updatePerson(id, isFavorite = favorite) }
                                .onSuccess { person = person?.copy(isFavorite = favorite) }
                        }
                    },
                )
                DropdownMenuItem(
                    text = { Text(if (person?.isHidden == true) "Show person" else "Hide person") },
                    onClick = {
                        personMenu = false
                        val hide = person?.isHidden != true
                        scope.launch {
                            runCatching { app.api.updatePerson(id, isHidden = hide) }.onSuccess {
                                person = person?.copy(isHidden = hide)
                                if (hide) nav.popBackStack()
                            }
                        }
                    },
                )
                DropdownMenuItem(text = { Text("Merge people") }, onClick = { personMenu = false; merging = true })
            }
        },
    )

    person?.let { current ->
        if (birthday) {
            BirthdayDialog(
                initial = current.birthDate,
                onDismiss = { birthday = false },
                onConfirm = { date ->
                    birthday = false
                    scope.launch {
                        runCatching { app.api.updatePerson(id, birthDate = date) }
                            .onSuccess { person = current.copy(birthDate = date.ifEmpty { null }) }
                    }
                },
            )
        }
        if (merging) {
            MergePeopleDialog(
                target = current,
                onDismiss = { merging = false },
                onConfirm = { ids ->
                    merging = false
                    scope.launch {
                        runCatching { app.api.mergePeople(id, ids) }.onSuccess {
                            app.dropSource("person:$id")
                            nav.popBackStack()
                        }
                    }
                },
            )
        }
    }

    if (renaming) {
        NameDialog(
            title = "Name this person",
            confirm = "Save",
            initial = person?.name.orEmpty(),
            onDismiss = { renaming = false },
            onConfirm = { name ->
                renaming = false
                scope.launch {
                    runCatching { app.api.renamePerson(id, name) }.onSuccess { person = person?.copy(name = name) }
                }
            },
        )
    }
}

@Composable
private fun TrashScreen(nav: NavHostController) {
    val app = LocalContext.current.app
    val scope = rememberCoroutineScope()
    val source = rememberTimeline("trash", TimelineQuery(isTrashed = true))
    var confirmEmpty by remember { mutableStateOf(false) }

    AssetSourceScreen(
        title = "Trash",
        source = source,
        kind = SourceKind.Trash,
        emptyMessage = "The trash is empty",
        onBack = { nav.popBackStack() },
        onOpen = { nav.navigate(Routes.viewer("trash", it, "Trash")) },
        actions = {
            if (source.size > 0) TextButton({ confirmEmpty = true }) { Text("Empty") }
        },
    )

    if (confirmEmpty) {
        AlertDialog(
            onDismissRequest = { confirmEmpty = false },
            title = { Text("Empty the trash?") },
            text = { Text("Everything in the trash is deleted for good.") },
            confirmButton = {
                TextButton({
                    confirmEmpty = false
                    scope.launch {
                        runCatching { app.api.emptyTrash() }
                        source.refresh()
                    }
                }) { Text("Empty") }
            },
            dismissButton = { TextButton({ confirmEmpty = false }) { Text("Cancel") } },
        )
    }
}
