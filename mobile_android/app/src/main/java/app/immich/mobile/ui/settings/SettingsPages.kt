package app.immich.mobile.ui.settings

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.PlaylistRemove
import androidx.compose.material.icons.outlined.CellTower
import androidx.compose.material.icons.outlined.ChargingStation
import androidx.compose.material.icons.outlined.Dns
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.GroupWork
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Http
import androidx.compose.material.icons.outlined.Https
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.IosShare
import androidx.compose.material.icons.outlined.NotificationsActive
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material.icons.outlined.Slideshow
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material.icons.outlined.Vibration
import androidx.compose.material.icons.outlined.VideoCameraBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import app.immich.mobile.BuildConfig
import app.immich.mobile.app
import app.immich.mobile.backup.LocalMedia
import app.immich.mobile.data.AppLog
import app.immich.mobile.data.ClientCert
import app.immich.mobile.data.NetworkSwitcher
import app.immich.mobile.data.ThemePreset
import app.immich.mobile.ui.theme.GoogleSansCode
import coil3.SingletonImageLoader
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

internal fun formatBytes(bytes: Long): String {
    if (bytes < 1024) return "$bytes B"
    val units = arrayOf("KiB", "MiB", "GiB", "TiB")
    var value = bytes.toDouble()
    var unit = -1
    while (value >= 1024 && unit < units.lastIndex) {
        value /= 1024
        unit++
    }
    return "%.1f %s".format(value, units[unit])
}

// ---- Advanced -----------------------------------------------------------------------------------------------------

