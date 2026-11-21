package app.immich.mobile.ui.memories

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.immich.mobile.app
import app.immich.mobile.data.MemoryDto
import app.immich.mobile.data.toItem
import app.immich.mobile.ui.viewer.LivePhotoPlayer
import coil3.compose.AsyncImage
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

private const val IMAGE_MILLIS = 5000

/**
 * A memory shown like a story: one photo after the other with a progress bar, tap the sides to move, hold to pause.
 * When the last photo is done the next memory starts.
 */
@Composable
fun MemoryScreen(
    startIndex: Int,
    onBack: () -> Unit,
    onOpenAll: (MemoryDto) -> Unit,
) {
    val app = LocalContext.current.app
    val memories = remember { app.memories }
    var memoryIndex by remember { mutableIntStateOf(startIndex.coerceIn(0, (memories.size - 1).coerceAtLeast(0))) }
    val memory = memories.getOrNull(memoryIndex)
    if (memory == null || memory.assets.isEmpty()) {
        LaunchedEffect(Unit) { onBack() }
        return
    }

    var assetIndex by remember(memoryIndex) { mutableIntStateOf(0) }
    var paused by remember { mutableStateOf(false) }
    val asset = memory.assets[assetIndex.coerceIn(0, memory.assets.lastIndex)]
    val item = remember(asset.id) { asset.toItem() }
    val progress = remember(memoryIndex, assetIndex) { Animatable(0f) }

    fun next() {
        when {
            assetIndex < memory.assets.lastIndex -> assetIndex++
            memoryIndex < memories.lastIndex -> memoryIndex++
            else -> onBack()
        }
    }

    fun previous() {
        when {
            assetIndex > 0 -> assetIndex--
            memoryIndex > 0 -> memoryIndex--
            else -> Unit
        }
    }

    // photos run on a timer, videos until they end
    LaunchedEffect(memoryIndex, assetIndex, paused) {
        if (item.isVideo || paused) return@LaunchedEffect
        val remaining = ((1f - progress.value) * IMAGE_MILLIS).toInt()
        progress.animateTo(1f, tween(remaining, easing = LinearEasing))
        next()
    }

    val year = LocalDate.now().year
    val yearsAgo = memory.data?.year?.let { year - it }
    val title = when {
        yearsAgo == null -> "Memory"
        yearsAgo == 0 -> "This year"
        yearsAgo == 1 -> "1 year ago"
        else -> "$yearsAgo years ago"
    }
    val dateText = remember(asset.id) {
        asset.fileCreatedAt?.let {
            runCatching {
                OffsetDateTime.parse(it).toLocalDate().format(DateTimeFormatter.ofLocalizedDate(FormatStyle.LONG))
            }.getOrNull()
        }
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black)
            .pointerInput(memoryIndex, assetIndex) {
                detectTapGestures(
                    onPress = {
                        paused = true
                        tryAwaitRelease()
                        paused = false
                    },
                    onTap = { offset -> if (offset.x < size.width / 3f) previous() else next() },
                )
            },
    ) {
        val api = app.api
        if (item.isVideo) {
            LivePhotoPlayer(api.videoUrl(asset.id), onEnded = { next() })
        } else {
            AsyncImage(
                model = api.thumbnailUrl(asset.id, asset.thumbhash),
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize(),
            )
            AsyncImage(
                model = api.previewUrl(asset.id, asset.thumbhash),
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize(),
            )
        }

        Box(
            Modifier
                .align(Alignment.TopCenter)
                .fillMaxWidth()
                .height(160.dp)
                .background(Brush.verticalGradient(listOf(Color(0xAA000000), Color.Transparent))),
        )
        Column(
            Modifier
                .align(Alignment.TopCenter)
                .statusBarsPadding()
                .padding(horizontal = 12.dp, vertical = 8.dp),
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                memory.assets.indices.forEach { i ->
                    LinearProgressIndicator(
                        progress = {
                            when {
                                i < assetIndex -> 1f
                                i == assetIndex -> if (item.isVideo) 0.5f else progress.value
                                else -> 0f
                            }
                        },
                        modifier = Modifier
                            .weight(1f)
                            .height(3.dp),
                        color = Color.White,
                        trackColor = Color(0x55FFFFFF),
                    )
                }
            }
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(
                    Modifier
                        .weight(1f)
                        .padding(top = 8.dp),
                ) {
                    Text(title, color = Color.White, style = MaterialTheme.typography.titleMedium)
                    if (dateText != null) {
                        Text(dateText, color = Color(0xCCFFFFFF), style = MaterialTheme.typography.bodySmall)
                    }
                }
                val tint = IconButtonDefaults.iconButtonColors(contentColor = Color.White)
                IconButton({ onOpenAll(memory) }, colors = tint) { Icon(Icons.Filled.GridView, "Show all") }
                IconButton(onBack, colors = tint) { Icon(Icons.Filled.Close, "Close") }
            }
        }
    }
}
