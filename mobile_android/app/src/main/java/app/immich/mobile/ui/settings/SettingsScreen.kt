package app.immich.mobile.ui.settings

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.AutoAwesomeMosaic
import androidx.compose.material.icons.outlined.Build
import androidx.compose.material.icons.outlined.CleaningServices
import androidx.compose.material.icons.outlined.CloudUpload
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.Interests
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.immich.mobile.app
import app.immich.mobile.backup.LocalMedia
import app.immich.mobile.ui.local.FreeUpSpacePage
import kotlinx.coroutines.launch

/** The sections of the settings list, with the icon, title and subtitle of the official app's cards. */
private enum class Section(val icon: ImageVector, val title: String, val subtitle: String) {
    Advanced(Icons.Outlined.Build, "Advanced", "Advanced user's settings"),
    AssetViewer(Icons.Outlined.Image, "Asset Viewer", "Manage your gallery viewer settings"),
    Backup(Icons.Outlined.CloudUpload, "Backup", "Manage upload settings"),
    FreeUpSpace(Icons.Outlined.CleaningServices, "Free Up Space", "Free up device storage"),
    Language(Icons.Filled.Language, "Language", "Change the app's language"),
    Networking(Icons.Filled.Wifi, "Networking", "Manage the server endpoint settings"),
    Notifications(Icons.Outlined.NotificationsNone, "Notifications", "Adjust your notification preferences"),
    Preferences(Icons.Outlined.Interests, "Preferences", "Manage the app's preferences"),
    PhotoGrid(Icons.Outlined.AutoAwesomeMosaic, "Photo Grid", "Photo grid layout settings"),
    SyncStatus(Icons.Outlined.Sync, "Sync Status", "View and manage the sync system"),
    WhatsNew(Icons.Outlined.AutoAwesome, "What's new", "See what's new in Immich"),
}

/**
 * Settings, laid out like the official app: a list of cards (icon, title, subtitle) that each open their own page,
 * with the options of the official page of that name.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onOpenHeaders: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val app = context.app
    val snackbar = remember { SnackbarHostState() }
    var section by remember { mutableStateOf<Section?>(null) }
    var showDevice by remember { mutableStateOf(app.backup.settings.showDevicePhotos && LocalMedia.hasPermission(context)) }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        val ok = LocalMedia.hasPermission(context)
        app.backup.settings.showDevicePhotos = ok
        showDevice = ok
        if (ok) {
            app.dropSource("timeline")
            app.appScope.launch { app.backup.scanDevice() }
        }
    }
    val onShowDevice: (Boolean) -> Unit = { checked ->
        if (!checked) {
            app.backup.settings.showDevicePhotos = false
            showDevice = false
            app.dropSource("timeline")
        } else if (LocalMedia.hasPermission(context)) {
            app.backup.settings.showDevicePhotos = true
            showDevice = true
            app.dropSource("timeline")
            app.appScope.launch { app.backup.scanDevice() }
        } else {
            permission.launch(LocalMedia.permissions())
        }
    }

    BackHandler(enabled = section != null) { section = null }

    Scaffold(
        modifier = modifier,
        contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0),
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                // the official app bar: 56dp high, the title in the accent colour
                title = { Text(section?.title ?: "Settings", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp) },
                expandedHeight = 56.dp,
                navigationIcon = {
                    IconButton({ if (section != null) section = null else onBack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
            )
        },
    ) { padding ->
        val current = section
        Box(Modifier.padding(padding).fillMaxSize()) {
            when (current) {
                // these two lay out their own scrolling
                Section.Language -> LanguagePage(snackbar)
                Section.FreeUpSpace -> FreeUpSpacePage(onDone = { section = null })
                else -> Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                    when (current) {
                        null -> Column(Modifier.padding(top = 10.dp, bottom = 60.dp)) {
                            Section.entries.forEach { entry -> SettingsCard(entry.icon, entry.title, entry.subtitle) { section = entry } }
                        }

                        Section.Advanced -> AdvancedPage(onOpenHeaders, snackbar)
                        Section.AssetViewer -> AssetViewerPage()
                        Section.Backup -> BackupSettingsPage(snackbar)
                        Section.Networking -> NetworkingPage(snackbar)
                        Section.Notifications -> NotificationsPage()
                        Section.Preferences -> PreferencesPage()
                        Section.PhotoGrid -> PhotoGridPage(showDevice, onShowDevice)
                        Section.SyncStatus -> SyncStatusPage(snackbar)
                        Section.WhatsNew -> WhatsNewPage()
                        else -> Unit
                    }
                }
            }
        }
    }
}

/** One entry of the settings list: a rounded card with a tinted icon tile, the title in the accent color and a subtitle. */
@Composable
private fun SettingsCard(icon: ImageVector, title: String, subtitle: String, onClick: () -> Unit) {
    val dark = MaterialTheme.colorScheme.surface.luminance() < 0.5f
    Card(
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer),
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
    ) {
        ListItem(
            colors = ListItemDefaults.colors(containerColor = Color.Transparent),
            leadingContent = {
                Box(
                    Modifier
                        .background(
                            if (dark) Color.Black.copy(alpha = 0.15f) else Color.White.copy(alpha = 100 / 255f),
                            RoundedCornerShape(16.dp),
                        )
                        .padding(16.dp),
                ) {
                    Icon(icon, null, tint = MaterialTheme.colorScheme.primary)
                }
            },
            headlineContent = { Text(title, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary) },
            supportingContent = { Text(subtitle, style = MaterialTheme.typography.bodyMedium) },
        )
    }
}
