package app.immich.mobile.ui.settings

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DragHandle
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Lan
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material.icons.filled.WifiFind
import androidx.compose.material.icons.outlined.Dns
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Http
import androidx.compose.material.icons.outlined.Https
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import app.immich.mobile.app
import app.immich.mobile.data.AppLog
import app.immich.mobile.data.NetworkSwitcher
import app.immich.mobile.ui.theme.GoogleSansCode
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

private enum class Reach { Unknown, Checking, Valid, Error }

private class Endpoint(val id: Int, url: String, status: Reach) {
    var url by mutableStateOf(url)
    var status by mutableStateOf(status)
}

@Composable
private fun ReachIcon(status: Reach, enabled: Boolean) {
    when (status) {
        Reach.Checking -> CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
        Reach.Valid -> Icon(
            Icons.Filled.CheckCircle,
            null,
            tint = if (enabled) Color(0xFF4CAF50) else MaterialTheme.colorScheme.onSurface.copy(alpha = 100 / 255f),
        )
        Reach.Error -> Icon(Icons.Filled.Error, null, tint = if (enabled) Color(0xFFF44336) else Color.Gray)
        Reach.Unknown -> Box(Modifier.size(18.dp))
    }
}

/** The card the local and external network settings sit in: a border, a faint icon in the corner and an explanation. */
@Composable
private fun NetworkCard(watermark: androidx.compose.ui.graphics.vector.ImageVector, info: String, content: @Composable () -> Unit) {
    Box(
        Modifier
            .padding(horizontal = 16.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerLow)
            .border(BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceContainerHighest), RoundedCornerShape(16.dp)),
    ) {
        Icon(
            watermark,
            null,
            Modifier.align(Alignment.BottomEnd).offset(36.dp, 36.dp).size(120.dp),
            tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.05f),
        )
        Column(Modifier.padding(vertical = 16.dp)) {
            Text(info, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(horizontal = 24.dp, vertical = 4.dp))
            Spacer(Modifier.height(4.dp))
            HorizontalDivider(color = MaterialTheme.colorScheme.surfaceContainerHighest)
            content()
        }
    }
}


