package app.immich.mobile.ui.local

import android.text.format.Formatter
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Photo
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import app.immich.mobile.ui.components.ImmichSwitch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.immich.mobile.app
import app.immich.mobile.backup.LocalAsset
import app.immich.mobile.backup.LocalMedia
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

private enum class CleanupStep { SelectDate, Scan, Delete }

private val mediumDate: DateTimeFormatter = DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)

/** The screen of the "Free Up Space" action of the profile menu. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CleanupScreen(onBack: () -> Unit) {
    val snackbar = remember { SnackbarHostState() }
    Scaffold(
        contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0),
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                title = { Text("Free Up Space") },
                navigationIcon = { IconButton(onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
            )
        },
    ) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) { FreeUpSpacePage(onDone = onBack) }
    }
}

/**
 * Free Up Space like the official page: choose what always stays on the phone, pick a cutoff date, scan for the
 * photos and videos that are safely on the server, and move them to the trash of the phone.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FreeUpSpacePage(onDone: () -> Unit) {
    val context = LocalContext.current
    val app = context.app
    val prefs = app.prefs
    val backup = app.backup
    val haptic = androidx.compose.ui.platform.LocalHapticFeedback.current
    val buzz = { if (prefs.haptics) haptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress) }
    val snapshot by backup.local.collectAsState()
    val scope = rememberCoroutineScope()
    var step by remember { mutableStateOf(CleanupStep.SelectDate) }
    var cutoff by remember { mutableStateOf<LocalDate?>(null) }
    var found by remember { mutableStateOf<List<LocalAsset>>(emptyList()) }
    var hasScanned by remember { mutableStateOf(false) }
    var scanning by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf(false) }
    var keepOpen by remember { mutableStateOf(false) }
    var pickDate by remember { mutableStateOf(false) }
    var confirm by remember { mutableStateOf(false) }
    var preview by remember { mutableStateOf(false) }
    var deleted by remember { mutableStateOf<Int?>(null) }
    var pending by remember { mutableStateOf(0) }

    val moveToTrash = rememberDeviceDelete(trash = true) { ok ->
        deleting = false
        if (ok) deleted = pending
        scope.launch { backup.scanDevice() }
        if (!ok) step = CleanupStep.SelectDate
    }

    val zone = ZoneId.systemDefault()
    val albums = remember(snapshot.assets) {
        snapshot.assets.groupBy { it.bucketId }.map { (id, list) -> Triple(id, list.first().bucketName, list.size) }
            .sortedByDescending { it.third }
    }
    val keepAlbums = prefs.keepAlbumIds
    val hasKeep = prefs.keepFavorites || keepAlbums.isNotEmpty() || prefs.keepMediaType != "none"

    fun resetScan() {
        hasScanned = false
        found = emptyList()
        step = CleanupStep.Scan
    }

    suspend fun scan() {
        val date = cutoff ?: return
        scanning = true
        if (LocalMedia.hasPermission(context)) backup.scanDevice()
        val limit = date.atStartOfDay(zone).toInstant().toEpochMilli()
        val state = backup.local.value
        found = state.assets.filter { asset ->
            asset.cacheKey in state.backedUp &&
                asset.takenAt < limit &&
                !(prefs.keepFavorites && asset.isFavorite) &&
                asset.bucketId !in keepAlbums &&
                !(prefs.keepMediaType == "photos" && !asset.isVideo) &&
                !(prefs.keepMediaType == "videos" && asset.isVideo)
        }
        hasScanned = true
        scanning = false
        if (found.isNotEmpty()) step = CleanupStep.Delete
    }

    val step1 = if (cutoff != null) StepMark.Complete else StepMark.Indexed
    val step2 = if (hasScanned && found.isNotEmpty()) StepMark.Complete else if (cutoff != null) StepMark.Indexed else StepMark.Disabled
    val step3 = if (hasScanned && found.isNotEmpty()) StepMark.Indexed else StepMark.Disabled
    val secondary = MaterialTheme.colorScheme.onSurface.copy(alpha = 215 / 255f)

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        Box(
            Modifier
                .padding(16.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(MaterialTheme.colorScheme.surfaceContainerLow)
                .border25(MaterialTheme.colorScheme.primary)
                .padding(16.dp),
        ) {
            Text(
                "Move backed-up photos and videos to your device's trash to free up space. Your copies on the server remain safe.",
                style = MaterialTheme.typography.bodyMedium,
            )
        }

        // what stays on the phone
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = if (hasKeep) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.15f) else MaterialTheme.colorScheme.surfaceContainerLow,
            border = BorderStroke(
                if (hasKeep) 1.5.dp else 1.dp,
                if (hasKeep) MaterialTheme.colorScheme.primary.copy(alpha = 0.5f) else MaterialTheme.colorScheme.outlineVariant,
            ),
            modifier = Modifier.padding(horizontal = 12.dp).fillMaxWidth(),
        ) {
            Column {
                Row(
                    Modifier.fillMaxWidth().clickable { keepOpen = !keepOpen }.padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        if (hasKeep) Icons.Filled.Bookmark else Icons.Filled.BookmarkBorder,
                        null,
                        tint = if (hasKeep) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Column(Modifier.weight(1f).padding(start = 16.dp)) {
                        Text(
                            "Keep on device",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.W600,
                            color = if (hasKeep) MaterialTheme.colorScheme.primary else Color.Unspecified,
                        )
                        val parts = buildList {
                            if (prefs.keepMediaType == "photos") add("All photos")
                            if (prefs.keepMediaType == "videos") add("All videos")
                            if (prefs.keepFavorites) add("Favorites")
                            if (keepAlbums.isNotEmpty()) add("Keeping ${keepAlbums.size} ${if (keepAlbums.size == 1) "album" else "albums"}")
                        }
                        Text(
                            if (hasKeep) "Keeping: ${parts.joinToString(", ")}" else "Select items to keep on this device",
                            style = MaterialTheme.typography.bodySmall,
                            color = if (hasKeep) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Icon(if (keepOpen) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore, null)
                }
                if (keepOpen) {
                    Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp)) {
                        Text("Choose what stays on your device when freeing up space.", style = MaterialTheme.typography.bodyMedium, color = secondary)
                        Row(Modifier.fillMaxWidth().padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                "Keep favorites",
                                style = MaterialTheme.typography.bodyLarge,
                                fontWeight = FontWeight.W500,
                                modifier = Modifier.weight(1f),
                            )
                            ImmichSwitch(prefs.keepFavorites, { prefs.keepFavorites = it; resetScan() })
                        }
                        Text(
                            "Keep albums",
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.W600,
                            modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
                        )
                        if (albums.isEmpty()) {
                            Text("No albums found", style = MaterialTheme.typography.bodyMedium, color = secondary)
                        }
                        albums.forEach { (id, name, count) ->
                            val on = id in keepAlbums
                            Row(
                                Modifier.fillMaxWidth().clickable {
                                    prefs.keepAlbumIds = if (on) keepAlbums - id else keepAlbums + id
                                    resetScan()
                                }.padding(vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(
                                    if (on) Icons.Filled.CheckCircle else Icons.Outlined.Circle,
                                    null,
                                    tint = if (on) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                Text(
                                    name,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = if (on) FontWeight.W600 else FontWeight.Normal,
                                    modifier = Modifier.weight(1f).padding(start = 12.dp),
                                )
                                Text("$count", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                        Text(
                            "Always keep",
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.W600,
                            modifier = Modifier.padding(top = 8.dp, bottom = 8.dp),
                        )
                        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                            val options = listOf("none" to "—", "photos" to "Photos", "videos" to "Videos")
                            options.forEachIndexed { index, (key, label) ->
                                SegmentedButton(
                                    selected = prefs.keepMediaType == key,
                                    onClick = { prefs.keepMediaType = key; resetScan() },
                                    shape = SegmentedButtonDefaults.itemShape(index, options.size),
                                    icon = {
                                        if (key == "photos") Icon(Icons.Filled.Photo, null, Modifier.size(18.dp))
                                        if (key == "videos") Icon(Icons.Filled.Videocam, null, Modifier.size(18.dp))
                                    },
                                ) { Text(label) }
                            }
                        }
                        if (prefs.keepMediaType != "none") {
                            Text(
                                if (prefs.keepMediaType == "photos") "Free Up Space will keep all photos on this device."
                                else "Free Up Space will keep all videos on this device.",
                                style = MaterialTheme.typography.bodySmall,
                                color = secondary,
                                modifier = Modifier.padding(top = 8.dp),
                            )
                        }
                    }
                }
            }
        }

        Column(Modifier.padding(horizontal = 16.dp, vertical = 16.dp)) {
            StepItem(
                index = 1,
                title = "Select cutoff date",
                subtitle = cutoff?.format(mediumDate),
                mark = step1,
                expanded = step == CleanupStep.SelectDate,
                last = false,
                onHeaderClick = { step = CleanupStep.SelectDate },
            ) {
                Text("Keep photos from the last…", style = MaterialTheme.typography.bodyMedium, color = secondary)
                Spacer(Modifier.height(16.dp))
                val presets = listOf(
                    Triple("30", "days", 30L), Triple("60", "days", 60L), Triple("90", "days", 90L),
                    Triple("1", "year", 365L), Triple("2", "years", 730L), Triple("3", "years", 1095L),
                )
                presets.chunked(3).forEach { row ->
                    Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        row.forEach { (value, unit, days) ->
                            val date = LocalDate.now().minusDays(days)
                            PresetCard(value, unit, cutoff == date, Modifier.weight(1f)) {
                                buzz()
                                cutoff = date
                                hasScanned = false
                                found = emptyList()
                            }
                        }
                    }
                }
                Spacer(Modifier.height(8.dp))
                OutlinedButton({ buzz(); pickDate = true }, Modifier.fillMaxWidth().height(48.dp)) {
                    Icon(Icons.Filled.CalendarToday, null)
                    Text("Custom date", Modifier.padding(start = 8.dp))
                }
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = {
                        buzz()
                        step = CleanupStep.Scan
                        scope.launch { scan() }
                    },
                    enabled = cutoff != null,
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                ) {
                    Icon(Icons.Filled.ArrowForward, null)
                    Text("Continue", Modifier.padding(start = 8.dp))
                }
            }
            StepItem(
                index = 2,
                title = "Scan",
                subtitle = if (hasScanned) {
                    if (found.isNotEmpty()) {
                        "Found ${found.size} backed up assets (${Formatter.formatFileSize(context, found.sumOf { it.size })})"
                    } else {
                        "Found 0 backed up assets"
                    }
                } else {
                    null
                },
                mark = step2,
                expanded = step == CleanupStep.Scan,
                last = false,
                onHeaderClick = { if (cutoff != null) step = CleanupStep.Scan },
            ) {
                Text("Scan for backed up assets matching your date and keep settings.", style = MaterialTheme.typography.bodyMedium, color = secondary)
                Spacer(Modifier.height(16.dp))
                if (scanning) {
                    Box(Modifier.fillMaxWidth().height(48.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                } else {
                    Button({ buzz(); scope.launch { scan() } }, Modifier.fillMaxWidth().height(48.dp)) {
                        Icon(Icons.Filled.Search, null)
                        Text(if (hasScanned) "Rescan" else "Scan", Modifier.padding(start = 8.dp))
                    }
                }
                if (hasScanned && found.isEmpty() && !scanning) {
                    Row(Modifier.padding(top = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Info, null, tint = Color(0xFFFF9800))
                        Text(
                            "No assets found matching the criteria above. Free Up Space can only remove assets that have been backed up to the server",
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.padding(start = 12.dp),
                        )
                    }
                }
            }
            StepItem(
                index = 3,
                title = "Move to device trash",
                subtitle = null,
                mark = step3,
                expanded = step == CleanupStep.Delete,
                last = true,
                destructive = true,
                onHeaderClick = { if (found.isNotEmpty()) step = CleanupStep.Delete },
            ) {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f))
                        .padding(16.dp),
                ) {
                    Text(
                        "${found.size} assets (created before ${cutoff?.format(mediumDate)}) to remove from your local device. Photos will remain accessible from the Immich app.",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
                Spacer(Modifier.height(16.dp))
                OutlinedButton({ preview = true }, Modifier.fillMaxWidth().height(48.dp)) {
                    Icon(Icons.Outlined.Visibility, null)
                    Text("Preview", Modifier.padding(start = 8.dp))
                }
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = { buzz(); confirm = true },
                    enabled = !deleting && found.isNotEmpty(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error,
                        contentColor = MaterialTheme.colorScheme.onError,
                    ),
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                ) {
                    if (deleting) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onError)
                    else Icon(Icons.Filled.DeleteForever, null)
                    Text(if (deleting) "Moving to trash..." else "Move to device trash", Modifier.padding(start = 8.dp))
                }
            }
        }
        Spacer(Modifier.height(60.dp))
    }

    if (pickDate) {
        val state = rememberDatePickerState(
            initialSelectedDateMillis = (cutoff ?: LocalDate.now()).atStartOfDay(ZoneId.of("UTC")).toInstant().toEpochMilli(),
        )
        DatePickerDialog(
            onDismissRequest = { pickDate = false },
            confirmButton = {
                TextButton({
                    state.selectedDateMillis?.let {
                        cutoff = Instant.ofEpochMilli(it).atZone(ZoneId.of("UTC")).toLocalDate()
                        hasScanned = false
                        found = emptyList()
                    }
                    pickDate = false
                }) { Text("Ok") }
            },
            dismissButton = { TextButton({ pickDate = false }) { Text("Cancel") } },
        ) { DatePicker(state) }
    }
    if (confirm) {
        AlertDialog(
            onDismissRequest = { confirm = false },
            title = { Text("Remove from this device?") },
            text = {
                Text("Immich found ${found.size} assets (created before ${cutoff?.format(mediumDate)}) safely backed up to the server. Remove the local copies from this device?")
            },
            dismissButton = { TextButton({ confirm = false }) { Text("Cancel") } },
            confirmButton = {
                TextButton({
                    confirm = false
                    deleting = true
                    pending = found.size
                    moveToTrash(found.map { it.uri })
                }) { Text("Confirm", color = MaterialTheme.colorScheme.error) }
            },
        )
    }
    deleted?.let { count ->
        AlertDialog(
            onDismissRequest = {},
            icon = { Icon(Icons.Filled.CheckCircle, null, Modifier.size(48.dp), tint = MaterialTheme.colorScheme.primary) },
            title = { Text("Success") },
            text = {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Moved $count assets to device trash", textAlign = TextAlign.Center)
                    Text(
                        "To fully reclaim storage space, open the system gallery app and empty the trash",
                        style = MaterialTheme.typography.bodySmall,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
            },
            confirmButton = { Button({ deleted = null; onDone() }) { Text("Done") } },
        )
    }
    if (preview) {
        AlertDialog(
            onDismissRequest = { preview = false },
            title = { Text("Preview") },
            text = {
                LazyVerticalGrid(GridCells.Fixed(3), Modifier.height(360.dp), horizontalArrangement = Arrangement.spacedBy(2.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    items(found, key = { it.id }) { asset ->
                        AsyncImage(
                            model = asset.uri.toString(),
                            contentDescription = null,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.aspectRatio(1f),
                        )
                    }
                }
            },
            confirmButton = { TextButton({ preview = false }) { Text("Done") } },
        )
    }
}

private fun Modifier.border25(color: Color): Modifier =
    this.then(Modifier.border(BorderStroke(1.dp, color.copy(alpha = 0.25f)), RoundedCornerShape(12.dp)))

private enum class StepMark { Complete, Indexed, Disabled }

@Composable
private fun PresetCard(value: String, unit: String, selected: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val primary = MaterialTheme.colorScheme.primary
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        color = if (selected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 100 / 255f) else MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, if (selected) primary else Color.Transparent),
        modifier = modifier,
    ) {
        Column(Modifier.padding(vertical = 12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                value,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = if (selected) primary else MaterialTheme.colorScheme.onSurface,
            )
            Text(
                unit,
                style = MaterialTheme.typography.bodySmall,
                color = if (selected) primary else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
            )
        }
    }
}

/** One step of the vertical stepper: a numbered circle, a title, and the content while it is the current step. */
@Composable
private fun StepItem(
    index: Int,
    title: String,
    subtitle: String?,
    mark: StepMark,
    expanded: Boolean,
    last: Boolean,
    onHeaderClick: () -> Unit,
    destructive: Boolean = false,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val circle = when (mark) {
        StepMark.Complete -> colors.primary
        StepMark.Disabled -> colors.onSurface.copy(alpha = 0.38f)
        StepMark.Indexed -> if (destructive) colors.error else colors.onSurface.copy(alpha = 0.6f)
    }
    Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(24.dp)) {
            Box(Modifier.size(24.dp).clip(CircleShape).background(circle), contentAlignment = Alignment.Center) {
                if (mark == StepMark.Complete) {
                    Icon(Icons.Filled.Check, null, Modifier.size(14.dp), tint = colors.onPrimary)
                } else {
                    Text("$index", color = if (destructive && mark == StepMark.Indexed) colors.onError else colors.surface, fontWeight = FontWeight.W500, style = MaterialTheme.typography.labelMedium)
                }
            }
            if (!last) Box(Modifier.width(1.dp).weight(1f).fillMaxHeight().background(colors.outlineVariant))
        }
        Column(Modifier.padding(start = 12.dp, bottom = if (last) 0.dp else 8.dp).weight(1f)) {
            Column(Modifier.clickable(onClick = onHeaderClick)) {
                Text(
                    title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.W600,
                    color = if (mark == StepMark.Complete) colors.primary else colors.onSurface,
                )
                if (subtitle != null) {
                    Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = colors.primary, fontWeight = FontWeight.W500)
                }
            }
            if (expanded) {
                Column(Modifier.padding(top = 12.dp, bottom = 8.dp).fillMaxWidth()) { content() }
            }
        }
    }
}
