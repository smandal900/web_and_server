package app.immich.mobile.ui.search

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.FileUpload
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material.icons.outlined.PlayCircleOutline
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.DateRangePicker
import androidx.compose.material3.rememberDateRangePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.immich.mobile.app
import app.immich.mobile.data.AssetSource
import app.immich.mobile.data.MetadataSearchRequest
import app.immich.mobile.data.PagedSource
import app.immich.mobile.data.PersonDto
import app.immich.mobile.data.ServerFeatures
import app.immich.mobile.data.SmartSearchRequest
import app.immich.mobile.ui.AssetSourceScreen
import app.immich.mobile.ui.SourceKind
import coil3.compose.AsyncImage
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

const val SEARCH_SOURCE_KEY = "search"

/** What the field searches for, like the "⋮" menu of the official search page. */
private enum class SearchMode(val label: String, val hint: String) {
    Context("Context", "Search your photos"),
    FileName("File name", "File name or extension"),
}

/** The filters of the chips under the field. */
private data class SearchFilters(
    val personIds: Set<String> = emptySet(),
    val country: String? = null,
    val make: String? = null,
    val from: LocalDate? = null,
    val to: LocalDate? = null,
    val type: String? = null,
    val favoritesOnly: Boolean = false,
    val addedRecently: Boolean = false,
) {
    val any get() = personIds.isNotEmpty() || country != null || make != null || from != null || to != null ||
        type != null || favoritesOnly || addedRecently
}

private val shortDate = DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)

