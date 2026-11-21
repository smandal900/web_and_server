package app.immich.mobile.ui.sharing

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import app.immich.mobile.ui.components.ImmichSwitch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.immich.mobile.app
import app.immich.mobile.data.SharedLinkCreate
import app.immich.mobile.data.SharedLinkDto
import app.immich.mobile.data.createSharedLink
import app.immich.mobile.data.deleteSharedLink
import app.immich.mobile.data.sharedLinkUrl
import app.immich.mobile.data.sharedLinks
import app.immich.mobile.data.updateSharedLink
import app.immich.mobile.ui.components.CenterLoading
import app.immich.mobile.ui.components.CenterMessage
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.time.temporal.ChronoUnit

fun copyText(context: Context, text: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    clipboard.setPrimaryClip(ClipData.newPlainText("link", text))
}

fun shareText(context: Context, text: String) {
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, text)
    }
    context.startActivity(Intent.createChooser(intent, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
}

private class Expiry(val label: String, val amount: Long, val unit: ChronoUnit?) {
    fun at(): String? = unit?.let { Instant.now().plus(amount, it).toString() }
}

private val expiries = listOf(
    Expiry("Never", 0, null),
    Expiry("30 minutes", 30, ChronoUnit.MINUTES),
    Expiry("1 hour", 1, ChronoUnit.HOURS),
    Expiry("6 hours", 6, ChronoUnit.HOURS),
    Expiry("1 day", 1, ChronoUnit.DAYS),
    Expiry("7 days", 7, ChronoUnit.DAYS),
    Expiry("30 days", 30, ChronoUnit.DAYS),
)

/**
 * Creates a public link for an album ([albumId]) or for single photos ([assetIds]) in three steps: options,
 * creating, and the finished link to copy or share.
 */
@Composable
fun ShareLinkFlow(assetIds: List<String>?, albumId: String?, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val api = context.app.api
    val scope = rememberCoroutineScope()
    var description by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var expiry by remember { mutableStateOf(expiries[0]) }
    var allowDownload by remember { mutableStateOf(true) }
    var showMetadata by remember { mutableStateOf(true) }
    var allowUpload by remember { mutableStateOf(false) }
    var expiryMenu by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var created by remember { mutableStateOf<String?>(null) }

    val url = created
    if (url != null) {
        AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text("Link created") },
            text = { Text(url, style = MaterialTheme.typography.bodyMedium) },
            confirmButton = {
                Row {
                    TextButton({ copyText(context, url) }) { Text("Copy") }
                    TextButton({ shareText(context, url) }) { Text("Share") }
                }
            },
            dismissButton = { TextButton(onDismiss) { Text("Done") } },
        )
        return
    }

    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text("Create a link") },
        text = {
            Column {
                OutlinedTextField(description, { description = it }, label = { Text("Description") }, singleLine = true)
                OutlinedTextField(
                    password,
                    { password = it },
                    label = { Text("Password (optional)") },
                    singleLine = true,
                    modifier = Modifier.padding(top = 8.dp),
                )
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Expires", Modifier.weight(1f))
                    TextButton({ expiryMenu = true }) { Text(expiry.label) }
                    DropdownMenu(expiryMenu, { expiryMenu = false }) {
                        expiries.forEach {
                            DropdownMenuItem(text = { Text(it.label) }, onClick = { expiry = it; expiryMenu = false })
                        }
                    }
                }
                SwitchRow("Allow downloads", allowDownload) { allowDownload = it }
                SwitchRow("Show metadata", showMetadata) { showMetadata = it }
                if (albumId != null) SwitchRow("Allow uploads", allowUpload) { allowUpload = it }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = {
            TextButton(
                enabled = !busy,
                onClick = {
                    busy = true
                    error = null
                    scope.launch {
                        try {
                            val link = api.createSharedLink(
                                SharedLinkCreate(
                                    type = if (albumId != null) "ALBUM" else "INDIVIDUAL",
                                    assetIds = if (albumId == null) assetIds else null,
                                    albumId = albumId,
                                    description = description.ifBlank { null },
                                    password = password.ifBlank { null },
                                    expiresAt = expiry.at(),
                                    allowUpload = allowUpload,
                                    allowDownload = allowDownload,
                                    showMetadata = showMetadata,
                                ),
                            )
                            created = api.sharedLinkUrl(link)
                        } catch (e: Exception) {
                            error = e.message ?: "Unable to create the link"
                        } finally {
                            busy = false
                        }
                    }
                },
            ) { Text(if (busy) "Creating…" else "Create") }
        },
        dismissButton = { TextButton(onDismiss, enabled = !busy) { Text("Cancel") } },
    )
}

