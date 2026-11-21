package app.immich.mobile.ui.sharing

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import app.immich.mobile.ui.components.ImmichSwitch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.immich.mobile.app
import app.immich.mobile.data.PartnerDto
import app.immich.mobile.data.UserDto
import app.immich.mobile.data.addPartner
import app.immich.mobile.data.partners
import app.immich.mobile.data.removePartner
import app.immich.mobile.data.setPartnerInTimeline
import app.immich.mobile.data.users
import app.immich.mobile.ui.components.CenterLoading
import app.immich.mobile.ui.components.UserAvatar
import kotlinx.coroutines.launch

/**
 * Partners: people who share their library with the user (open one to browse it, or show it in the timeline) and
 * people the user shares the whole library with.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PartnersScreen(onBack: () -> Unit, onOpenPartner: (PartnerDto) -> Unit) {
    val app = LocalContext.current.app
    val api = app.api
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }
    var sharedWithMe by remember { mutableStateOf<List<PartnerDto>?>(null) }
    var sharedByMe by remember { mutableStateOf<List<PartnerDto>>(emptyList()) }
    var everyone by remember { mutableStateOf<List<UserDto>>(emptyList()) }
    var adding by remember { mutableStateOf(false) }
    var removing by remember { mutableStateOf<PartnerDto?>(null) }

    suspend fun load() {
        try {
            sharedWithMe = api.partners("shared-with")
            sharedByMe = api.partners("shared-by")
            everyone = api.users().filter { it.id != app.session.userId }
        } catch (e: Exception) {
            sharedWithMe = sharedWithMe ?: emptyList()
            snackbar.showSnackbar(e.message ?: "Unable to load partners")
        }
    }
    LaunchedEffect(Unit) { load() }

    Scaffold(
        contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0),
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                title = { Text("Partners") },
                navigationIcon = { IconButton(onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                actions = { IconButton({ adding = true }) { Icon(Icons.Filled.Add, "Add partner") } },
            )
        },
    ) { padding ->
        val incoming = sharedWithMe
        if (incoming == null) {
            CenterLoading()
        } else {
            Column(
                Modifier
                    .padding(padding)
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState()),
            ) {
                Header("Shared with you")
                if (incoming.isEmpty()) {
                    Text(
                        "Nobody shares their photos with you yet",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                }
                incoming.forEach { partner ->
                    ListItem(
                        leadingContent = { UserAvatar(partner.id, partner.name) },
                        headlineContent = { Text(partner.name) },
                        supportingContent = { Text(partner.email) },
                        trailingContent = {
                            Row {
                                Text(
                                    "In timeline",
                                    style = MaterialTheme.typography.labelSmall,
                                    modifier = Modifier.padding(end = 8.dp),
                                )
                                ImmichSwitch(partner.inTimeline == true, { checked ->
                                    scope.launch {
                                        runCatching { api.setPartnerInTimeline(partner.id, checked) }
                                            .onFailure { snackbar.showSnackbar(it.message ?: "Unable to change") }
                                        // the timeline loads the partners again the next time it opens
                                        app.dropSource("timeline")
                                        load()
                                    }
                                })
                            }
                        },
                        modifier = Modifier.clickable { onOpenPartner(partner) },
                    )
                }

                Header("You share with")
                if (sharedByMe.isEmpty()) {
                    Text(
                        "You do not share your photos with anyone",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                }
                sharedByMe.forEach { partner ->
                    ListItem(
                        leadingContent = { UserAvatar(partner.id, partner.name) },
                        headlineContent = { Text(partner.name) },
                        supportingContent = { Text(partner.email) },
                        trailingContent = {
                            IconButton({ removing = partner }) { Icon(Icons.Filled.Close, "Stop sharing") }
                        },
                    )
                }
            }
        }
    }

    if (adding) {
        val candidates = everyone.filter { user -> sharedByMe.none { it.id == user.id } }
        AlertDialog(
            onDismissRequest = { adding = false },
            title = { Text("Share your library with") },
            text = {
                if (candidates.isEmpty()) {
                    Text("There is nobody else to share with")
                } else {
                    Column(Modifier.verticalScroll(rememberScrollState())) {
                        candidates.forEach { user ->
                            ListItem(
                                leadingContent = { UserAvatar(user.id, user.name) },
                                headlineContent = { Text(user.name) },
                                supportingContent = { Text(user.email) },
                                modifier = Modifier.clickable {
                                    adding = false
                                    scope.launch {
                                        runCatching { api.addPartner(user.id) }
                                            .onFailure { snackbar.showSnackbar(it.message ?: "Unable to add") }
                                        load()
                                    }
                                },
                            )
                        }
                    }
                }
            },
            confirmButton = { TextButton({ adding = false }) { Text("Close") } },
        )
    }

    removing?.let { partner ->
        AlertDialog(
            onDismissRequest = { removing = null },
            title = { Text("Stop sharing with ${partner.name}?") },
            text = { Text("They can no longer see your photos.") },
            confirmButton = {
                TextButton({
                    removing = null
                    scope.launch {
                        runCatching { api.removePartner(partner.id) }
                            .onFailure { snackbar.showSnackbar(it.message ?: "Unable to remove") }
                        load()
                    }
                }) { Text("Stop sharing") }
            },
            dismissButton = { TextButton({ removing = null }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun Header(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.titleSmall,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 4.dp),
    )
}
