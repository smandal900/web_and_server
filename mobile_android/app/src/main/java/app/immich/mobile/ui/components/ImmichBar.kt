package app.immich.mobile.ui.components

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.outlined.Assignment
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.CleaningServices
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.DialogProperties
import app.immich.mobile.data.uploadProfileImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.luminance
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import app.immich.mobile.BuildConfig
import app.immich.mobile.R
import app.immich.mobile.app
import app.immich.mobile.data.ServerStorage
import app.immich.mobile.ui.library.Routes
import app.immich.mobile.ui.theme.GoogleSansCode
import kotlinx.coroutines.launch

/** The Immich pinwheel with the "immich" wordmark next to it, in the colors the official app uses for each theme. */
@Composable
fun ImmichLogo(modifier: Modifier = Modifier, height: androidx.compose.ui.unit.Dp = 38.dp) {
    val dark = MaterialTheme.colorScheme.surface.luminance() < 0.5f
    Image(
        painter = painterResource(if (dark) R.drawable.immich_logo_inline_dark else R.drawable.immich_logo_inline_light),
        contentDescription = "Immich",
        contentScale = ContentScale.Fit,
        modifier = modifier.height(height),
    )
}

/**
 * Top bar of the four main tabs: logo on the left, the tab's own actions, then the profile picture
 * which opens the account card (like the official app).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ImmichTopBar(
    onNavigate: (String) -> Unit,
    modifier: Modifier = Modifier,
    actions: @Composable RowScope.() -> Unit = {},
) {
    val session = LocalContext.current.app.session
    var showProfile by remember { mutableStateOf(false) }
    val app = LocalContext.current.app
    // the badge follows the connection monitor: it shows when the server is lost and goes away once it answers again
    val serverCheckFailed = app.connection.serverUnreachable
    TopAppBar(
        modifier = modifier,
        title = { ImmichLogo() },
        actions = {
            actions()
            Box(
                Modifier
                    .padding(end = 12.dp, start = 4.dp)
                    .size(44.dp)
                    .clip(androidx.compose.foundation.shape.CircleShape)
                    .clickable { showProfile = true },
                contentAlignment = Alignment.Center,
            ) {
                UserAvatar(session.userId, session.userName, size = 40.dp)
                if (serverCheckFailed) Surface(
                    shape = CircleShape,
                    color = MaterialTheme.colorScheme.errorContainer,
                    modifier = Modifier.align(Alignment.BottomEnd).size(16.dp),
                ) {
                    Icon(Icons.Filled.Info, "Unable to check server version", Modifier.padding(2.dp), tint = MaterialTheme.colorScheme.error)
                }
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
    )
    if (showProfile) {
        ProfileDialog(onDismiss = { showProfile = false }, onNavigate = {
            showProfile = false
            onNavigate(it)
        })
    }
}

/** The open-source components the app is built with (the app itself follows the Immich project's AGPL-3.0 license). */
private val licenseEntries = listOf(
    "Immich (design, strings, artwork)" to "AGPL-3.0",
    "Jetpack Compose, AndroidX, Navigation, WorkManager, Media3" to "Apache-2.0",
    "Kotlin, kotlinx.coroutines, kotlinx.serialization" to "Apache-2.0",
    "OkHttp" to "Apache-2.0",
    "Coil" to "Apache-2.0",
    "MapLibre Native" to "BSD-2-Clause",
    "MaterialKolor" to "MIT",
)

@Composable
private fun LicensesDialog(onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Licenses") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                licenseEntries.forEach { (name, license) ->
                    Column {
                        Text(name, style = MaterialTheme.typography.bodyMedium)
                        Text(license, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        },
        confirmButton = { TextButton(onDismiss) { Text("Close") } },
    )
}

@Serializable
private data class VersionCheck(val releaseVersion: String? = null)

private fun formatBytes(bytes: Long): String {
    if (bytes < 1024) return "$bytes B"
    val units = arrayOf("KiB", "MiB", "GiB", "TiB", "PiB")
    var value = bytes.toDouble()
    var unit = -1
    while (value >= 1024 && unit < units.lastIndex) {
        value /= 1024
        unit++
    }
    return "%.1f %s".format(value, units[unit])
}

/**
 * The account popup, laid out like the official app (app_bar_dialog.dart): a close button and the wordmark, one card
 * with the profile, server storage and versions, then the action rows and the footer links.
 */
