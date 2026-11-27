package app.immich.mobile.ui.components

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.outlined.RadioButtonUnchecked
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.immich.mobile.app
import app.immich.mobile.data.AssetItem
import coil3.compose.AsyncImage
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun AssetThumb(
    item: AssetItem?,
    modifier: Modifier = Modifier,
    selecting: Boolean = false,
    selected: Boolean = false,
    onClick: () -> Unit = {},
    onLongClick: () -> Unit = {},
) {
    val api = LocalContext.current.app.api
    val prefs = LocalContext.current.app.prefs
    val haptic = androidx.compose.ui.platform.LocalHapticFeedback.current
    Box(
        modifier
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .then(
                if (item != null) {
                    Modifier.combinedClickable(
                        onClick = {
                            // a light tick when a photo is added to or removed from the selection
                            if (selecting && prefs.haptics) haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            onClick()
                        },
                        onLongClick = {
                            // read-only mode turns selecting photos off
                            if (!prefs.readOnlyMode) {
                                if (prefs.haptics) haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                onLongClick()
                            }
                        },
                    )
                } else {
                    Modifier
                },
            ),
    ) {
        if (item == null) return@Box
        ThumbHash.placeholder(item.thumbhash)?.let {
            Image(it, null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        }
        AsyncImage(
            // Settings > Advanced > Prefer remote images: the copy on the server for photos that are backed up
            model = (if (prefs.preferRemoteImage) item.remoteId else null)?.let { api.thumbnailUrl(it) }
                ?: item.localUri ?: api.thumbnailUrl(item.id, item.thumbhash),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .fillMaxSize()
                .padding(if (selected) 10.dp else 0.dp)
                .clip(RoundedCornerShape(if (selected) 8.dp else 0.dp)),
        )

        if (item.isVideo) {
            Row(
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                item.durationMs?.let {
                    Text(formatDuration(it), color = Color.White, fontSize = 11.sp)
                }
                Icon(Icons.Filled.PlayArrow, null, tint = Color.White, modifier = Modifier.size(16.dp))
            }
        } else if (item.livePhotoVideoId != null) {
            Icon(
                Icons.Filled.PhotoLibrary,
                null,
                tint = Color.White,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(6.dp)
                    .size(14.dp),
            )
        }

        if (item.stackCount > 1) {
            Row(
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = if (item.isVideo || item.livePhotoVideoId != null) 26.dp else 6.dp, end = 6.dp)
                    // a dark pill, so the number can be read on a bright photo
                    .background(Color(0x88000000), RoundedCornerShape(50))
                    .padding(horizontal = 6.dp, vertical = 1.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("${item.stackCount}", color = Color.White, fontSize = 12.sp)
                Icon(Icons.Filled.Layers, null, tint = Color.White, modifier = Modifier.size(14.dp))
            }
        }

        if (!prefs.storageIndicator || !LocalContext.current.app.session.isLoggedIn) {
            // the user turned the storage indicator off in Settings > Photo Grid, or nobody is signed in so nothing is backed up
        } else if (item.isLocal && item.backedUp != null) {
            Icon(
                if (item.backedUp == true) Icons.Filled.CloudDone else Icons.Filled.CloudOff,
                null,
                tint = Color.White,
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(6.dp)
                    .size(16.dp),
            )
        } else if (item.isLocal) {
            Icon(
                Icons.Filled.CloudOff,
                null,
                tint = Color.White,
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(6.dp)
                    .size(16.dp),
            )
        }

        if (item.isFavorite) {
            Icon(
                Icons.Filled.Favorite,
                null,
                tint = Color.White,
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(6.dp)
                    .size(16.dp),
            )
        }

        if (selecting) {
            Icon(
                if (selected) Icons.Filled.CheckCircle else Icons.Outlined.RadioButtonUnchecked,
                null,
                tint = if (selected) MaterialTheme.colorScheme.primary else Color.White,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(6.dp)
                    .size(22.dp)
                    .then(if (selected) Modifier.background(Color.White, CircleShape) else Modifier),
            )
        }
    }
}

@Composable
fun CenterLoading(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
}

@Composable
fun CenterMessage(
    title: String,
    modifier: Modifier = Modifier,
    detail: String? = null,
    action: String? = null,
    onAction: () -> Unit = {},
) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            Modifier.padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(title, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
            if (detail != null) {
                Text(
                    detail,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
            }
            if (action != null) Button(onClick = onAction) { Text(action) }
        }
    }
}

fun gradientScrim() = Brush.verticalGradient(listOf(Color(0x99000000), Color.Transparent))

fun formatDuration(ms: Int): String {
    val seconds = ms / 1000
    val h = seconds / 3600
    val m = seconds % 3600 / 60
    val s = seconds % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}

private val monthFormat = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.getDefault())

/** "March 2024" for the start of a time bucket such as `2024-03-01T00:00:00.000Z`. */
fun bucketLabel(timeBucket: String): String =
    runCatching { LocalDate.parse(timeBucket.take(10)).format(monthFormat) }.getOrDefault(timeBucket)

/** The switch of the official app: a soft primary track with a primary thumb when on, the plain outlined switch when off. */
@Composable
fun ImmichSwitch(checked: Boolean, onCheckedChange: ((Boolean) -> Unit)?, modifier: Modifier = Modifier, enabled: Boolean = true) {
    val primary = MaterialTheme.colorScheme.primary
    androidx.compose.material3.Switch(
        checked = checked,
        onCheckedChange = onCheckedChange,
        modifier = modifier,
        enabled = enabled,
        colors = androidx.compose.material3.SwitchDefaults.colors(
            checkedThumbColor = primary,
            checkedTrackColor = primary.copy(alpha = 0.5f).compositeOver(MaterialTheme.colorScheme.surface),
            checkedBorderColor = androidx.compose.ui.graphics.Color.Transparent,
        ),
    )
}