@Composable
internal fun AdvancedPage(onOpenHeaders: () -> Unit, snackbar: SnackbarHostState) {
    val context = LocalContext.current
    val app = context.app
    val prefs = app.prefs
    val scope = rememberCoroutineScope()
    val supportsManageMedia = Build.VERSION.SDK_INT >= 31
    var canManageMedia by remember { mutableStateOf(supportsManageMedia && MediaStore.canManageMedia(context)) }
    var hasCert by remember { mutableStateOf(ClientCert.exists()) }
    var certBytes by remember { mutableStateOf<ByteArray?>(null) }
    // coming back from the system screen where the access is granted
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME && supportsManageMedia) canManageMedia = MediaStore.canManageMedia(context)
        }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer) }
    }
    val pickCert = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            scope.launch {
                certBytes = withContext(Dispatchers.IO) { context.contentResolver.openInputStream(uri)?.use { it.readBytes() } }
            }
        }
    }
    fun openManageMedia() {
        val intent = Intent(Settings.ACTION_REQUEST_MANAGE_MEDIA, Uri.parse("package:${context.packageName}"))
        runCatching { context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    }
    val levelName = AppLog.levelNames.getOrElse(prefs.logLevel) { "INFO" }

    SettingsList {
        item {
            SwitchTile("Troubleshooting", "Enable additional features for troubleshooting", prefs.troubleshooting) { prefs.troubleshooting = it }
        }
        if (supportsManageMedia) {
            item {
                Column {
                    SwitchTile(
                        "Sync remote deletions [EXPERIMENTAL]",
                        "Automatically delete or restore an asset on this device when that action is taken on the web",
                        prefs.syncRemoteDeletions,
                    ) {
                        prefs.syncRemoteDeletions = it
                        if (it && !canManageMedia) openManageMedia()
                    }
                    ActionTile(
                        title = "Media Management Access",
                        subtitle = "This permission is required for proper handling of moving assets to the trash and restoring them from it.",
                        statusText = if (canManageMedia) "Allowed" else "Not allowed",
                        statusColor = if (prefs.syncRemoteDeletions && !canManageMedia) Color(0xFFF3BC6A) else null,
                        onClick = ::openManageMedia,
                    )
                }
            }
        }
        item {
            SliderTile("Log level: $levelName", prefs.logLevel, 1..8, label = levelName) {
                prefs.logLevel = it
                AppLog.minLevel = it
            }
        }
        item {
            SwitchTile(
                "Prefer remote images",
                "Some devices are painfully slow to load thumbnails from local assets. Activate this setting to load remote images instead.",
                prefs.preferRemoteImage,
            ) { prefs.preferRemoteImage = it }
        }
        item {
            SettingTile(
                "Custom proxy headers [EXPERIMENTAL]",
                "Define proxy headers Immich should send with each network request",
                onClick = onOpenHeaders,
                startPadding = 20.dp,
            )
        }
        item {
            Column(Modifier.padding(horizontal = 20.dp)) {
                Text("SSL client certificate [EXPERIMENTAL]", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.W500)
                Text(
                    "Supports PKCS12 (.p12, .pfx) format only. Certificate import/removal is available only before login",
                    style = MaterialTheme.typography.bodyMedium,
                    color = secondaryColor(),
                    modifier = Modifier.padding(top = 4.dp),
                )
                Row(
                    Modifier.fillMaxWidth().padding(top = 6.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                ) {
                    Button({ pickCert.launch(arrayOf("*/*")) }) { Text("Import") }
                    Button(
                        {
                            ClientCert.remove()
                            app.api.reloadClientCertificate()
                            hasCert = false
                            AppLog.i("ClientCert", "Client certificate removed")
                            scope.launch { snackbar.showSnackbar("Client certificate is removed") }
                        },
                        enabled = hasCert,
                    ) { Text("Remove") }
                }
            }
        }
        item {
            SwitchTile(
                "Read-only mode",
                "Enables the read-only mode where the photos can be only viewed, things like selecting multiple images, sharing, casting, delete are all disabled. Enable/Disable read-only via user avatar from the main screen",
                prefs.readOnlyMode,
            ) {
                prefs.readOnlyMode = it
                scope.launch { snackbar.showSnackbar(if (it) "Read-only mode enabled" else "Read-only mode disabled") }
            }
        }
        item {
            SettingTile(
                "Clear Image Cache",
                leading = { Icon(Icons.Filled.PlaylistRemove, null) },
                startPadding = 16.dp,
                onClick = {
                    scope.launch {
                        try {
                            val loader = SingletonImageLoader.get(context)
                            val before = (loader.diskCache?.size ?: 0L) + withContext(Dispatchers.IO) {
                                File(context.cacheDir, "shared").walkTraverse()
                            }
                            loader.memoryCache?.clear()
                            loader.diskCache?.clear()
                            withContext(Dispatchers.IO) { File(context.cacheDir, "shared").deleteRecursively() }
                            snackbar.showSnackbar("Successfully cleared ${formatBytes(before)}")
                        } catch (e: Exception) {
                            AppLog.w("Cache", "Failed to clear the image cache", e)
                            snackbar.showSnackbar("Failed to clear image cache")
                        }
                    }
                },
            )
        }
    }

    certBytes?.let { bytes ->
        var password by remember { mutableStateOf("") }
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { certBytes = null },
            title = { Text("Certificate Password") },
            text = {
                androidx.compose.material3.OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Enter the password for this certificate") },
                    singleLine = true,
                    visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth(),
                )
            },
            dismissButton = { TextButton({ certBytes = null }) { Text("Cancel") } },
            confirmButton = {
                TextButton({
                    certBytes = null
                    scope.launch {
                        try {
                            withContext(Dispatchers.IO) { ClientCert.import(bytes, password) }
                            app.api.reloadClientCertificate()
                            hasCert = true
                            AppLog.i("ClientCert", "Client certificate imported")
                            snackbar.showSnackbar("Client certificate is imported")
                        } catch (e: Exception) {
                            AppLog.e("ClientCert", "Error importing client cert", e)
                            snackbar.showSnackbar("Invalid certificate file or wrong password")
                        }
                    }
                }) { Text("Confirm") }
            },
        )
    }
}

private fun File.walkTraverse(): Long = if (exists()) walkTopDown().filter { it.isFile }.sumOf { it.length() } else 0L

// ---- Asset viewer -------------------------------------------------------------------------------------------------

