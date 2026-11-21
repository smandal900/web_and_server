package app.immich.mobile.ui.settings

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.foundation.layout.offset
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.statusBars
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Deselect
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.SelectAll
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.outlined.Image
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.draw.clip
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.immich.mobile.app
import app.immich.mobile.backup.LocalAlbum
import app.immich.mobile.backup.LocalMedia
import app.immich.mobile.ui.components.ImmichSwitch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.text.DateFormat
import java.util.Date

/** Backup counts as enabled when it is switched on, albums are chosen and the phone's photos can be read. */
fun isBackupEnabled(context: android.content.Context): Boolean {
    val settings = context.app.backup.settings
    return settings.automatic && settings.buckets.isNotEmpty() && LocalMedia.hasPermission(context)
}

/**
 * The upload cloud of the Photos tab: opens the backup page, with a small cloud-off badge while backup is off. While the
 * server cannot be reached ([offline]) it turns into a red "Offline" pill, and while the photos of the device are being
 * checked against the server ([scanning]) into a "Checking" pill with a loader that fills up as [scanProgress] (0 to 1,
 * null while not known yet) grows.
 */
@Composable
fun BackupCloudButton(offline: Boolean = false, scanning: Boolean = false, scanProgress: Float? = null, onClick: () -> Unit) {
    val context = LocalContext.current
    // the state changes while a backup runs; reading it here refreshes the badge
    context.app.backup.state.collectAsState().value
    val enabled = isBackupEnabled(context)
    if (offline) {
        // a red pill in the place of the cloud, still opens the backup page
        Row(
            Modifier
                .padding(horizontal = 4.dp)
                .clip(RoundedCornerShape(50))
                .background(MaterialTheme.colorScheme.errorContainer)
                .clickable(onClickLabel = "Backup", onClick = onClick)
                .padding(horizontal = 12.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Icon(Icons.Filled.CloudOff, null, Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onErrorContainer)
            Text("Offline", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onErrorContainer, maxLines = 1)
        }
        return
    }
    if (scanning) {
        // the same pill as "Offline", in neutral colors, still opens the backup page
        val label = if (scanProgress != null) "Checking ${(scanProgress * 100).toInt()}%" else "Checking"
        Row(
            Modifier
                .padding(horizontal = 4.dp)
                .clip(RoundedCornerShape(50))
                .background(MaterialTheme.colorScheme.secondaryContainer)
                .clickable(onClickLabel = "Backup", onClick = onClick)
                .padding(horizontal = 12.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            if (scanProgress != null) {
                CircularProgressIndicator(
                    progress = { scanProgress.coerceIn(0f, 1f) },
                    modifier = Modifier.size(16.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onSecondaryContainer,
                    trackColor = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.2f),
                )
            } else {
                CircularProgressIndicator(
                    modifier = Modifier.size(16.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onSecondaryContainer,
                    trackColor = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.2f),
                )
            }
            Text(label, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSecondaryContainer, maxLines = 1)
        }
        return
    }
    IconButton(onClick) {
        Box {
            Icon(Icons.Filled.CloudUpload, "Backup")
            if (!enabled) Surface(
                shape = CircleShape,
                color = MaterialTheme.colorScheme.surfaceContainerHighest,
                modifier = Modifier.align(Alignment.BottomEnd).offset(x = 6.dp, y = 6.dp).size(16.dp),
            ) { Icon(Icons.Filled.CloudOff, null, Modifier.padding(2.dp), tint = MaterialTheme.colorScheme.onSurface) }
        }
    }
}

/**
 * The page the upload cloud of the Photos tab opens, laid out like the official backup page: the albums to back up, the
 * three counters (total, backed up, remainder) and the switch that turns backup on.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BackupScreen(onBack: () -> Unit, onOpenSettings: () -> Unit = {}, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val backup = context.app.backup
    val settings = backup.settings
    val state by backup.state.collectAsState()

    var granted by remember { mutableStateOf(LocalMedia.hasPermission(context)) }
    var albums by remember { mutableStateOf<List<LocalAlbum>?>(null) }
    var selected by remember { mutableStateOf(settings.buckets) }
    var excluded by remember { mutableStateOf(settings.excludedBuckets) }
    var videos by remember { mutableStateOf(settings.includeVideos) }
    var enabled by remember { mutableStateOf(isBackupEnabled(context)) }
    var pending by remember { mutableStateOf<Int?>(null) }
    var picking by remember { mutableStateOf(false) }
    var details by remember { mutableStateOf(false) }

    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        granted = LocalMedia.hasPermission(context)
        if (granted) picking = true
    }

    // "Media location": without it Android removes the GPS data from every photo it hands to the app, so the photos
    // would be uploaded without their location. Asked on its own, because the first dialog may have been answered "no".
    var locationGranted by remember { mutableStateOf(LocalMedia.hasLocationAccess(context)) }
    val locationLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        locationGranted = LocalMedia.hasLocationAccess(context)
        // after two refusals Android no longer shows the question: the permission is then given in the app settings
        if (!ok && !locationGranted) {
            context.startActivity(
                android.content.Intent(
                    android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    android.net.Uri.fromParts("package", context.packageName, null),
                ),
            )
        }
    }
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                granted = LocalMedia.hasPermission(context)
                locationGranted = LocalMedia.hasLocationAccess(context)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // The upload progress is shown in a notification, and Android hides it until the notification permission is
    // granted. It used to be asked for only together with the photo permission, so a phone that had already given
    // photo access never got the question and the progress was never visible.
    val notificationLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    fun askForNotifications() {
        if (android.os.Build.VERSION.SDK_INT >= 33 &&
            androidx.core.content.ContextCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS) !=
            android.content.pm.PackageManager.PERMISSION_GRANTED
        ) {
            notificationLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
        }
    }
    LaunchedEffect(Unit) { if (enabled) askForNotifications() }

    LaunchedEffect(granted) {
        if (granted) albums = withContext(Dispatchers.IO) { LocalMedia.albums(context) }
    }
    LaunchedEffect(granted, selected, videos, state.running) {
        pending = if (granted) backup.pendingCount() else null
    }

    val chosen = albums.orEmpty().filter { it.id in selected }
    val total = chosen.sumOf { if (videos) it.count else it.count - it.videoCount }
    val remainder = (pending ?: 0).coerceAtMost(total)
    val backedUp = (total - remainder).coerceAtLeast(0)

    Scaffold(
        modifier = modifier,
        contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0),
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("Backup", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp) },
                navigationIcon = { IconButton(onBack) { Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, "Back", tint = MaterialTheme.colorScheme.primary) } },
                actions = { IconButton(onOpenSettings) { Icon(Icons.Filled.Settings, "Backup settings", tint = MaterialTheme.colorScheme.primary) } },
                expandedHeight = 56.dp,
            )
        },
    ) { padding ->
        Column(
            Modifier.padding(padding).fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            // the albums that are backed up
            BackupCard {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Backup Albums", fontSize = 20.sp, fontWeight = FontWeight.W500)
                        Text("Albums to be backed up", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
                        if (!granted || chosen.isEmpty()) {
                            Text(
                                if (!granted) "Allow access to your photos to back them up" else "No albums selected",
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.padding(top = 8.dp, end = 8.dp),
                            )
                        } else {
                            // every selected folder: its name, then its full path under it
                            chosen.forEach { album ->
                                Text(
                                    album.name,
                                    color = MaterialTheme.colorScheme.primary,
                                    fontWeight = FontWeight.W500,
                                    modifier = Modifier.padding(top = 8.dp, end = 8.dp),
                                )
                                if (album.path.isNotEmpty()) {
                                    Text(
                                        album.path,
                                        fontSize = 12.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.padding(top = 2.dp, end = 8.dp),
                                    )
                                }
                            }
                        }
                    }
                    Button({ if (granted) picking = true else permissionLauncher.launch(LocalMedia.permissions()) }) { Text("Select") }
                }
            }

            if (granted && !locationGranted) {
                BackupCard {
                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("Location of your photos", fontSize = 20.sp, fontWeight = FontWeight.W500)
                            Text(
                                "Allow \"Media location\" to back up photos with the location they were taken at. Without it " +
                                    "Android removes the GPS data, so backup is paused. Your files are never changed.",
                                color = MaterialTheme.colorScheme.error,
                                modifier = Modifier.padding(top = 8.dp, end = 8.dp),
                            )
                        }
                        Button({ locationLauncher.launch(android.Manifest.permission.ACCESS_MEDIA_LOCATION) }) { Text("Allow") }
                    }
                }
            }

            CounterCard("Total", "All unique photos and videos from selected albums", total)
            CounterCard("Backup", "Backed up photos and videos", backedUp)
            BackupCard {
                Column {
                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("Remainder", fontSize = 20.sp, fontWeight = FontWeight.W500)
                            Text(
                                "Remaining photos and videos to back up from selection",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(top = 8.dp, end = 8.dp),
                            )
                        }
                        Count(remainder)
                    }
                    if (state.running && state.total > 0) {
                        LinearProgressIndicator(
                            progress = { (state.done + state.currentProgress).coerceAtMost(state.total.toFloat()) / state.total },
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                        )
                        Text(
                            "${state.done} of ${state.total}" + (state.currentName?.let { " · $it" } ?: ""),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                        )
                    }
                    HorizontalDivider()
                    Row(
                        Modifier.fillMaxWidth().clickable { details = true }.padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("View Details", Modifier.weight(1f))
                        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null)
                    }
                }
            }

            // compares every selected photo with the server, whatever was remembered, and uploads what is missing there
            OutlinedButton(
                { backup.start(force = true) },
                enabled = granted && selected.isNotEmpty() && !state.running,
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) {
                Icon(Icons.Filled.Sync, null, Modifier.size(20.dp))
                Text(if (state.running) "Syncing…" else "Force sync", Modifier.padding(start = 8.dp))
            }
            Text(
                "Checks every photo and video of the selected albums against the server and uploads the ones it does not have.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 8.dp),
            )

            HorizontalDivider(Modifier.padding(vertical = 6.dp))

            // the switch that starts and stops the backup
            Surface(
                shape = RoundedCornerShape(24.dp),
                color = MaterialTheme.colorScheme.surfaceContainerLow,
                border = BorderStroke(1.5.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.35f)),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(Modifier.padding(horizontal = 16.dp, vertical = 20.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier.size(42.dp).background(MaterialTheme.colorScheme.surfaceContainerHighest, CircleShape),
                        contentAlignment = Alignment.Center,
                    ) { Icon(Icons.Filled.CloudUpload, null, tint = MaterialTheme.colorScheme.primary) }
                    Text(
                        "Enable Backup",
                        color = MaterialTheme.colorScheme.primary,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.W500,
                        modifier = Modifier.weight(1f).padding(start = 16.dp),
                    )
                    ImmichSwitch(enabled, { on ->
                        if (on && !granted) {
                            permissionLauncher.launch(LocalMedia.permissions())
                            return@ImmichSwitch
                        }
                        enabled = on
                        if (on) askForNotifications()
                        settings.automatic = on
                        backup.applyAutomatic()
                        if (on) {
                            if (selected.isEmpty()) picking = true else backup.start()
                        } else if (state.running) {
                            backup.cancel()
                        }
                    })
                }
            }

            state.message?.let { message ->
                Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Warning, null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(22.dp))
                    Text(message, color = MaterialTheme.colorScheme.error, textAlign = TextAlign.Center, modifier = Modifier.padding(start = 8.dp))
                }
            }
            if (state.message != null || state.failed > 0) {
                Row(
                    Modifier.fillMaxWidth().clickable { details = true }.padding(vertical = 8.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Outlined.Info, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                    Text("View Details", color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(start = 8.dp))
                }
            }
        }
    }

    if (picking) {
        SelectAlbumsPage(
            albums = albums,
            selected = selected,
            excluded = excluded,
            includeVideos = videos,
            onVideos = { videos = it; settings.includeVideos = it },
            onChange = { inc, exc ->
                selected = inc
                excluded = exc
                settings.buckets = inc
                settings.excludedBuckets = exc
            },
            onClose = { picking = false },
        )
    }

    if (details) {
        AlertDialog(
            onDismissRequest = { details = false },
            title = { Text("Backup details") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(if (state.running) state.phase.ifBlank { "Backing up" } else if (state.phase == "Done") "Backup finished" else "Backup is not running")
                    if (state.finishedAt > 0) {
                        Text("Last run " + DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(state.finishedAt)))
                    }
                    if (state.failed > 0) Text("${state.failed} failed")
                    state.message?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                }
            },
            confirmButton = { TextButton({ details = false }) { Text("Close") } },
            dismissButton = if (granted && !state.running && selected.isNotEmpty()) {
                { TextButton({ details = false; backup.start() }) { Text("Back up now") } }
            } else null,
        )
    }
}

@Composable
private fun BackupCard(content: @Composable () -> Unit) {
    Surface(
        shape = RoundedCornerShape(24.dp),
        color = MaterialTheme.colorScheme.surfaceContainerLow,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.1f)),
        modifier = Modifier.fillMaxWidth(),
        content = content,
    )
}

@Composable
private fun CounterCard(title: String, subtitle: String, count: Int) {
    BackupCard {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(title, fontSize = 20.sp, fontWeight = FontWeight.W500)
                Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp, end = 8.dp))
            }
            Count(count)
        }
    }
}

@Composable
private fun Count(count: Int) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(count.toString(), fontSize = 34.sp, fontWeight = FontWeight.W500)
        Text("assets", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

/** Which device albums are backed up, and whether videos go with them. */
@Composable
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class, ExperimentalFoundationApi::class)
private fun SelectAlbumsPage(
    albums: List<LocalAlbum>?,
    selected: Set<String>,
    excluded: Set<String>,
    includeVideos: Boolean,
    onVideos: (Boolean) -> Unit,
    onChange: (included: Set<String>, excluded: Set<String>) -> Unit,
    onClose: () -> Unit,
) {
    var searching by remember { mutableStateOf(false) }
    var query by remember { mutableStateOf("") }
    var info by remember { mutableStateOf(false) }
    val all = albums.orEmpty()
    // like the official page: the biggest albums first
    val shown = all.filter { query.isBlank() || it.name.contains(query.trim(), ignoreCase = true) }.sortedByDescending { it.count }

    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        Scaffold(
            containerColor = MaterialTheme.colorScheme.surface,
            topBar = {
                CenterAlignedTopAppBar(
                    title = {
                        if (searching) {
                            TextField(
                                value = query,
                                onValueChange = { query = it },
                                placeholder = { Text("Search albums") },
                                singleLine = true,
                                colors = TextFieldDefaults.colors(
                                    focusedIndicatorColor = Color.Transparent,
                                    unfocusedIndicatorColor = Color.Transparent,
                                    focusedContainerColor = Color.Transparent,
                                    unfocusedContainerColor = Color.Transparent,
                                ),
                            )
                        } else {
                            Text("Select albums", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp)
                        }
                    },
                    navigationIcon = {
                        IconButton(onClose) { Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, "Back", tint = MaterialTheme.colorScheme.primary) }
                    },
                    actions = {
                        IconButton({ searching = !searching; if (!searching) query = "" }) {
                            Icon(if (searching) Icons.Filled.Close else Icons.Filled.Search, "Search", tint = MaterialTheme.colorScheme.primary)
                        }
                    },
                    expandedHeight = 56.dp,
                    windowInsets = WindowInsets.statusBars,
                )
            },
        ) { padding ->
            LazyColumn(Modifier.padding(padding).fillMaxSize()) {
                item {
                    Column(Modifier.padding(horizontal = 16.dp)) {
                        Text("Selection Info", fontSize = 20.sp, fontWeight = FontWeight.W500, modifier = Modifier.padding(top = 8.dp, bottom = 12.dp))
                        val chosen = all.filter { it.id in selected }
                        if (chosen.isEmpty()) {
                            Text("No albums selected", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        } else {
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                chosen.forEach { album ->
                                    Surface(
                                        shape = RoundedCornerShape(10.dp),
                                        color = MaterialTheme.colorScheme.primary,
                                        contentColor = MaterialTheme.colorScheme.onPrimary,
                                        modifier = Modifier.clickable { onChange(selected - album.id, excluded) },
                                    ) {
                                        Row(Modifier.padding(start = 16.dp, end = 12.dp, top = 12.dp, bottom = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                                            Text(album.name, fontWeight = FontWeight.W500)
                                            Icon(Icons.Filled.Cancel, "Remove", Modifier.padding(start = 10.dp).size(20.dp))
                                        }
                                    }
                                }
                            }
                        }
                        Row(Modifier.fillMaxWidth().padding(top = 20.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text("Albums on device (${all.size})", fontSize = 20.sp, fontWeight = FontWeight.W500)
                                Text("Tap to include, double tap to exclude", color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 8.dp))
                            }
                            IconButton({ info = true }) { Icon(Icons.Filled.Info, "Info", tint = MaterialTheme.colorScheme.primary) }
                        }
                        Row(Modifier.fillMaxWidth().padding(vertical = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Button(
                                { onChange(all.map { it.id }.toSet(), emptySet()) },
                                Modifier.weight(1f).height(52.dp),
                            ) {
                                Icon(Icons.Filled.SelectAll, null, Modifier.size(20.dp))
                                Text("Select all", Modifier.padding(start = 8.dp))
                            }
                            OutlinedButton(
                                { onChange(emptySet(), emptySet()) },
                                Modifier.weight(1f).height(52.dp),
                            ) {
                                Icon(Icons.Filled.Deselect, null, Modifier.size(20.dp))
                                Text("Deselect All", Modifier.padding(start = 8.dp))
                            }
                        }
                        // not in the official page: the videos setting of this app lives here
                        Row(
                            Modifier.fillMaxWidth().clickable { onVideos(!includeVideos) }.padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("Include videos", Modifier.weight(1f))
                            ImmichSwitch(includeVideos, onVideos)
                        }
                    }
                }
                if (albums == null) {
                    item { Text("Loading albums…", Modifier.padding(16.dp)) }
                }
                items(shown, key = { it.id }) { album ->
                    val isIn = album.id in selected
                    val isOut = album.id in excluded
                    val bg = when {
                        isIn -> MaterialTheme.colorScheme.primary.copy(alpha = 0.3f)
                        isOut -> MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.4f)
                        else -> Color.Transparent
                    }
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .background(bg)
                            .combinedClickable(
                                onClick = { onChange(if (isIn) selected - album.id else selected + album.id, excluded - album.id) },
                                onDoubleClick = { onChange(selected - album.id, if (isOut) excluded - album.id else excluded + album.id) },
                            )
                            .padding(horizontal = 16.dp, vertical = 18.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            Modifier.size(28.dp).background(
                                when {
                                    isIn -> MaterialTheme.colorScheme.primary
                                    isOut -> MaterialTheme.colorScheme.error
                                    else -> MaterialTheme.colorScheme.surfaceContainerHighest
                                },
                                CircleShape,
                            ),
                            contentAlignment = Alignment.Center,
                        ) {
                            when {
                                isIn -> Icon(Icons.Filled.Check, null, Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onPrimary)
                                isOut -> Icon(Icons.Filled.Close, null, Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onError)
                            }
                        }
                        Column(Modifier.weight(1f).padding(start = 20.dp)) {
                            Text(album.name, fontSize = 20.sp, fontWeight = FontWeight.W500)
                            if (album.path.isNotEmpty()) {
                                Text(album.path, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 2.dp))
                            }
                            Text(album.count.toString(), color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp))
                        }
                        Icon(Icons.Outlined.Image, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(32.dp))
                    }
                }
            }
        }
    }

    if (info) {
        AlertDialog(
            onDismissRequest = { info = false },
            title = { Text("Selecting albums") },
            text = { Text("Tap an album to include it in the backup. Double tap to exclude it: an excluded album is never backed up.") },
            confirmButton = { TextButton({ info = false }) { Text("Close") } },
        )
    }
}
