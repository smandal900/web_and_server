package app.immich.mobile.ui.local

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.immich.mobile.ui.components.ImmichLogo
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import app.immich.mobile.app
import app.immich.mobile.backup.LocalAsset
import app.immich.mobile.backup.LocalMedia
import app.immich.mobile.backup.toItem
import app.immich.mobile.data.ListSource
import app.immich.mobile.ui.AssetSourceScreen
import app.immich.mobile.ui.SourceKind
import app.immich.mobile.ui.components.CenterMessage
import app.immich.mobile.ui.library.Routes
import app.immich.mobile.ui.viewer.ViewerScreen
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private const val GRID = "offline/grid"
private const val SOURCE_KEY = "offline:photos"

/**
 * What the app shows when nobody is signed in: the photos and videos of the camera folder of this phone, opened in
 * the normal viewer. Works without a server; signing in is one tap away.
 */
@Composable
fun DeviceViewerNavigation() {
    val nav = rememberNavController()
    NavHost(nav, startDestination = GRID) {
        composable(GRID) {
            DeviceViewerGrid(onOpen = { position -> nav.navigate(Routes.viewer(SOURCE_KEY, position)) })
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
            ViewerScreen(
                sourceKey = android.net.Uri.decode(it.arguments?.getString("key").orEmpty()),
                startIndex = it.arguments?.getInt("index") ?: 0,
                kind = SourceKind.Library,
                albumId = null,
                onBack = { nav.popBackStack() },
            )
        }
    }
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun DeviceViewerGrid(onOpen: (position: Int) -> Unit) {
    val context = LocalContext.current
    val app = context.app
    var granted by remember { mutableStateOf(LocalMedia.hasPermission(context)) }
    var assets by remember { mutableStateOf<List<LocalAsset>?>(null) }
    var reload by remember { mutableIntStateOf(0) }

    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        granted = LocalMedia.hasPermission(context)
    }

    // pick up new photos whenever the app comes back to the front
    val owner = LocalLifecycleOwner.current
    DisposableEffect(owner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                granted = LocalMedia.hasPermission(context)
                reload++
            }
        }
        owner.lifecycle.addObserver(observer)
        onDispose { owner.lifecycle.removeObserver(observer) }
    }

    LaunchedEffect(granted, reload) {
        if (granted) assets = withContext(Dispatchers.IO) { runCatching { LocalMedia.query(context) }.getOrDefault(emptyList()) }
    }

    val camera = assets.orEmpty().filter { it.isCamera }
    // phones without a folder called Camera show everything instead of an empty screen
    val shown = camera.ifEmpty { assets.orEmpty() }

    val source = remember { (app.source(SOURCE_KEY) as? ListSource) ?: ListSource(emptyList()).also { app.putSource(SOURCE_KEY, it) } }
    LaunchedEffect(shown) { source.replace(shown.map { it.toItem(backedUp = null) }) }

    if (!granted) {
        CenterMessage(
            "Allow access to your photos",
            detail = "The photos of your camera folder are shown here, no account needed",
            action = "Allow access",
            onAction = { permission.launch(LocalMedia.permissions()) },
        )
        return
    }

    AssetSourceScreen(
        title = "Photos",
        source = source,
        kind = SourceKind.Library,
        emptyMessage = if (assets == null) "Looking at your photos…" else "No photos on this device",
        onOpen = onOpen,
        topBar = {
            TopAppBar(
                title = { ImmichLogo() },
                actions = {
                    // like the backup chip of Google Photos, tapping it leads to signing in
                    Surface(
                        onClick = { app.session.showLogin = true },
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        modifier = Modifier.padding(end = 12.dp),
                    ) {
                        Row(
                            Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Icon(Icons.Filled.CloudOff, null, Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text("Backup is off", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
            )
        },
    )
}