@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
private fun ProfileDialog(onDismiss: () -> Unit, onNavigate: (String) -> Unit) {
    val context = LocalContext.current
    val app = context.app
    val scope = rememberCoroutineScope()
    var storage by remember { mutableStateOf<ServerStorage?>(null) }
    var quota by remember { mutableStateOf<Pair<Long, Long>?>(null) }
    var serverVersion by remember { mutableStateOf<String?>(null) }
    var latestVersion by remember { mutableStateOf<String?>(null) }
    var confirmSignOut by remember { mutableStateOf(false) }
    var showLicenses by remember { mutableStateOf(false) }
    var loaded by remember { mutableStateOf(false) }
    var avatarVersion by remember { mutableStateOf(0) }
    var message by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        storage = runCatching { app.api.storage() }.getOrNull()
        runCatching { app.api.me() }.getOrNull()?.let { me ->
            val size = me.quotaSizeInBytes
            if (size != null && size > 0) quota = (me.quotaUsageInBytes ?: 0L) to size
        }
        serverVersion = runCatching { app.api.about().version }.getOrNull()
        latestVersion = runCatching { app.api.get<VersionCheck>("/server/version-check").releaseVersion }.getOrNull()
        loaded = true
    }
    val pickImage = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            scope.launch {
                message = try {
                    val bytes = withContext(Dispatchers.IO) { context.contentResolver.openInputStream(uri)?.use { it.readBytes() } }
                    val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
                    if (bytes != null) app.api.uploadProfileImage(bytes, mime)
                    avatarVersion++
                    "Profile picture updated"
                } catch (e: Exception) {
                    e.message ?: "Unable to upload the picture"
                }
            }
        }
    }

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(Modifier.fillMaxSize().padding(start = 20.dp, end = 20.dp, top = 40.dp, bottom = 100.dp), contentAlignment = Alignment.TopCenter) {
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = MaterialTheme.colorScheme.surfaceContainerHigh,
                modifier = Modifier.widthIn(max = 560.dp).fillMaxWidth(),
            ) {
                Column(Modifier.verticalScroll(rememberScrollState())) {
                    // close button on the left, the wordmark in the middle
                    Box(Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 8.dp), contentAlignment = Alignment.Center) {
                        IconButton(onDismiss, Modifier.align(Alignment.CenterStart)) {
                            Icon(Icons.Filled.Close, "Close", Modifier.size(20.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        ImmichLogo(height = 28.dp)
                    }

                    Column(
                        Modifier
                            .padding(start = 12.dp, end = 12.dp, bottom = 8.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(MaterialTheme.colorScheme.surface),
                    ) {
                        // profile: the camera badge changes the picture
                        Row(
                            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(
                                Modifier.combinedClickable(
                                    onClick = { pickImage.launch("image/*") },
                                    // long press on the avatar switches read-only mode on and off
                                    onLongClick = {
                                        app.prefs.readOnlyMode = !app.prefs.readOnlyMode
                                        message = if (app.prefs.readOnlyMode) "Read-only mode enabled" else "Read-only mode disabled"
                                    },
                                ),
                            ) {
                                UserAvatar(app.session.userId, app.session.userName, size = 44.dp, version = avatarVersion)
                                if (!app.prefs.readOnlyMode) Surface(
                                    shape = CircleShape,
                                    color = MaterialTheme.colorScheme.surfaceContainerHighest,
                                    shadowElevation = 3.dp,
                                    modifier = Modifier.align(Alignment.BottomEnd).offset(x = 8.dp, y = 5.dp),
                                ) {
                                    Icon(
                                        Icons.Outlined.CameraAlt,
                                        "Change picture",
                                        Modifier.padding(5.dp).size(14.dp),
                                        tint = MaterialTheme.colorScheme.primary,
                                    )
                                }
                            }
                            Column(Modifier.padding(start = 24.dp)) {
                                Text(
                                    app.session.userName,
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.W500,
                                    color = MaterialTheme.colorScheme.primary,
                                )
                                Text(
                                    app.session.userEmail,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                        HorizontalDivider(thickness = 4.dp, color = MaterialTheme.colorScheme.surfaceContainer)

                        // storage: the user's quota when there is one, the disk of the server otherwise
                        val used = quota?.first?.let { formatBytes(it) } ?: storage?.diskUse
                        val total = quota?.second?.let { formatBytes(it) } ?: storage?.diskSize
                        val fraction = quota?.let { it.first.toFloat() / it.second } ?: storage?.let { (it.diskUsagePercentage / 100.0).toFloat() }
                        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text("Server Storage", style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(top = 8.dp))
                            LinearProgressIndicator(
                                progress = { (fraction ?: 0f).coerceIn(0f, 1f) },
                                modifier = Modifier.fillMaxWidth().height(10.dp).clip(RoundedCornerShape(10.dp)),
                            )
                            Text(
                                // like the official app, an unreachable server reads "0 of 0 used"
                                if (used != null && total != null) "$used of $total used" else if (loaded) "0 of 0 used" else "…",
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(bottom = 8.dp),
                            )
                        }
                        HorizontalDivider(thickness = 4.dp, color = MaterialTheme.colorScheme.surfaceContainer)

                        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
                            InfoLine("App Version", "${BuildConfig.VERSION_NAME} build.${BuildConfig.VERSION_CODE}")
                            HorizontalDivider()
                            InfoLine("Server Version", serverVersion ?: "--")
                            HorizontalDivider()
                            InfoLine("Server URL", app.session.serverUrl.removeSuffix("/api"))
                            if (latestVersion != null) {
                                HorizontalDivider()
                                InfoLine("Latest Version", latestVersion!!)
                            }
                        }
                    }

                    message?.let {
                        Text(
                            it,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.primary,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                        )
                    }
                    if (app.prefs.readOnlyMode) {
                        Box(
                            Modifier
                                .padding(horizontal = 10.dp)
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(MaterialTheme.colorScheme.primary.copy(alpha = 80 / 255f))
                                .padding(vertical = 12.dp),
                            contentAlignment = Alignment.Center,
                        ) { Text("Read-only mode enabled", style = MaterialTheme.typography.labelLarge, textAlign = TextAlign.Center) }
                    }
                    ActionRow(Icons.Outlined.Assignment, "Logs") { onNavigate(Routes.LOGS) }
                    ActionRow(Icons.Outlined.CleaningServices, "Free Up Space") { onNavigate(Routes.CLEANUP) }
                    ActionRow(Icons.Outlined.Settings, "Settings") { onNavigate(Routes.SETTINGS) }
                    ActionRow(Icons.AutoMirrored.Outlined.Logout, "Sign Out") { confirmSignOut = true }

                    Row(
                        Modifier.fillMaxWidth().padding(top = 10.dp, bottom = 20.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        LinkText("Documentation", "https://docs.immich.app")
                        Text("•", style = MaterialTheme.typography.bodySmall, modifier = Modifier.width(20.dp), textAlign = TextAlign.Center)
                        LinkText("GitHub", "https://github.com/immich-app/immich")
                        Text("•", style = MaterialTheme.typography.bodySmall, modifier = Modifier.width(20.dp), textAlign = TextAlign.Center)
                        Text("Licenses", style = MaterialTheme.typography.bodySmall, modifier = Modifier.clickable { showLicenses = true })
                    }
                }
            }
        }
    }

    if (showLicenses) LicensesDialog { showLicenses = false }

    if (confirmSignOut) {
        AlertDialog(
            onDismissRequest = { confirmSignOut = false },
            title = { Text("Sign out?") },
            text = { Text("Backups stop until you sign in again.") },
            confirmButton = {
                TextButton({
                    confirmSignOut = false
                    scope.launch {
                        runCatching { app.api.logout() }
                        app.signOut()
                    }
                }) { Text("Sign out") }
            },
            dismissButton = { TextButton({ confirmSignOut = false }) { Text("Cancel") } },
        )
    }
}

/** A label on the left and its value on the right, in the small type of the official server info box. */
@Composable
private fun InfoLine(label: String, value: String) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.W500, color = MaterialTheme.colorScheme.onSurface)
        Text(
            value,
            fontSize = 11.sp,
            fontWeight = FontWeight.W500,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.End,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(start = 8.dp).weight(1f, fill = false),
        )
    }
}

@Composable
private fun ActionRow(icon: ImageVector, label: String, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 30.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        Icon(icon, null, Modifier.size(20.dp), tint = MaterialTheme.colorScheme.onSurface)
        Text(label, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurface)
    }
}

@Composable
private fun LinkText(label: String, url: String) {
    val context = LocalContext.current
    Text(
        label,
        style = MaterialTheme.typography.bodySmall,
        modifier = Modifier.clickable {
            runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        },
    )
}