@Composable
internal fun AssetViewerPage() {
    val prefs = LocalContext.current.app.prefs

    SettingsList(divider = true) {
        item {
            Column {
                GroupTitle(
                    "Photos",
                    Icons.Outlined.Image,
                    "The detail viewer loads the small thumbnail first, then loads the medium-size preview (if enabled), finally loads the original (if enabled).",
                )
                SwitchTile(
                    "Load original image",
                    "Enable to load the original full-resolution image (large!). Disable to reduce data usage (both network and on device cache).",
                    prefs.loadOriginalImage,
                ) { prefs.loadOriginalImage = it }
            }
        }
        item {
            Column {
                SubTitle("Image Navigation")
                SwitchTile(
                    "Tap to Navigate",
                    "If enabled, you can navigate to the previous/next image by tapping the leftmost/rightmost quarter of the screen.",
                    prefs.tapToNavigate,
                ) { prefs.tapToNavigate = it }
            }
        }
        item {
            Column {
                GroupTitle("Videos", Icons.Outlined.VideoCameraBack)
                SwitchTile(
                    "Auto play videos",
                    "Automatically start playing videos when they are opened",
                    prefs.autoPlayVideo,
                ) { prefs.autoPlayVideo = it }
                SwitchTile("Looping", "Enable to automatically loop a video in the detail viewer.", prefs.loopVideo) { prefs.loopVideo = it }
                SwitchTile(
                    "Force original video",
                    "When streaming a video from the server, play the original even when a transcode is available. May lead to buffering. Videos available locally are played in original quality regardless of this setting.",
                    prefs.loadOriginalVideo,
                ) { prefs.loadOriginalVideo = it }
            }
        }
        item {
            Column {
                GroupTitle("Slideshow", Icons.Outlined.Slideshow)
                SwitchTile("Repeat slideshow", "Loop back to beginning when slideshow ends", prefs.slideshowRepeat) { prefs.slideshowRepeat = it }
                SliderTile("Duration", prefs.slideshowSeconds, 5..30, label = "${prefs.slideshowSeconds}") { prefs.slideshowSeconds = it }
                Column(Modifier.padding(top = 20.dp)) {
                    SubTitle("Look")
                    RadioTile("Contain", prefs.slideshowLook == "contain") { prefs.slideshowLook = "contain" }
                    RadioTile("Cover", prefs.slideshowLook == "cover") { prefs.slideshowLook = "cover" }
                    RadioTile("Blurred background", prefs.slideshowLook == "blurred") { prefs.slideshowLook = "blurred" }
                }
                Column(Modifier.padding(top = 20.dp, bottom = 32.dp)) {
                    SubTitle("Direction")
                    RadioTile("Forward", prefs.slideshowDirection == "forward") { prefs.slideshowDirection = "forward" }
                    RadioTile("Backward", prefs.slideshowDirection == "backward") { prefs.slideshowDirection = "backward" }
                    RadioTile("Shuffle", prefs.slideshowDirection == "shuffle") { prefs.slideshowDirection = "shuffle" }
                }
            }
        }
    }
}

// ---- Backup -------------------------------------------------------------------------------------------------------

