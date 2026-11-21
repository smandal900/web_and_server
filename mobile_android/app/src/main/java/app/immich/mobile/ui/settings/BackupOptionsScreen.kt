package app.immich.mobile.ui.settings

import android.widget.Toast
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.immich.mobile.app

/**
 * What the gear icon of the backup page opens, like the official "Backup options" page: network requirements,
 * background options and album synchronization. When the cellular settings changed, leaving the page restarts a
 * running backup so it follows the new rules.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BackupOptionsScreen(onBack: () -> Unit, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val backup = context.app.backup
    val snackbar = remember { SnackbarHostState() }
    // what may go over mobile data when the page opens; compared with the answer when it closes
    val startVideos = remember { backup.settings.cellularVideosAllowed }
    val startPhotos = remember { backup.settings.cellularPhotosAllowed }

    DisposableEffect(Unit) {
        onDispose {
            val settings = backup.settings
            if (settings.cellularVideosAllowed == startVideos && settings.cellularPhotosAllowed == startPhotos) return@onDispose
            if (!isBackupEnabled(context)) return@onDispose
            Toast.makeText(context, "Network requirements updated", Toast.LENGTH_LONG).show()
            backup.cancel()
            backup.applyAutomatic()
            backup.start()
        }
    }

    Scaffold(
        modifier = modifier,
        contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0),
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("Backup Options", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp) },
                expandedHeight = 56.dp,
                navigationIcon = { IconButton(onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
            )
        },
    ) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                BackupSettingsPage(snackbar)
            }
        }
    }
}
