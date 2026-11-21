package app.immich.mobile.ui.viewer

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.StarBorder
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.immich.mobile.app
import app.immich.mobile.data.AssetDto
import app.immich.mobile.data.EditAction
import app.immich.mobile.data.applyEdits
import app.immich.mobile.data.assetEdits
import app.immich.mobile.data.removeEdits
import app.immich.mobile.data.tagAssets
import app.immich.mobile.data.untagAssets
import app.immich.mobile.data.updateAsset
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** Description, date, place and rating of an asset. Only what was changed is sent to the server. */
@Composable
fun EditDetailsDialog(asset: AssetDto, onDismiss: () -> Unit, onSaved: () -> Unit) {
    val api = LocalContext.current.app.api
    val scope = rememberCoroutineScope()
    val exif = asset.exifInfo
    val original = remember(asset.id) {
        (exif?.dateTimeOriginal ?: asset.fileCreatedAt)?.let { runCatching { OffsetDateTime.parse(it) }.getOrNull() }
            ?: OffsetDateTime.now()
    }
    var description by remember { mutableStateOf(exif?.description.orEmpty()) }
    var date by remember { mutableStateOf(original.toLocalDate().toString()) }
    var time by remember { mutableStateOf(original.toLocalTime().withNano(0).toString().take(5)) }
    var latitude by remember { mutableStateOf(exif?.latitude?.toString().orEmpty()) }
    var longitude by remember { mutableStateOf(exif?.longitude?.toString().orEmpty()) }
    var rating by remember { mutableIntStateOf(exif?.rating ?: 0) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text("Edit details") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(description, { description = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth())
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(date, { date = it.trim() }, label = { Text("Date (YYYY-MM-DD)") }, singleLine = true, modifier = Modifier.weight(1.4f))
                    OutlinedTextField(time, { time = it.trim() }, label = { Text("Time") }, singleLine = true, modifier = Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(latitude, { latitude = it.trim() }, label = { Text("Latitude") }, singleLine = true, modifier = Modifier.weight(1f))
                    OutlinedTextField(longitude, { longitude = it.trim() }, label = { Text("Longitude") }, singleLine = true, modifier = Modifier.weight(1f))
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Rating", Modifier.padding(end = 8.dp))
                    (1..5).forEach { star ->
                        IconButton({ rating = if (rating == star) 0 else star }) {
                            Icon(if (star <= rating) Icons.Filled.Star else Icons.Filled.StarBorder, "$star stars")
                        }
                    }
                }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = {
            TextButton(
                enabled = !busy,
                onClick = {
                    val parsedDate = runCatching { LocalDate.parse(date) }.getOrNull()
                    val parsedTime = runCatching { LocalTime.parse(time) }.getOrNull()
                    if (parsedDate == null || parsedTime == null) {
                        error = "Enter the date as 2024-03-15 and the time as 14:30"
                        return@TextButton
                    }
                    val lat = latitude.toDoubleOrNull()
                    val lon = longitude.toDoubleOrNull()
                    if ((latitude.isNotEmpty() || longitude.isNotEmpty()) &&
                        (lat == null || lon == null || lat !in -90.0..90.0 || lon !in -180.0..180.0)
                    ) {
                        error = "Latitude and longitude must be numbers, for example 48.8584 and 2.2945"
                        return@TextButton
                    }
                    val moment = OffsetDateTime.of(LocalDateTime.of(parsedDate, parsedTime), original.offset)
                    val dateChanged = moment != original.withNano(0)
                    val placeChanged = lat != null && lon != null && (lat != exif?.latitude || lon != exif?.longitude)
                    busy = true
                    scope.launch {
                        try {
                            api.updateAsset(
                                asset.id,
                                description = description.takeIf { it != exif?.description.orEmpty() },
                                dateTimeOriginal = if (dateChanged) moment.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME) else null,
                                latitude = if (placeChanged) lat else null,
                                longitude = if (placeChanged) lon else null,
                                rating = rating.takeIf { it != (exif?.rating ?: 0) },
                            )
                            onSaved()
                        } catch (e: Exception) {
                            error = e.message ?: "Unable to save"
                            busy = false
                        }
                    }
                },
            ) { Text(if (busy) "Saving…" else "Save") }
        },
        dismissButton = { TextButton(onDismiss, enabled = !busy) { Text("Cancel") } },
    )
}

/** Tag chips of an asset with a button to add one and a cross to remove one. */
@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
fun TagsEditor(asset: AssetDto, onChanged: () -> Unit) {
    val api = LocalContext.current.app.api
    val scope = rememberCoroutineScope()
    var adding by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    Column(Modifier.padding(top = 12.dp)) {
        Text("Tags", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            asset.tags.forEach { tag ->
                AssistChip(
                    onClick = {},
                    label = { Text(tag.name.ifBlank { tag.value }) },
                    trailingIcon = {
                        IconButton({
                            scope.launch {
                                runCatching { api.untagAssets(tag.id, listOf(asset.id)) }
                                onChanged()
                            }
                        }, Modifier.padding(0.dp)) { Icon(Icons.Filled.Close, "Remove tag") }
                    },
                )
            }
            AssistChip(onClick = { adding = true }, label = { Text("Add tag") })
        }
    }

    if (adding) {
        AlertDialog(
            onDismissRequest = { adding = false },
            title = { Text("Add a tag") },
            text = {
                Column {
                    OutlinedTextField(name, { name = it }, label = { Text("Tag") }, singleLine = true)
                    error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                }
            },
            confirmButton = {
                TextButton(enabled = name.isNotBlank() && '/' !in name, onClick = {
                    scope.launch {
                        try {
                            api.tagAssets(listOf(name.trim()), listOf(asset.id))
                            name = ""
                            adding = false
                            onChanged()
                        } catch (e: Exception) {
                            error = e.message ?: "Unable to add the tag"
                        }
                    }
                }) { Text("Add") }
            },
            dismissButton = { TextButton({ adding = false }) { Text("Cancel") } },
        )
    }
}