@Composable
internal fun BackupSettingsPage(snackbar: SnackbarHostState) {
    val app = LocalContext.current.app
    val settings = app.backup.settings
    val scope = rememberCoroutineScope()
    var wifiOnly by remember { mutableStateOf(settings.wifiOnly) }
    var cellularVideos by remember { mutableStateOf(settings.useCellularForVideos) }
    var cellularPhotos by remember { mutableStateOf(settings.useCellularForPhotos) }
    var charging by remember { mutableStateOf(settings.requireCharging) }
    var delay by remember { mutableStateOf(settings.triggerDelay) }
    var syncAlbums by remember { mutableStateOf(settings.syncAlbums) }
    var organizing by remember { mutableStateOf(false) }
    val delayStep = when (delay) {
        5 -> 0
        30 -> 1
        120 -> 2
        else -> 3
    }
    val delayLabel = listOf("5 seconds", "30 seconds", "2 minutes", "10 minutes")

    SettingsList {
        item { GroupTitle("Network Requirements", Icons.Outlined.CellTower) }
        item {
            SwitchTile(
                "Wi-Fi only",
                "Only back up while connected to Wi-Fi, never over mobile data",
                wifiOnly,
                startPadding = 8.dp,
                endPadding = 11.dp,
            ) {
                wifiOnly = it
                settings.wifiOnly = it
                app.backup.applyAutomatic()
            }
        }
        item {
            // while Wi-Fi only is on, mobile data is off for everything; the two switches keep their own values
            SwitchTile(
                "Videos",
                "Use cellular data to backup videos",
                cellularVideos && !wifiOnly,
                enabled = !wifiOnly,
                startPadding = 8.dp,
                endPadding = 11.dp,
            ) {
                cellularVideos = it
                settings.useCellularForVideos = it
                app.backup.applyAutomatic()
            }
        }
        item {
            SwitchTile(
                "Photos",
                "Use cellular data to backup photos",
                cellularPhotos && !wifiOnly,
                enabled = !wifiOnly,
                startPadding = 8.dp,
                endPadding = 11.dp,
            ) {
                cellularPhotos = it
                settings.useCellularForPhotos = it
                app.backup.applyAutomatic()
            }
        }
        item { androidx.compose.material3.HorizontalDivider() }
        item { GroupTitle("Background Options", Icons.Outlined.ChargingStation) }
        item {
            SwitchTile("Charging", "Background backup requires the device to be charging", charging, startPadding = 8.dp, endPadding = 11.dp) {
                charging = it
                settings.requireCharging = it
                app.backup.applyAutomatic()
            }
        }
        item {
            Column {
                Text(
                    "Delay new assets backup: ${delayLabel[delayStep]}",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.W500,
                    modifier = Modifier.padding(start = 24.dp, top = 8.dp),
                )
                androidx.compose.material3.Slider(
                    value = delayStep.toFloat(),
                    onValueChange = {
                        delay = listOf(5, 30, 120, 600)[it.toInt().coerceIn(0, 3)]
                    },
                    onValueChangeFinished = {
                        settings.triggerDelay = delay
                        app.backup.applyAutomatic()
                    },
                    valueRange = 0f..3f,
                    steps = 2,
                    modifier = Modifier.padding(horizontal = 21.dp),
                )
            }
        }
        item { androidx.compose.material3.HorizontalDivider() }
        item { GroupTitle("Backup Albums Synchronization", Icons.Outlined.Sync) }
        item {
            Column {
                SwitchTile(
                    "Sync albums",
                    "Create and upload your photos and videos to the selected albums on Immich",
                    syncAlbums,
                    startPadding = 8.dp,
                    endPadding = 11.dp,
                ) {
                    syncAlbums = it
                    settings.syncAlbums = it
                    if (it) {
                        scope.launch {
                            organizing = true
                            val added = runCatching { app.backup.organizeIntoAlbums() }
                            organizing = false
                            added.onFailure { e -> snackbar.showSnackbar(e.message ?: "Unable to organize the photos") }
                        }
                    }
                }
                if (syncAlbums) {
                    SettingTile(
                        "Organize into albums",
                        "Put existing photos into albums using current sync settings",
                        trailing = {
                            if (organizing) {
                                CircularProgressIndicator(Modifier.size(28.dp), strokeWidth = 2.dp)
                            } else {
                                Icon(Icons.Outlined.Sync, "Organize", Modifier.size(20.dp))
                            }
                        },
                        onClick = {
                            if (!organizing) {
                                scope.launch {
                                    organizing = true
                                    val result = runCatching { app.backup.organizeIntoAlbums() }
                                    // the spinner stops with the work, not when the snackbar goes away
                                    organizing = false
                                    result
                                        .onSuccess { snackbar.showSnackbar("Organized $it photos into albums") }
                                        .onFailure { e -> snackbar.showSnackbar(e.message ?: "Unable to organize the photos") }
                                }
                            }
                        },
                        startPadding = 32.dp,
                    )
                }
            }
        }
    }
}

// ---- Notifications ------------------------------------------------------------------------------------------------

