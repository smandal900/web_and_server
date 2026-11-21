package app.immich.mobile.ui.library

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.NewReleases
import androidx.compose.material.icons.filled.Place
import app.immich.mobile.ui.map.PlacesMapPreview
import androidx.compose.material.icons.outlined.Archive
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.Folder
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.immich.mobile.app
import app.immich.mobile.backup.LocalAsset
import app.immich.mobile.data.MemoryDto
import app.immich.mobile.data.PartnerDto
import app.immich.mobile.data.PersonDto
import app.immich.mobile.data.allPeople
import app.immich.mobile.data.partners
import app.immich.mobile.ui.components.CenterLoading
import app.immich.mobile.ui.components.CenterMessage
import app.immich.mobile.ui.components.ImmichTopBar
import app.immich.mobile.ui.components.UserAvatar
import app.immich.mobile.ui.search.PersonAvatar
import coil3.compose.AsyncImage

/**
 * Library tab, laid out like the official app (library.page.dart): four pill shortcuts, four square collection cards,
 * then one rounded list with the folders, the locked folder, partners and one row for every partner that shares with you.
 */
@Composable
fun LibraryScreen(
    onOpen: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val app = LocalContext.current.app
    var people by remember { mutableStateOf<List<PersonDto>>(emptyList()) }
    var memories by remember { mutableStateOf<List<MemoryDto>>(emptyList()) }
    var partners by remember { mutableStateOf<List<PartnerDto>>(emptyList()) }
    var trashEnabled by remember { mutableStateOf(true) }
    LaunchedEffect(Unit) {
        people = runCatching { app.api.allPeople() }.getOrDefault(emptyList()).filter { !it.isHidden }.take(4)
        memories = runCatching { app.api.memories() }.getOrDefault(emptyList()).filter { it.assets.isNotEmpty() }.take(4)
        partners = runCatching { app.api.partners("shared-with") }.getOrDefault(emptyList())
        trashEnabled = runCatching { app.api.features().trash }.getOrDefault(true)
    }
    val local by app.backup.local.collectAsState()
    // the cover of the first four albums of the device, the way the official card shows its local albums
    val albumCovers = remember(local.assets.size) {
        local.assets.groupBy { it.bucketId }.values
            .sortedWith(
                compareByDescending<List<LocalAsset>> { it.first().bucketName == "Camera" }.thenByDescending { it.size },
            )
            .take(4)
            .map { it.first().uri.toString() }
    }

    Scaffold(
        modifier = modifier,
        contentWindowInsets = WindowInsets(0),
        topBar = { ImmichTopBar(onNavigate = onOpen) },
    ) { padding ->
        Column(
            Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState()),
        ) {
            Column(
                Modifier.padding(start = 16.dp, top = 16.dp, end = 16.dp, bottom = 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Pill(Icons.Outlined.FavoriteBorder, "Favorites", Modifier.weight(1f)) { onOpen(Routes.FAVORITES) }
                    Pill(Icons.Outlined.Archive, "Archived", Modifier.weight(1f)) { onOpen(Routes.ARCHIVE) }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Pill(Icons.Outlined.Link, "Shared links", Modifier.weight(1f)) { onOpen(Routes.LINKS) }
                    if (trashEnabled) {
                        Pill(Icons.Outlined.Delete, "Trash", Modifier.weight(1f)) { onOpen(Routes.TRASH) }
                    } else {
                        Box(Modifier.weight(1f))
                    }
                }
            }

            // two cards per row, four on a tablet
            BoxWithConstraints(Modifier.padding(horizontal = 16.dp)) {
                val perRow = if (maxWidth > 600.dp) 4 else 2
                val cards = listOf<@Composable (Modifier) -> Unit>(
                    { m ->
                        CollectionCard("People", m, { onOpen(Routes.PEOPLE) }) {
                            Mosaic(people.map { app.api.personThumbnailUrl(it.id, it.updatedAt) }, CircleShape)
                        }
                    },
                    { m ->
                        CollectionCard("Places", m, { onOpen(Routes.PLACES) }, background = placesBackground()) {
                            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                // the pin shows until (or unless) the server's map style is there
                                Icon(Icons.Filled.Place, null, Modifier.size(56.dp), tint = MaterialTheme.colorScheme.primary)
                                PlacesMapPreview(Modifier.fillMaxSize())
                                // the map is a native view that takes every touch itself, so the card's own click never
                                // saw a tap on it: this transparent layer on top passes the tap on
                                Box(Modifier.fillMaxSize().clickable { onOpen(Routes.PLACES) })
                            }
                        }
                    },
                    { m ->
                        CollectionCard("On this device", m, { onOpen(Routes.DEVICE) }) {
                            Mosaic(albumCovers, RoundedCornerShape(10.dp))
                        }
                    },
                    { m ->
                        CollectionCard("Memories", m, { onOpen(Routes.memory(0)) }) {
                            Mosaic(memories.map { app.api.thumbnailUrl(it.assets.first().id) }, RoundedCornerShape(10.dp))
                        }
                    },
                )
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    cards.chunked(perRow).forEach { rowCards ->
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            rowCards.forEach { card -> card(Modifier.weight(1f)) }
                            repeat(perRow - rowCards.size) { Box(Modifier.weight(1f)) }
                        }
                    }
                }
            }

            QuickAccessList(
                partners = partners,
                onOpen = onOpen,
                modifier = Modifier.padding(start = 16.dp, top = 12.dp, end = 16.dp, bottom = 32.dp),
            )
        }
    }
}

