package app.immich.mobile.ui.settings

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material.icons.filled.PlaylistRemove
import androidx.compose.material.icons.filled.Smartphone
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.Tag
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.CheckCircleOutline
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.SettingsBackupRestore
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.immich.mobile.app
import app.immich.mobile.backup.LocalMedia
import app.immich.mobile.data.AppLog
import app.immich.mobile.ui.theme.GoogleSansCode
import coil3.SingletonImageLoader
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

private enum class JobStatus { Idle, Syncing, Success, Error }

@Composable
private fun StatusIcon(status: JobStatus) {
    when (status) {
        JobStatus.Idle -> Unit
        JobStatus.Syncing -> CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 2.dp)
        JobStatus.Success -> Icon(Icons.Filled.CheckCircleOutline, null, tint = Color(0xFF4CAF50))
        JobStatus.Error -> Icon(Icons.Filled.ErrorOutline, null, tint = MaterialTheme.colorScheme.error)
    }
}

/** A count in a rounded tile, the official `EntityCountTile`: the label on top, the number in a monospace font below. */
@Composable
private fun CountTile(label: String, count: Int?, icon: ImageVector, modifier: Modifier = Modifier) {
    val width = LocalConfiguration.current.screenWidthDp
    val maxDigits = (((width - 32 - 8) / 2f - 32) / 11f).toInt().coerceIn(1, 8)
    val text = count?.toString() ?: "–"
    val padding = "0".repeat((maxDigits - text.length).coerceAtLeast(0))
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainerLow,
        border = BorderStroke(0.5.dp, MaterialTheme.colorScheme.outline.copy(alpha = 25 / 255f)),
        modifier = modifier,
    ) {
        Column(Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
                Icon(icon, null, Modifier.size(14.dp), tint = MaterialTheme.colorScheme.primary)
                Text(
                    label,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.W500,
                    modifier = Modifier.padding(start = 4.dp),
                )
            }
            Spacer(Modifier.weight(1f, fill = false).height(8.dp))
            Text(
                buildAnnotatedString {
                    withStyle(SpanStyle(color = secondaryColor().copy(alpha = 75 / 255f))) { append(padding) }
                    withStyle(SpanStyle(color = MaterialTheme.colorScheme.onSurface)) { append(text) }
                },
                fontSize = 18.sp,
                fontFamily = GoogleSansCode,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}

@Composable
private fun CountRow(left: @Composable (Modifier) -> Unit, right: @Composable (Modifier) -> Unit) {
    Row(
        Modifier
            .padding(start = 16.dp, end = 16.dp, bottom = 16.dp)
            .height(IntrinsicSize.Min),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        left(Modifier.weight(1f).fillMaxWidth())
        right(Modifier.weight(1f).fillMaxWidth())
    }
}

/**
 * Sync status like the official page: how many assets and albums are on the phone and on the server, the jobs that
 * read the gallery and the server again, and the actions that clean up.
 */
@Composable
internal fun SyncStatusPage(snackbar: SnackbarHostState) {
    val context = LocalContext.current
    val app = context.app
    val scope = rememberCoroutineScope()
    val local by app.backup.local.collectAsState()
    var remoteAssets by remember { mutableStateOf<Int?>(null) }
    var remoteAlbums by remember { mutableStateOf<Int?>(null) }
    var memories by remember { mutableStateOf<Int?>(null) }
    var failed by remember { mutableStateOf(false) }
    var reload by remember { mutableIntStateOf(0) }
    var syncLocal by remember { mutableStateOf(JobStatus.Idle) }
    var syncRemote by remember { mutableStateOf(JobStatus.Idle) }
    var hash by remember { mutableStateOf(JobStatus.Idle) }
    var confirmReset by remember { mutableStateOf(false) }
    var resetDone by remember { mutableStateOf(false) }

    LaunchedEffect(reload) {
        try {
            remoteAssets = app.api.assetStats().total
            remoteAlbums = app.api.albums().size
            memories = app.api.memories().size
            failed = false
        } catch (e: Exception) {
            failed = true
        }
    }

    val trashCount = remember(local.assets.size, reload, syncRemote) { LocalMedia.trashedCount(context) }
    val hashed = local.assets.count { it.cacheKey in local.checked || it.cacheKey in local.backedUp }
    val localAlbums = local.assets.map { it.bucketId }.distinct().size

    Column(Modifier.padding(top = 16.dp, bottom = 96.dp)) {
        if (failed) {
            Text(
                "Could not read the data. Reset the local database to start again.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(16.dp),
            )
        }
        GroupTitle("Assets")
        CountRow(
            { CountTile("Local", local.assets.size, Icons.Filled.Smartphone, it) },
            { CountTile("Remote", remoteAssets, Icons.Filled.Cloud, it) },
        )
        GroupTitle("Albums")
        CountRow(
            { CountTile("Local", localAlbums, Icons.Filled.Smartphone, it) },
            { CountTile("Remote", remoteAlbums, Icons.Filled.Cloud, it) },
        )
        GroupTitle("Other")
        CountRow(
            { CountTile("Memories", memories, Icons.Filled.CalendarToday, it) },
            { CountTile("Hashed assets", hashed, Icons.Filled.Tag, it) },
        )
        // To be removed once the experimental feature is stable (same as the official page)
        if (app.prefs.syncRemoteDeletions && android.os.Build.VERSION.SDK_INT >= 31) {
            GroupTitle("Trash")
            val hashedInTrash = app.prefs.syncTrashedText.lines().count { it.isNotBlank() }
            CountRow(
                { CountTile("Local", trashCount, Icons.Filled.Delete, it) },
                { CountTile("Hashed assets", hashedInTrash, Icons.Filled.Tag, it) },
            )
        }
        HorizontalDivider(Modifier.height(10.dp))
        Spacer(Modifier.height(16.dp))

        GroupTitle("Jobs")
        SettingTile(
            "Sync Local",
            "Tap to run job",
            leading = { Icon(Icons.Filled.Sync, null) },
            trailing = { StatusIcon(syncLocal) },
            onClick = {
                if (syncLocal != JobStatus.Syncing) scope.launch {
                    syncLocal = JobStatus.Syncing
                    syncLocal = try {
                        app.backup.refreshDeviceList()
                        JobStatus.Success
                    } catch (e: Exception) {
                        JobStatus.Error
                    }
                }
            },
            startPadding = 16.dp,
        )
        SettingTile(
            "Sync Remote",
            "Tap to run job",
            leading = { Icon(Icons.Filled.CloudSync, null) },
            trailing = { StatusIcon(syncRemote) },
            onClick = {
                if (syncRemote != JobStatus.Syncing) scope.launch {
                    syncRemote = JobStatus.Syncing
                    syncRemote = try {
                        app.dropSource("timeline")
                        val moved = app.backup.syncRemoteDeletions()
                        if (moved > 0) AppLog.i("SyncDeletions", "Changed $moved photos of the phone")
                        remoteAssets = app.api.assetStats().total
                        remoteAlbums = app.api.albums().size
                        memories = app.api.memories().size
                        JobStatus.Success
                    } catch (e: Exception) {
                        JobStatus.Error
                    }
                }
            },
            startPadding = 16.dp,
        )
        SettingTile(
            "Hash asset",
            "Tap to run job",
            leading = { Icon(Icons.Filled.Tag, null) },
            trailing = { StatusIcon(if (local.scanning) JobStatus.Syncing else hash) },
            onClick = {
                if (!local.scanning) scope.launch {
                    hash = JobStatus.Syncing
                    hash = try {
                        app.backup.scanDevice()
                        JobStatus.Success
                    } catch (e: Exception) {
                        JobStatus.Error
                    }
                }
            },
            startPadding = 16.dp,
        )
        HorizontalDivider()
        Spacer(Modifier.height(16.dp))

        GroupTitle("Actions")
        SettingTile(
            "Clear File Cache",
            leading = { Icon(Icons.Filled.PlaylistRemove, null) },
            onClick = {
                scope.launch {
                    try {
                        withContext(Dispatchers.IO) { File(context.cacheDir, "shared").deleteRecursively() }
                        snackbar.showSnackbar("File cache cleared")
                    } catch (e: Exception) {
                        snackbar.showSnackbar("Failed to clear file cache")
                    }
                }
            },
            startPadding = 16.dp,
        )
        ListItemRed("Reset Local Database") { confirmReset = true }
    }

    if (confirmReset) {
        AlertDialog(
            onDismissRequest = { confirmReset = false },
            title = { Text("Reset Local Database") },
            text = { Text("Are you sure you want to clear the app data? This will remove all settings and sign you out.") },
            dismissButton = { TextButton({ confirmReset = false }) { Text("Cancel") } },
            confirmButton = {
                TextButton({
                    confirmReset = false
                    scope.launch {
                        app.backup.resetLocalData()
                        SingletonImageLoader.get(context).let { it.memoryCache?.clear(); it.diskCache?.clear() }
                        listOf("settings", "backup").forEach { context.getSharedPreferences(it, 0).edit().clear().commit() }
                        resetDone = true
                    }
                }) { Text("Confirm", color = MaterialTheme.colorScheme.error) }
            },
        )
    }
    if (resetDone) {
        AlertDialog(
            onDismissRequest = {},
            title = { Text("Successfully reset the database") },
            text = { Text("App data has been cleared. Please restart Immich and log in again.") },
            confirmButton = {
                TextButton({
                    resetDone = false
                    app.signOut()
                }) { Text("Ok") }
            },
        )
    }
}

@Composable
private fun ListItemRed(title: String, onClick: () -> Unit) {
    SettingTile(
        title,
        leading = { Icon(Icons.Filled.SettingsBackupRestore, null, tint = MaterialTheme.colorScheme.error) },
        onClick = onClick,
        startPadding = 16.dp,
        titleColor = MaterialTheme.colorScheme.error,
    )
}