@Composable
fun SearchScreen(
    onOpenViewer: (sourceKey: String, position: Int) -> Unit,
    onOpenPerson: (PersonDto) -> Unit,
    modifier: Modifier = Modifier,
) {
    val app = LocalContext.current.app
    val focus = LocalFocusManager.current

    var query by remember { mutableStateOf("") }
    var mode by remember { mutableStateOf(SearchMode.Context) }
    var filters by remember { mutableStateOf(SearchFilters()) }
    var results by remember { mutableStateOf<AssetSource?>(null) }
    var features by remember { mutableStateOf<ServerFeatures?>(null) }
    var people by remember { mutableStateOf<List<PersonDto>>(emptyList()) }
    var dialog by remember { mutableStateOf<String?>(null) }
    var menu by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        features = runCatching { app.api.features() }.getOrNull()
        people = runCatching { app.api.people(size = 100).people.filter { it.name.isNotBlank() } }.getOrDefault(emptyList())
        // a search that was open before is still around
        results = app.source(SEARCH_SOURCE_KEY)
    }

    val smartAvailable = features?.smartSearch == true
    val activeMode = if (mode == SearchMode.Context && !smartAvailable) SearchMode.FileName else mode

    fun run(text: String, f: SearchFilters, m: SearchMode, recentlyTaken: Boolean = false) {
        val trimmed = text.trim()
        if (trimmed.isEmpty() && !f.any && !recentlyTaken) {
            results = null
            app.dropSource(SEARCH_SOURCE_KEY)
            return
        }
        focus.clearFocus()
        val after = f.from?.atStartOfDay(ZoneOffset.UTC)?.toInstant()?.toString()
        val before = f.to?.plusDays(1)?.atStartOfDay(ZoneOffset.UTC)?.minusSeconds(1)?.toInstant()?.toString()
        val added = if (f.addedRecently) Instant.now().minusSeconds(7L * 24 * 3600).toString() else null
        val ids = f.personIds.toList().takeIf { it.isNotEmpty() }
        val source = PagedSource(app.appScope) { page ->
            if (m == SearchMode.Context && smartAvailable && trimmed.isNotEmpty()) {
                app.api.searchSmart(
                    SmartSearchRequest(
                        query = trimmed, type = f.type, isFavorite = f.favoritesOnly.takeIf { it }, personIds = ids,
                        country = f.country, make = f.make, takenAfter = after, takenBefore = before, createdAfter = added, page = page,
                    ),
                )
            } else {
                app.api.searchMetadata(
                    MetadataSearchRequest(
                        originalFileName = trimmed.ifEmpty { null }, type = f.type, isFavorite = f.favoritesOnly.takeIf { it },
                        personIds = ids, country = f.country, make = f.make, takenAfter = after, takenBefore = before,
                        createdAfter = added, order = "desc", withExif = true, page = page,
                    ),
                )
            }
        }
        app.putSource(SEARCH_SOURCE_KEY, source)
        results = source
    }

    fun apply(f: SearchFilters) {
        filters = f
        run(query, f, activeMode)
    }

    fun clearAll() {
        query = ""
        filters = SearchFilters()
        results = null
        app.dropSource(SEARCH_SOURCE_KEY)
    }

    Column(modifier.fillMaxSize().statusBarsPadding()) {
        TextField(
            value = query,
            onValueChange = { query = it },
            placeholder = { Text(activeMode.hint) },
            leadingIcon = {
                if (activeMode == SearchMode.FileName) {
                    Text("ABC", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
                } else {
                    Icon(Icons.Filled.Search, null)
                }
            },
            trailingIcon = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (query.isNotEmpty() || results != null) {
                        IconButton({ clearAll() }) { Icon(Icons.Filled.Clear, "Clear") }
                    }
                    Box {
                        IconButton({ menu = true }) { Icon(Icons.Filled.MoreVert, "Search mode", tint = MaterialTheme.colorScheme.primary) }
                        DropdownMenu(menu, { menu = false }) {
                            SearchMode.entries.filter { it != SearchMode.Context || smartAvailable }.forEach { m ->
                                DropdownMenuItem(
                                    text = { Text(m.label) },
                                    leadingIcon = { RadioButton(activeMode == m, null) },
                                    onClick = { mode = m; menu = false; run(query, filters, m) },
                                )
                            }
                        }
                    }
                }
            },
            singleLine = true,
            shape = RoundedCornerShape(28.dp),
            colors = TextFieldDefaults.colors(
                focusedIndicatorColor = Color.Transparent,
                unfocusedIndicatorColor = Color.Transparent,
                disabledIndicatorColor = Color.Transparent,
                focusedContainerColor = MaterialTheme.colorScheme.surfaceContainer,
                unfocusedContainerColor = MaterialTheme.colorScheme.surfaceContainer,
            ),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { run(query, filters, activeMode) }),
            modifier = Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 8.dp),
        )

        LazyRow(
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            item {
                FilterBtn(
                    Icons.Outlined.Group, "People", filters.personIds.size.takeIf { it > 0 }?.let { "People ($it)" },
                ) { dialog = "people" }
            }
            item { FilterBtn(Icons.Outlined.Place, "Location", filters.country) { dialog = "location" } }
            item { FilterBtn(Icons.Outlined.CameraAlt, "Camera", filters.make) { dialog = "camera" } }
            item {
                val label = when {
                    filters.from != null && filters.to != null -> "${filters.from!!.format(shortDate)} – ${filters.to!!.format(shortDate)}"
                    filters.from != null -> "From ${filters.from!!.format(shortDate)}"
                    else -> null
                }
                FilterBtn(Icons.Outlined.CalendarMonth, "Date", label) { dialog = "date" }
            }
        }

        val source = results
        if (source == null) {
            QuickSearch(
                onRecentlyTaken = { run("", filters, activeMode, recentlyTaken = true) },
                onRecentlyAdded = { apply(SearchFilters(addedRecently = true)) },
                onVideos = { apply(SearchFilters(type = "VIDEO")) },
                onFavorites = { apply(SearchFilters(favoritesOnly = true)) },
            )
        } else {
            AssetSourceScreen(
                title = "",
                source = source,
                kind = SourceKind.Library,
                showTopBar = false,
                emptyMessage = "No results",
                onOpen = { onOpenViewer(SEARCH_SOURCE_KEY, it) },
                modifier = Modifier.fillMaxSize(),
            )
        }
    }

    when (dialog) {
        "people" -> PickDialog(
            title = "People",
            options = people.map { it.id to it.name },
            selected = filters.personIds,
            multi = true,
            leading = { id -> AsyncImage(app.api.personThumbnailUrl(id, null), null, Modifier.size(40.dp).clip(CircleShape), contentScale = ContentScale.Crop) },
            emptyText = "No named people yet",
            onDismiss = { dialog = null },
            onDone = { dialog = null; apply(filters.copy(personIds = it)) },
        )
        "location" -> RemoteChoiceDialog("Location", "country", filters.country, { dialog = null }) { dialog = null; apply(filters.copy(country = it)) }
        "camera" -> RemoteChoiceDialog("Camera", "camera-make", filters.make, { dialog = null }) { dialog = null; apply(filters.copy(make = it)) }
        "date" -> DateRangeDialog(filters.from, filters.to, { dialog = null }) { f, t -> dialog = null; apply(filters.copy(from = f, to = t)) }
    }
}

@Composable
private fun FilterBtn(icon: ImageVector, label: String, value: String?, onClick: () -> Unit) {
    FilterChip(
        selected = value != null,
        onClick = onClick,
        label = { Text(value ?: label, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.widthIn(max = 200.dp)) },
        leadingIcon = { Icon(icon, null, Modifier.size(20.dp)) },
        shape = RoundedCornerShape(50),
    )
}