private val CardRadius = 20.dp

/** The primary colour at the strengths the official app uses (alpha 30 and 25 of 255 on cards, 10, 15 and 20 on the list). */
@Composable
private fun primaryTint(vararg alphas: Int): Brush {
    val primary = MaterialTheme.colorScheme.primary
    return Brush.verticalGradient(alphas.map { primary.copy(alpha = it / 255f) })
}

@Composable
private fun placesBackground(): Brush {
    val color = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 100 / 255f)
    return Brush.verticalGradient(listOf(color, color))
}

@Composable
private fun hairline() = BorderStroke(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 10 / 255f))

@Composable
private fun Pill(icon: ImageVector, title: String, modifier: Modifier, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(25.dp),
        color = MaterialTheme.colorScheme.surfaceContainerLow,
        border = hairline(),
    ) {
        Row(
            Modifier.padding(horizontal = 20.dp, vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.primary)
            Text(title, color = MaterialTheme.colorScheme.onSurface, fontSize = 15.sp, maxLines = 1)
        }
    }
}

@Composable
private fun CollectionCard(
    title: String,
    modifier: Modifier,
    onClick: () -> Unit,
    background: Brush = primaryTint(30, 25),
    content: @Composable () -> Unit,
) {
    Column(modifier.clickable(onClick = onClick)) {
        Box(
            Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
                .clip(RoundedCornerShape(CardRadius))
                .background(background),
            propagateMinConstraints = true,
        ) { content() }
        Text(
            title,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.W500,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.padding(8.dp),
        )
    }
}

