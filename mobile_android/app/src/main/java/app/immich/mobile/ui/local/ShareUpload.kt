package app.immich.mobile.ui.local

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.immich.mobile.app
import app.immich.mobile.backup.LocalMedia
import app.immich.mobile.backup.fromUri
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch

/** Photos and videos that another app shared with this one: shows them and uploads them on request. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShareUploadScreen(onClose: () -> Unit) {
    val context = LocalContext.current
    val app = context.app
    val uris = remember { app.pendingShare }
    val scope = rememberCoroutineScope()
    var running by remember { mutableStateOf(false) }
    var finished by remember { mutableStateOf(false) }
    var done by remember { mutableIntStateOf(0) }
    var failed by remember { mutableIntStateOf(0) }

    fun close() {
        app.pendingShare = emptyList()
        onClose()
    }

    Scaffold(
        contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0),
        topBar = {
            TopAppBar(
                title = { Text("Upload ${uris.size} ${if (uris.size == 1) "item" else "items"}") },
                navigationIcon = { IconButton(::close, enabled = !running) { Icon(Icons.Filled.Close, "Close") } },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .padding(padding)
                .fillMaxSize(),
        ) {
            Box(Modifier.weight(1f)) {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    items(uris) { uri ->
                        AsyncImage(
                            model = uri.toString(),
                            contentDescription = null,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.aspectRatio(1f),
                        )
                    }
                }
            }
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (running) {
                    LinearProgressIndicator(progress = { done.toFloat() / uris.size.coerceAtLeast(1) }, modifier = Modifier.fillMaxWidth())
                    Text("Uploading $done of ${uris.size}", style = MaterialTheme.typography.bodyMedium)
                }
                if (finished) {
                    Text(
                        if (failed == 0) "Everything is on the server" else "$failed could not be uploaded",
                        color = if (failed == 0) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.error,
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (!finished) {
                        Button(
                            enabled = !running,
                            onClick = {
                                running = true
                                scope.launch {
                                    val assets = uris.map { LocalMedia.fromUri(context, it) }
                                    failed = app.backup.uploadShared(assets) { d, _ -> done = d }
                                    running = false
                                    finished = true
                                }
                            },
                        ) { Text("Upload") }
                    }
                    OutlinedButton(::close, enabled = !running) { Text(if (finished) "Done" else "Cancel") }
                }
            }
        }
    }
}