@Composable
internal fun NotificationsPage() {
    val context = LocalContext.current
    var enabled by remember { mutableStateOf(NotificationManagerCompat.from(context).areNotificationsEnabled()) }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        enabled = NotificationManagerCompat.from(context).areNotificationsEnabled()
    }
    // coming back from the system settings
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) enabled = NotificationManagerCompat.from(context).areNotificationsEnabled()
        }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer) }
    }
    fun openSettings() {
        val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        runCatching { context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    }

    SettingsList {
        item {
            if (!enabled) {
                ButtonTile(
                    Icons.Outlined.Notifications,
                    "Notification Permission",
                    "Grant permission to enable notifications.",
                    "Enable Notifications",
                ) { if (Build.VERSION.SDK_INT >= 33) permission.launch(Manifest.permission.POST_NOTIFICATIONS) else openSettings() }
            } else {
                ButtonTile(
                    Icons.Outlined.NotificationsActive,
                    "Notifications enabled",
                    "Immich uses notifications for background backup. Manage them in your device settings.",
                    "Open settings",
                ) { openSettings() }
            }
        }
    }
}

// ---- Preferences --------------------------------------------------------------------------------------------------

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
internal fun PreferencesPage() {
    val prefs = LocalContext.current.app.prefs
    val systemDark = isSystemInDarkTheme()
    var pickColor by remember { mutableStateOf(false) }

    SettingsList(divider = true) {
        item {
            Column {
                GroupTitle("Theme", Icons.Outlined.Palette)
                SwitchTile("Automatic (Follow system setting)", null, prefs.themeMode == "system") { system ->
                    prefs.themeMode = if (system) "system" else if (systemDark) "dark" else "light"
                }
                if (prefs.themeMode != "system") {
                    SwitchTile("Dark mode", null, prefs.themeMode == "dark") { prefs.themeMode = if (it) "dark" else "light" }
                }
                ListItem(
                    colors = ListItemDefaults.colors(containerColor = Color.Transparent),
                    headlineContent = { Text("Primary color", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.W500) },
                    supportingContent = {
                        Text("Pick a color for primary actions and accents.", style = MaterialTheme.typography.bodyMedium, color = secondaryColor())
                    },
                    trailingContent = { Swatch(ThemePreset.of(prefs.primaryColor), selected = false, size = 42.dp) },
                    modifier = Modifier.clickable { pickColor = true },
                )
                SwitchTile("Colorful interface", "Apply primary color to background surfaces.", prefs.colorfulInterface) {
                    prefs.colorfulInterface = it
                }
            }
        }
        item {
            Column {
                GroupTitle("Haptic Feedback", Icons.Outlined.Vibration)
                SwitchTile("Enabled", null, prefs.haptics) { prefs.haptics = it }
            }
        }
        item {
            Column {
                GroupTitle("Default share quality", Icons.Outlined.IosShare)
                Text(
                    "Quality used when tapping share. Long press the share button to choose each time.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 215 / 255f),
                    modifier = Modifier.padding(horizontal = 20.dp),
                )
                RadioTile("Use original (large)", prefs.shareOriginal) { prefs.shareOriginal = true }
                RadioTile("Use thumbnail (small)", !prefs.shareOriginal) { prefs.shareOriginal = false }
            }
        }
    }

    if (pickColor) {
        ModalBottomSheet(onDismissRequest = { pickColor = false }) {
            Column(Modifier.padding(vertical = 30.dp).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Primary color", style = MaterialTheme.typography.titleLarge)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    Box(
                        Modifier
                            .padding(horizontal = 20.dp)
                            .padding(top = 10.dp)
                            .clip(RoundedCornerShape(15.dp))
                            .background(MaterialTheme.colorScheme.surfaceContainerHigh),
                    ) {
                        SwitchTile("Use system color", null, prefs.dynamicColor) { prefs.dynamicColor = it }
                    }
                }
                FlowRow(
                    horizontalArrangement = Arrangement.Center,
                    modifier = Modifier.padding(horizontal = 20.dp).padding(top = 20.dp),
                ) {
                    ThemePreset.entries.forEach { preset ->
                        Swatch(
                            preset,
                            selected = !prefs.dynamicColor && prefs.primaryColor.equals(preset.name, ignoreCase = true),
                            size = 55.dp,
                            modifier = Modifier.padding(4.dp).clickable {
                                prefs.primaryColor = preset.name
                                prefs.dynamicColor = false
                            },
                        )
                    }
                }
            }
        }
    }
}