/** Up to four thumbnails in a fixed 2x2 grid, so a card with fewer photos keeps the same cell size. */
@Composable
private fun Mosaic(urls: List<String>, shape: Shape) {
    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        for (row in 0..1) {
            Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                for (column in 0..1) {
                    val url = urls.getOrNull(row * 2 + column)
                    Box(
                        Modifier
                            .weight(1f)
                            .fillMaxSize()
                            .clip(shape),
                    ) {
                        if (url != null) {
                            AsyncImage(
                                model = url,
                                contentDescription = null,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize(),
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun QuickAccessList(partners: List<PartnerDto>, onOpen: (String) -> Unit, modifier: Modifier = Modifier) {
    val iconColor = MaterialTheme.colorScheme.onSurfaceVariant
    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(CardRadius))
            .background(primaryTint(10, 15, 20)),
    ) {
        ListRow({ Icon(Icons.Outlined.Folder, null, Modifier.size(26.dp), tint = iconColor) }, "Folders") { onOpen(Routes.folder("")) }
        ListRow({ Icon(Icons.Outlined.Lock, null, Modifier.size(26.dp), tint = iconColor) }, "Locked Folder") { onOpen(Routes.LOCKED) }
        ListRow({ Icon(Icons.Outlined.Group, null, Modifier.size(26.dp), tint = iconColor) }, "Partners") { onOpen(Routes.PARTNERS) }
        partners.forEach { partner ->
            ListRow({ UserAvatar(partner.id, partner.name, size = 40.dp) }, "${partner.name}'s photos", startPadding = 12.dp) {
                onOpen(Routes.partner(partner.id))
            }
        }
        // not in the official Library list (it reaches them from Search and Places), kept so they stay reachable
        ListRow({ Icon(Icons.Filled.Map, null, Modifier.size(26.dp), tint = iconColor) }, "Map") { onOpen(Routes.MAP) }
        ListRow({ Icon(Icons.Filled.NewReleases, null, Modifier.size(26.dp), tint = iconColor) }, "Recently added") { onOpen(Routes.RECENT) }
    }
}

@Composable
private fun ListRow(
    leading: @Composable () -> Unit,
    title: String,
    startPadding: Dp = 16.dp,
    onClick: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(start = startPadding, end = 16.dp, top = 15.dp, bottom = 15.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        leading()
        Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.W500, maxLines = 1)
    }
}

object Routes {
    const val PHOTOS = "photos"
    const val SEARCH = "search"
    const val ALBUMS = "albums"
    const val LIBRARY = "library"
    const val FAVORITES = "favorites"
    const val ARCHIVE = "archive"
    const val TRASH = "trash"
    const val BIN = "bin"
    const val PEOPLE = "people"
    const val BACKUP = "backup"
    const val BACKUP_OPTIONS = "backup-options"
    const val SETTINGS = "settings"
    const val MEMORY = "memory/{index}"
    const val PLACES = "places"
    const val PLACE = "place/{city}"
    const val MAP = "map"
    const val RECENT = "recent"
    const val LINKS = "links"
    const val LOCKED = "locked"
    const val DEVICE = "device"
    const val DEVICE_ALBUM = "device/{id}"
    const val SHARE = "share"
    const val CLEANUP = "cleanup"
    const val HEADERS = "headers"
    const val LOGS = "logs"
    const val FOLDERS = "folders?path={path}"
    const val PARTNERS = "partners"
    const val PARTNER = "partner/{id}"
    const val ALBUM = "album/{id}"
    const val PERSON = "person/{id}"
    const val VIEWER = "viewer/{key}/{index}?kind={kind}&album={album}"

    fun album(id: String) = "album/$id"
    fun person(id: String) = "person/$id"
    fun memory(index: Int) = "memory/$index"
    fun partner(id: String) = "partner/$id"
    fun folder(path: String) = "folders?path=${android.net.Uri.encode(path)}"
    fun deviceAlbum(id: String) = "device/${android.net.Uri.encode(id)}"
    fun place(city: String) = "place/${android.net.Uri.encode(city)}"
    fun viewer(key: String, index: Int, kind: String = "Library", albumId: String? = null) =
        "viewer/${android.net.Uri.encode(key)}/$index?kind=$kind&album=${albumId ?: ""}"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PeopleScreen(
    onBack: () -> Unit,
    onOpenPerson: (PersonDto) -> Unit,
    modifier: Modifier = Modifier,
) {
    val api = LocalContext.current.app.api
    var people by remember { mutableStateOf<List<PersonDto>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var showHidden by remember { mutableStateOf(false) }
    LaunchedEffect(showHidden) {
        try {
            val loaded = if (showHidden) api.allPeople() else api.people().people.filter { !it.isHidden }
            people = loaded.sortedWith(compareByDescending<PersonDto> { it.name.isNotBlank() }.thenBy { it.name.lowercase() })
            error = null
        } catch (e: Exception) {
            error = e.message ?: "Unable to load people"
        }
    }

    Scaffold(
        modifier = modifier,
        contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0),
        topBar = {
            TopAppBar(
                title = { Text("People") },
                actions = {
                    TextButton({ showHidden = !showHidden }) { Text(if (showHidden) "Hide hidden" else "Show hidden") }
                },
                navigationIcon = {
                    IconButton(onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
            )
        },
    ) { padding ->
        val list = people
        Column(
            Modifier
                .padding(padding)
                .fillMaxSize(),
        ) {
            when {
                list == null && error == null -> CenterLoading()
                list == null -> CenterMessage("Unable to load people", detail = error)
                list.isEmpty() -> CenterMessage("No people found", detail = "Faces appear once the server has recognized them")
                else -> LazyVerticalGrid(
                    columns = GridCells.Adaptive(96.dp),
                    contentPadding = PaddingValues(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    items(list, key = { it.id }) { person ->
                        androidx.compose.foundation.layout.Box(Modifier.alpha(if (person.isHidden) 0.4f else 1f)) {
                            PersonAvatar(person, onClick = { onOpenPerson(person) }, size = 88)
                        }
                    }
                }
            }
        }
    }
}