@Composable
internal fun NetworkingPage(snackbar: SnackbarHostState) {
    val context = LocalContext.current
    val app = context.app
    val prefs = app.prefs
    val scope = rememberCoroutineScope()
    var editWifi by remember { mutableStateOf(false) }
    var editLocal by remember { mutableStateOf(false) }
    var askFine by remember { mutableStateOf(false) }
    var askBackground by remember { mutableStateOf(false) }
    var current by remember { mutableStateOf(app.api.baseUrl) }
    val enabled = prefs.autoSwitchEndpoint

    fun reselect() {
        scope.launch {
            NetworkSwitcher.refresh(app)
            current = app.api.baseUrl
        }
    }

    fun has(permission: String) = ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
    fun hasBackground() = Build.VERSION.SDK_INT < 29 || has(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
    fun openAppSettings() {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
        runCatching { context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    }

    val fineLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        askFine = false
        if (!hasBackground()) askBackground = true else reselect()
    }
    val backgroundLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        askBackground = false
        if (!granted && !hasBackground()) openAppSettings()
        reselect()
    }

    // official behaviour: turning the switch on asks for the location permissions that reading the Wi-Fi name needs
    fun checkWifiReadPermission() {
        if (!has(Manifest.permission.ACCESS_FINE_LOCATION)) askFine = true
        else if (!hasBackground()) askBackground = true
    }

    val entries = remember {
        mutableStateListOf<Endpoint>().apply {
            var next = 0
            prefs.externalEndpoints.forEach { add(Endpoint(next++, it, Reach.Valid)) }
            if (isEmpty()) add(Endpoint(next++, "", Reach.Unknown))
        }
    }
    var nextId by remember { mutableIntStateOf(entries.size + 1000) }

    fun saveEndpoints() {
        prefs.externalEndpoints = entries.filter { it.status == Reach.Valid && it.url.isNotBlank() }.map { it.url.trim() }
        reselect()
    }

    val shown = current.removeSuffix("/api")
    Column(Modifier.padding(top = 8.dp, bottom = 96.dp)) {
        GroupTitle("Current server address", if (shown.startsWith("https")) Icons.Outlined.Https else Icons.Outlined.Http)
        Box(
            Modifier
                .padding(horizontal = 8.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .border(BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceContainerHighest), RoundedCornerShape(16.dp)),
        ) {
            ListItem(
                colors = ListItemDefaults.colors(containerColor = Color.Transparent),
                leadingContent = { Icon(Icons.Filled.CheckCircle, null, tint = Color(0xFF4CAF50)) },
                headlineContent = { Text(shown, fontSize = 14.sp, fontFamily = GoogleSansCode, color = MaterialTheme.colorScheme.primary) },
            )
        }
        HorizontalDivider(Modifier.padding(top = 10.dp), color = MaterialTheme.colorScheme.surfaceContainerHighest)
        SwitchTile(
            "Automatic URL switching",
            "Connect locally over designated Wi-Fi when available and use alternative connections elsewhere",
            enabled,
        ) { on ->
            prefs.autoSwitchEndpoint = on
            if (on) checkWifiReadPermission()
            reselect()
        }

        Spacer(Modifier.height(8.dp))
        GroupTitle("Local network", Icons.Outlined.Home)
        NetworkCard(Icons.Outlined.Home, "The app will connect to the server through this URL when using the specified Wi-Fi network") {
            val dim = Modifier.alpha(if (enabled) 1f else 0.5f)
            ListItem(
                colors = ListItemDefaults.colors(containerColor = Color.Transparent),
                leadingContent = { Icon(Icons.Filled.Wifi, null) },
                headlineContent = { Text("Wi-Fi Name") },
                supportingContent = {
                    if (prefs.localWifiName.isBlank()) Text("Enter Wi-Fi name") else Text(
                        prefs.localWifiName,
                        fontWeight = FontWeight.Bold,
                        fontFamily = GoogleSansCode,
                        color = if (enabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface.copy(alpha = 100 / 255f),
                    )
                },
                trailingContent = { IconButton({ editWifi = true }, enabled = enabled) { Icon(Icons.Filled.Edit, "Edit") } },
                modifier = dim,
            )
            ListItem(
                colors = ListItemDefaults.colors(containerColor = Color.Transparent),
                leadingContent = { Icon(Icons.Filled.Lan, null) },
                headlineContent = { Text("Server Endpoint") },
                supportingContent = {
                    if (prefs.localEndpoint.isBlank()) Text("http://local-ip:2283") else Text(
                        prefs.localEndpoint,
                        fontFamily = GoogleSansCode,
                        color = if (enabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface.copy(alpha = 100 / 255f),
                    )
                },
                trailingContent = { IconButton({ editLocal = true }, enabled = enabled) { Icon(Icons.Filled.Edit, "Edit") } },
                modifier = dim,
            )
            Spacer(Modifier.height(16.dp))
            OutlinedButton(
                onClick = {
                    if (!has(Manifest.permission.ACCESS_FINE_LOCATION)) {
                        askFine = true
                        return@OutlinedButton
                    }
                    val name = NetworkSwitcher.currentWifiName(context)
                    if (name == null) {
                        scope.launch {
                            snackbar.showSnackbar("Could not get Wi-Fi name. Make sure you have granted the necessary permissions and are connected to a Wi-Fi network")
                        }
                    } else {
                        prefs.localWifiName = name
                        prefs.localEndpoint = app.api.baseUrl.removeSuffix("/api")
                        AppLog.i("Network", "Local network set to $name")
                        reselect()
                    }
                },
                enabled = enabled,
                modifier = Modifier.padding(horizontal = 24.dp).fillMaxWidth().height(48.dp),
            ) {
                Icon(Icons.Filled.WifiFind, null)
                Text("Use current connection", Modifier.padding(start = 8.dp))
            }
        }

        Spacer(Modifier.height(16.dp))
        GroupTitle("External network", Icons.Outlined.Dns)
        NetworkCard(
            Icons.Outlined.Dns,
            "When not on the preferred Wi-Fi network, the app will connect to the server through the first of the below URLs it can reach, starting from top to bottom",
        ) {
            entries.forEachIndexed { index, entry ->
                EndpointRow(
                    entry = entry,
                    index = index,
                    count = entries.size,
                    enabled = enabled,
                    onValidate = { url ->
                        entry.status = Reach.Checking
                        val ok = app.api.resolveServer(url) != null
                        entry.status = if (ok) Reach.Valid else Reach.Error
                        saveEndpoints()
                    },
                    onRemove = {
                        entries.remove(entry)
                        saveEndpoints()
                    },
                    onMove = { from, to ->
                        entries.add(to, entries.removeAt(from))
                        saveEndpoints()
                    },
                )
            }
            Spacer(Modifier.height(24.dp))
            OutlinedButton(
                onClick = { entries.add(Endpoint(nextId++, "", Reach.Unknown)) },
                enabled = enabled,
                modifier = Modifier.padding(horizontal = 24.dp).fillMaxWidth().height(48.dp),
            ) {
                Icon(Icons.Filled.Add, null)
                Text("Add endpoint", Modifier.padding(start = 8.dp))
            }
        }
    }

    if (editWifi) {
        TextDialog("Wi-Fi Name", prefs.localWifiName, "Your Wi-Fi name", { editWifi = false }) {
            prefs.localWifiName = it
            editWifi = false
            reselect()
        }
    }
    if (editLocal) {
        TextDialog("Server Endpoint", prefs.localEndpoint, "http://local-ip:2283", { editLocal = false }) {
            prefs.localEndpoint = it
            editLocal = false
            reselect()
        }
    }
    if (askFine) {
        AlertDialog(
            onDismissRequest = { askFine = false },
            title = { Text("Location permission") },
            text = { Text("In order to use the auto-switching feature, Immich needs precise location permission so it can read the current Wi-Fi network's name") },
            confirmButton = { TextButton({ fineLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION) }) { Text("Grant permission") } },
        )
    }
    if (askBackground) {
        AlertDialog(
            onDismissRequest = { askBackground = false },
            title = { Text("Background location permission") },
            text = {
                Text("In order to switch networks when running in the background, Immich must *always* have precise location access so the app can read the Wi-Fi network's name")
            },
            confirmButton = {
                TextButton({
                    if (Build.VERSION.SDK_INT >= 29) backgroundLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                    else askBackground = false
                }) { Text("Grant permission") }
            },
        )
    }
}

/** One external address: a handle to reorder, the address, its status and a button to remove it. */
@Composable
private fun EndpointRow(
    entry: Endpoint,
    index: Int,
    count: Int,
    enabled: Boolean,
    onValidate: suspend (String) -> Unit,
    onRemove: () -> Unit,
    onMove: (from: Int, to: Int) -> Unit,
) {
    var height by remember { mutableIntStateOf(0) }
    var drag by remember { mutableStateOf(0f) }
    val currentIndex by rememberUpdatedState(index)
    val currentCount by rememberUpdatedState(count)

    // checks the address half a second after the last key press, like the official input
    LaunchedEffect(entry.url) {
        if (entry.url.isBlank()) {
            entry.status = Reach.Unknown
            return@LaunchedEffect
        }
        if (entry.status == Reach.Valid && entry.url.isNotBlank() && drag == 0f && entry.id < 1000) return@LaunchedEffect
        delay(500)
        onValidate(entry.url.trim())
    }

    Row(
        Modifier
            .fillMaxWidth()
            .onSizeChanged { height = it.height }
            .offset { IntOffset(0, drag.roundToInt()) }
            .padding(start = 8.dp, end = 8.dp, top = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            Icons.Filled.DragHandle,
            "Reorder",
            Modifier
                .padding(horizontal = 8.dp)
                .pointerInput(entry.id) {
                    detectDragGestures(
                        onDragEnd = { drag = 0f },
                        onDragCancel = { drag = 0f },
                    ) { change, amount ->
                        change.consume()
                        drag += amount.y
                        // moving over half of the neighbour swaps the two
                        if (drag > height / 2f && currentIndex < currentCount - 1) {
                            onMove(currentIndex, currentIndex + 1)
                            drag -= height
                        } else if (drag < -height / 2f && currentIndex > 0) {
                            onMove(currentIndex, currentIndex - 1)
                            drag += height
                        }
                    }
                },
        )
        OutlinedTextField(
            value = entry.url,
            onValueChange = { entry.url = it },
            enabled = enabled,
            singleLine = true,
            label = { Text("Server Endpoint") },
            placeholder = { Text("http://example.com:2283") },
            trailingIcon = { ReachIcon(entry.status, enabled) },
            modifier = Modifier.weight(1f),
        )
        IconButton(onRemove, enabled = enabled) { Icon(Icons.Filled.Delete, "Remove") }
    }
}