private class CropPreset(val label: String, val ratio: Double?)

private val cropPresets = listOf(
    CropPreset("Original", null),
    CropPreset("1:1", 1.0),
    CropPreset("4:3", 4.0 / 3),
    CropPreset("3:4", 3.0 / 4),
    CropPreset("16:9", 16.0 / 9),
    CropPreset("9:16", 9.0 / 16),
)

private fun EditAction.param(name: String) = parameters[name]?.jsonPrimitive

/**
 * Rotate, mirror and crop a photo. The server keeps the original and applies the edits to the copies it shows.
 * Crops are centered, with the chosen shape.
 */
@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
fun EditImageDialog(asset: AssetDto, onDismiss: () -> Unit, onApplied: () -> Unit) {
    val api = LocalContext.current.app.api
    val scope = rememberCoroutineScope()
    val width = asset.width ?: asset.exifInfo?.exifImageWidth
    val height = asset.height ?: asset.exifInfo?.exifImageHeight
    var angle by remember { mutableIntStateOf(0) }
    var mirror by remember { mutableStateOf<String?>(null) }
    var preset by remember { mutableIntStateOf(0) }
    var keepCrop by remember { mutableStateOf<EditAction?>(null) }
    var hadEdits by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(asset.id) {
        val existing = runCatching { api.assetEdits(asset.id) }.getOrDefault(emptyList())
        hadEdits = existing.isNotEmpty()
        existing.forEach { edit ->
            when (edit.action) {
                "rotate" -> angle = edit.param("angle")?.intOrNull ?: 0
                "mirror" -> mirror = edit.param("axis")?.contentOrNull
                "crop" -> keepCrop = edit
            }
        }
    }

    fun finish(block: suspend () -> Unit) {
        busy = true
        scope.launch {
            try {
                block()
                onApplied()
            } catch (e: Exception) {
                error = e.message ?: "Unable to edit the photo"
                busy = false
            }
        }
    }

    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text("Edit photo") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(false, { angle = (angle + 270) % 360 }, label = { Text("Rotate left") })
                    FilterChip(false, { angle = (angle + 90) % 360 }, label = { Text("Rotate right") })
                }
                Text("Rotation: $angle°", style = MaterialTheme.typography.bodySmall)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(mirror == "horizontal", { mirror = if (mirror == "horizontal") null else "horizontal" }, label = { Text("Flip horizontally") })
                    FilterChip(mirror == "vertical", { mirror = if (mirror == "vertical") null else "vertical" }, label = { Text("Flip vertically") })
                }
                if (width != null && height != null) {
                    Text("Crop", style = MaterialTheme.typography.labelMedium)
                    androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (keepCrop != null) {
                            FilterChip(preset == -1, { preset = -1 }, label = { Text("Current crop") })
                        }
                        cropPresets.forEachIndexed { index, item ->
                            FilterChip(preset == index, { preset = index }, label = { Text(item.label) })
                        }
                    }
                }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = {
            TextButton(enabled = !busy, onClick = {
                val edits = ArrayList<EditAction>()
                when {
                    preset == -1 && keepCrop != null -> edits += keepCrop!!
                    preset > 0 && width != null && height != null -> {
                        val target = cropPresets[preset].ratio!!
                        val current = width.toDouble() / height
                        val w = if (current > target) (height * target).toInt() else width
                        val h = if (current > target) height else (width / target).toInt()
                        edits += EditAction(
                            "crop",
                            JsonObject(
                                mapOf(
                                    "x" to JsonPrimitive((width - w) / 2),
                                    "y" to JsonPrimitive((height - h) / 2),
                                    "width" to JsonPrimitive(w),
                                    "height" to JsonPrimitive(h),
                                ),
                            ),
                        )
                    }
                }
                if (angle != 0) edits += EditAction("rotate", JsonObject(mapOf("angle" to JsonPrimitive(angle))))
                mirror?.let { edits += EditAction("mirror", JsonObject(mapOf("axis" to JsonPrimitive(it)))) }
                finish { if (edits.isEmpty()) api.removeEdits(asset.id) else api.applyEdits(asset.id, edits) }
            }) { Text(if (busy) "Saving…" else "Save") }
        },
        dismissButton = {
            Row {
                if (hadEdits) {
                    TextButton(enabled = !busy, onClick = { finish { api.removeEdits(asset.id) } }) { Text("Revert") }
                }
                TextButton(onDismiss, enabled = !busy) { Text("Cancel") }
            }
        },
    )
}