/** A color of the picker: the light primary on top and the dark primary below, like the official swatches. */
@Composable
private fun Swatch(preset: ThemePreset, selected: Boolean, size: androidx.compose.ui.unit.Dp, modifier: Modifier = Modifier) {
    Box(modifier.size(size).clip(CircleShape), contentAlignment = Alignment.Center) {
        Column(Modifier.fillMaxSize()) {
            Box(Modifier.weight(1f).fillMaxWidth().background(Color(preset.light)))
            Box(Modifier.weight(1f).fillMaxWidth().background(Color(preset.dark)))
        }
        if (selected) {
            Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.4f)), contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.Check, "Selected", tint = Color.White)
            }
        }
    }
}

// ---- Photo grid ---------------------------------------------------------------------------------------------------

@Composable
internal fun PhotoGridPage(showDevice: Boolean, onShowDevice: (Boolean) -> Unit) {
    val prefs = LocalContext.current.app.prefs
    SettingsList(divider = true) {
        item { SwitchTile("Show photos of this device", "Photos that are not backed up yet appear in the timeline", showDevice, onChange = onShowDevice) }
        item { SwitchTile("Show storage indicator on asset tiles", null, prefs.storageIndicator) { prefs.storageIndicator = it } }
        item {
            SwitchTile(
                "Group similar photos",
                "Photos taken close together that look alike share one tile with their number",
                prefs.groupSimilar,
            ) { prefs.groupSimilar = it }
        }
        item {
            SwitchTile(
                "Smooth timeline scrubbing",
                "Scroll continuously when dragging the scrollbar instead of snapping to months",
                prefs.smoothScrubbing,
            ) { prefs.smoothScrubbing = it }
        }
        item {
            Column {
                GroupTitle("Layout", Icons.Outlined.GridView)
                SliderTile(
                    "Number of assets per row (${prefs.tilesPerRow})",
                    prefs.tilesPerRow,
                    2..6,
                    label = "${prefs.tilesPerRow}",
                ) { prefs.tilesPerRow = it }
            }
        }
        item {
            Column {
                GroupTitle("Group by", Icons.Outlined.GroupWork)
                RadioTile("Month + day", prefs.groupByDay) { prefs.groupByDay = true }
                RadioTile("Month", !prefs.groupByDay) { prefs.groupByDay = false }
            }
        }
    }
}

// ---- What's new ---------------------------------------------------------------------------------------------------

private val releaseNotes = listOf(
    "Library" to "The Library tab looks like the official app: shortcut buttons, collection cards and a list of Folders, Locked Folder and Partners.",
    "Profile menu" to "A profile menu with storage, versions and the Free Up Space, Settings and Sign Out actions.",
    "Settings" to "Settings is a list of sections: Advanced, Asset Viewer, Backup, Free Up Space, Language, Networking, Notifications, Preferences, Photo Grid, Sync Status and What's new.",
    "Appearance" to "Choose light, dark or the system theme, a primary color, or the system's own colors.",
    "Viewer" to "Load the original image, tap the sides to change photo, autoplay and loop videos, and shape the slideshow.",
    "Networking" to "Switch automatically between a local address on your Wi-Fi and external addresses.",
    "Backup" to "Back up chosen albums over Wi-Fi or mobile data, only while charging, and sync them into albums on the server.",
)

@Composable
internal fun WhatsNewPage() {
    Text(
        "Version ${BuildConfig.VERSION_NAME}",
        style = MaterialTheme.typography.titleMedium,
        modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
    )
    releaseNotes.forEach { (title, text) ->
        SettingTile(title, text, startPadding = 20.dp)
    }
}