/** The page before a search: a hint and the four ready-made searches of the official app. */
@Composable
private fun QuickSearch(onRecentlyTaken: () -> Unit, onRecentlyAdded: () -> Unit, onVideos: () -> Unit, onFavorites: () -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), horizontalAlignment = Alignment.CenterHorizontally) {
        Spacer(Modifier.height(48.dp))
        Box(
            Modifier.size(120.dp).clip(CircleShape).background(MaterialTheme.colorScheme.surfaceContainerHigh),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.PhotoCamera, null, Modifier.size(56.dp), tint = MaterialTheme.colorScheme.primary)
        }
        Text(
            "Search for your photos and videos",
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 24.dp, bottom = 32.dp, start = 16.dp, end = 16.dp),
        )
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.surfaceContainer,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
        ) {
            Column {
                QuickRow(Icons.Outlined.Schedule, "Recently taken", onRecentlyTaken)
                QuickRow(Icons.Outlined.FileUpload, "Recently added", onRecentlyAdded)
                QuickRow(Icons.Outlined.PlayCircleOutline, "Videos", onVideos)
                QuickRow(Icons.Outlined.FavoriteBorder, "Favorites", onFavorites)
            }
        }
    }
}

@Composable
private fun QuickRow(icon: ImageVector, label: String, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 20.dp, vertical = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, Modifier.size(28.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(label, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(start = 20.dp))
    }
}

/** A list to pick from, one value or several. */
@Composable
private fun PickDialog(
    title: String,
    options: List<Pair<String, String>>,
    selected: Set<String>,
    multi: Boolean,
    onDismiss: () -> Unit,
    onDone: (Set<String>) -> Unit,
    emptyText: String = "Nothing to choose from",
    leading: (@Composable (String) -> Unit)? = null,
) {
    var picked by remember { mutableStateOf(selected) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            if (options.isEmpty()) {
                Text(emptyText)
            } else {
                LazyColumn {
                    items(options, key = { it.first }) { (id, name) ->
                        val on = id in picked
                        ListItem(
                            headlineContent = { Text(name, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                            leadingContent = leading?.let { l -> { l(id) } },
                            trailingContent = {
                                if (multi) Checkbox(on, null) else RadioButton(on, null)
                            },
                            modifier = Modifier.clickable {
                                picked = if (multi) (if (on) picked - id else picked + id) else if (on) emptySet() else setOf(id)
                            },
                        )
                    }
                }
            }
        },
        confirmButton = { TextButton({ onDone(picked) }) { Text("Apply") } },
        dismissButton = { TextButton({ onDone(emptySet()) }) { Text("Clear") } },
    )
}

/** Values the server knows (countries, camera makes), loaded when the dialog opens. */
@Composable
private fun RemoteChoiceDialog(title: String, type: String, selected: String?, onDismiss: () -> Unit, onDone: (String?) -> Unit) {
    val api = LocalContext.current.app.api
    var values by remember { mutableStateOf<List<String>?>(null) }
    LaunchedEffect(type) { values = runCatching { api.suggestions(type).filter { it.isNotBlank() }.sorted() }.getOrDefault(emptyList()) }
    if (values == null) {
        AlertDialog(onDismissRequest = onDismiss, title = { Text(title) }, text = { Text("Loading…") }, confirmButton = {
            TextButton(onDismiss) { Text("Cancel") }
        })
    } else {
        PickDialog(
            title = title,
            options = values.orEmpty().map { it to it },
            selected = setOfNotNull(selected),
            multi = false,
            emptyText = "No $title values found",
            onDismiss = onDismiss,
            onDone = { onDone(it.firstOrNull()) },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DateRangeDialog(from: LocalDate?, to: LocalDate?, onDismiss: () -> Unit, onDone: (LocalDate?, LocalDate?) -> Unit) {
    val state = rememberDateRangePickerState(
        initialSelectedStartDateMillis = from?.atStartOfDay(ZoneOffset.UTC)?.toInstant()?.toEpochMilli(),
        initialSelectedEndDateMillis = to?.atStartOfDay(ZoneOffset.UTC)?.toInstant()?.toEpochMilli(),
    )
    fun day(ms: Long?) = ms?.let { Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate() }
    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton({
                val start = day(state.selectedStartDateMillis)
                onDone(start, day(state.selectedEndDateMillis) ?: start)
            }) { Text("Apply") }
        },
        dismissButton = { TextButton({ onDone(null, null) }) { Text("Clear") } },
    ) { DateRangePicker(state, modifier = Modifier.height(520.dp)) }
}

@Composable
fun PersonAvatar(person: PersonDto, onClick: () -> Unit, size: Int = 72, showName: Boolean = true) {
    val api = LocalContext.current.app.api
    Column(
        Modifier
            .width((size + 8).dp)
            .clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        AsyncImage(
            model = api.personThumbnailUrl(person.id, person.updatedAt),
            contentDescription = person.name,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .size(size.dp)
                .clip(CircleShape),
        )
        if (showName) Text(
            person.name.ifBlank { "Unnamed" },
            style = MaterialTheme.typography.labelMedium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}