@Composable
private fun SwitchRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable { onChange(!checked) },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, Modifier.weight(1f))
        ImmichSwitch(checked, onChange)
    }
}

/** All links of the user, to copy, share, change or remove. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SharedLinksScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val api = context.app.api
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }
    var links by remember { mutableStateOf<List<SharedLinkDto>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var editing by remember { mutableStateOf<SharedLinkDto?>(null) }
    var deleting by remember { mutableStateOf<SharedLinkDto?>(null) }

    suspend fun load() {
        try {
            links = api.sharedLinks().sortedByDescending { it.createdAt }
            error = null
        } catch (e: Exception) {
            error = e.message ?: "Unable to load the links"
        }
    }
    LaunchedEffect(Unit) { load() }

    Scaffold(
        contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0),
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                title = { Text("Shared links") },
                navigationIcon = { IconButton(onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
            )
        },
    ) { padding ->
        val list = links
        Column(
            Modifier
                .padding(padding)
                .fillMaxSize(),
        ) {
            when {
                list == null && error == null -> CenterLoading()
                list == null -> CenterMessage("Unable to load", detail = error, action = "Try again", onAction = { scope.launch { load() } })
                list.isEmpty() -> CenterMessage("No shared links", detail = "Create one from an album or from selected photos")
                else -> LazyColumn {
                    items(list, key = { it.id }) { link ->
                        val title = link.description?.ifBlank { null }
                            ?: link.album?.albumName
                            ?: "${link.assets.size} shared items"
                        ListItem(
                            headlineContent = { Text(title, maxLines = 1) },
                            supportingContent = {
                                Text(
                                    buildString {
                                        append(if (link.type == "ALBUM") "Album" else "Photos")
                                        append(" · ")
                                        append(expiryText(link.expiresAt))
                                        if (!link.password.isNullOrEmpty()) append(" · Password")
                                    },
                                )
                            },
                            trailingContent = {
                                Row {
                                    IconButton({
                                        copyText(context, api.sharedLinkUrl(link))
                                        scope.launch { snackbar.showSnackbar("Link copied") }
                                    }) { Icon(Icons.Filled.ContentCopy, "Copy") }
                                    IconButton({ shareText(context, api.sharedLinkUrl(link)) }) { Icon(Icons.Filled.Share, "Share") }
                                    IconButton({ editing = link }) { Icon(Icons.Filled.Edit, "Edit") }
                                    IconButton({ deleting = link }) { Icon(Icons.Filled.Delete, "Delete") }
                                }
                            },
                        )
                    }
                }
            }
        }
    }

    editing?.let { link ->
        var description by remember(link.id) { mutableStateOf(link.description.orEmpty()) }
        var allowDownload by remember(link.id) { mutableStateOf(link.allowDownload) }
        var showMetadata by remember(link.id) { mutableStateOf(link.showMetadata) }
        var allowUpload by remember(link.id) { mutableStateOf(link.allowUpload) }
        AlertDialog(
            onDismissRequest = { editing = null },
            title = { Text("Edit link") },
            text = {
                Column {
                    OutlinedTextField(description, { description = it }, label = { Text("Description") }, singleLine = true)
                    SwitchRow("Allow downloads", allowDownload) { allowDownload = it }
                    SwitchRow("Show metadata", showMetadata) { showMetadata = it }
                    if (link.type == "ALBUM") SwitchRow("Allow uploads", allowUpload) { allowUpload = it }
                }
            },
            confirmButton = {
                TextButton({
                    editing = null
                    scope.launch {
                        runCatching { api.updateSharedLink(link.id, description, allowDownload, showMetadata, allowUpload) }
                            .onFailure { snackbar.showSnackbar(it.message ?: "Unable to save") }
                        load()
                    }
                }) { Text("Save") }
            },
            dismissButton = { TextButton({ editing = null }) { Text("Cancel") } },
        )
    }

    deleting?.let { link ->
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("Delete the link?") },
            text = { Text("People who have the link can no longer open it.") },
            confirmButton = {
                TextButton({
                    deleting = null
                    scope.launch {
                        runCatching { api.deleteSharedLink(link.id) }
                            .onFailure { snackbar.showSnackbar(it.message ?: "Unable to delete") }
                        load()
                    }
                }) { Text("Delete") }
            },
            dismissButton = { TextButton({ deleting = null }) { Text("Cancel") } },
        )
    }
}

private fun expiryText(expiresAt: String?): String {
    if (expiresAt == null) return "Never expires"
    return runCatching {
        val date = OffsetDateTime.parse(expiresAt)
        if (date.isBefore(OffsetDateTime.now())) {
            "Expired"
        } else {
            "Expires " + date.format(DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT))
        }
    }.getOrDefault("Expires $expiresAt")
}
