package app.immich.mobile.ui.albums

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import app.immich.mobile.ui.components.ImmichSwitch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import app.immich.mobile.data.ActivityDto
import app.immich.mobile.data.AlbumDto
import app.immich.mobile.data.UserDto
import app.immich.mobile.data.activities
import app.immich.mobile.data.addAlbumUsers
import app.immich.mobile.data.addComment
import app.immich.mobile.data.addLike
import app.immich.mobile.data.deleteActivity
import app.immich.mobile.data.removeAlbumUser
import app.immich.mobile.data.setAlbumUserRole
import app.immich.mobile.data.updateAlbum
import app.immich.mobile.data.users
import app.immich.mobile.ui.components.UserAvatar
import kotlinx.coroutines.launch
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

/** Who an album is shared with. The owner can add people and change or remove them, the others can only look. */
@Composable
fun AlbumUsersDialog(album: AlbumDto, onDismiss: () -> Unit, onChanged: (AlbumDto) -> Unit) {
    val app = LocalContext.current.app
    val api = app.api
    val scope = rememberCoroutineScope()
    val isOwner = album.ownerId == app.session.userId || album.owner?.id == app.session.userId
    var members by remember(album.id) { mutableStateOf(album.albumUsers) }
    var everyone by remember { mutableStateOf<List<UserDto>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var roleMenu by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) { everyone = runCatching { api.users() }.getOrDefault(emptyList()) }

    fun mutate(block: suspend () -> AlbumDto?) {
        scope.launch {
            try {
                block()?.let {
                    members = it.albumUsers
                    onChanged(it)
                }
                error = null
            } catch (e: Exception) {
                error = e.message ?: "Unable to change the album"
            }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Shared with") },
        text = {
            LazyColumn {
                album.owner?.let { owner ->
                    item {
                        ListItem(
                            leadingContent = { UserAvatar(owner.id, owner.name) },
                            headlineContent = { Text(owner.name) },
                            supportingContent = { Text("Owner") },
                        )
                    }
                }
                items(members, key = { it.user.id }) { member ->
                    ListItem(
                        leadingContent = { UserAvatar(member.user.id, member.user.name) },
                        headlineContent = { Text(member.user.name) },
                        supportingContent = { Text(if (member.role == "viewer") "Can view" else "Can edit") },
                        trailingContent = {
                            if (isOwner) {
                                Row {
                                    Box {
                                        TextButton({ roleMenu = member.user.id }) { Text("Role") }
                                        DropdownMenu(roleMenu == member.user.id, { roleMenu = null }) {
                                            DropdownMenuItem(text = { Text("Can edit") }, onClick = {
                                                roleMenu = null
                                                mutate {
                                                    api.setAlbumUserRole(album.id, member.user.id, "editor")
                                                    api.album(album.id)
                                                }
                                            })
                                            DropdownMenuItem(text = { Text("Can view") }, onClick = {
                                                roleMenu = null
                                                mutate {
                                                    api.setAlbumUserRole(album.id, member.user.id, "viewer")
                                                    api.album(album.id)
                                                }
                                            })
                                        }
                                    }
                                    IconButton({
                                        mutate {
                                            api.removeAlbumUser(album.id, member.user.id)
                                            api.album(album.id)
                                        }
                                    }) { Icon(Icons.Filled.Close, "Remove") }
                                }
                            }
                        },
                    )
                }
                if (isOwner) {
                    val candidates = everyone.filter { user ->
                        user.id != app.session.userId && members.none { it.user.id == user.id }
                    }
                    if (candidates.isNotEmpty()) {
                        item {
                            HorizontalDivider(Modifier.padding(vertical = 8.dp))
                            Text("Add people", style = MaterialTheme.typography.titleSmall)
                        }
                        items(candidates, key = { "add-${it.id}" }) { user ->
                            ListItem(
                                leadingContent = { UserAvatar(user.id, user.name) },
                                headlineContent = { Text(user.name) },
                                supportingContent = { Text(user.email) },
                                modifier = Modifier.clickable { mutate { api.addAlbumUsers(album.id, listOf(user.id)) } },
                            )
                        }
                    }
                }
                error?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }
            }
        },
        confirmButton = { TextButton(onDismiss) { Text("Done") } },
    )
}

/** Description, sort order and whether people can comment and like. */
@Composable
fun AlbumOptionsDialog(album: AlbumDto, onDismiss: () -> Unit, onSaved: (AlbumDto) -> Unit) {
    val api = LocalContext.current.app.api
    val scope = rememberCoroutineScope()
    var description by remember(album.id) { mutableStateOf(album.description) }
    var activity by remember(album.id) { mutableStateOf(album.isActivityEnabled) }
    var newestFirst by remember(album.id) { mutableStateOf(album.order != "asc") }
    var error by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Album options") },
        text = {
            Column {
                OutlinedTextField(description, { description = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth())
                Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("Newest first", Modifier.weight(1f))
                    ImmichSwitch(newestFirst, { newestFirst = it })
                }
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("Comments and likes", Modifier.weight(1f))
                    ImmichSwitch(activity, { activity = it })
                }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = {
            TextButton({
                scope.launch {
                    try {
                        api.updateAlbum(
                            album.id,
                            description = description,
                            isActivityEnabled = activity,
                            order = if (newestFirst) "desc" else "asc",
                        )
                        onSaved(
                            album.copy(
                                description = description,
                                isActivityEnabled = activity,
                                order = if (newestFirst) "desc" else "asc",
                            ),
                        )
                    } catch (e: Exception) {
                        error = e.message ?: "Unable to save"
                    }
                }
            }) { Text("Save") }
        },
        dismissButton = { TextButton(onDismiss) { Text("Cancel") } },
    )
}

/** Comments and likes of an album, or of one photo in it when [assetId] is given. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActivitySheet(albumId: String, assetId: String?, onDismiss: () -> Unit) {
    val app = LocalContext.current.app
    val api = app.api
    val scope = rememberCoroutineScope()
    var items by remember { mutableStateOf<List<ActivityDto>>(emptyList()) }
    var text by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    val listState = rememberLazyListState()

    suspend fun load() {
        try {
            items = api.activities(albumId, assetId).sortedBy { it.createdAt }
            error = null
        } catch (e: Exception) {
            error = e.message ?: "Unable to load the activity"
        }
    }
    LaunchedEffect(albumId, assetId) { load() }
    LaunchedEffect(items.size) { if (items.isNotEmpty()) listState.animateScrollToItem(items.lastIndex) }

    val myLike = items.firstOrNull { it.type == "like" && it.user.id == app.session.userId }
    val likes = items.count { it.type == "like" }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier
                .fillMaxWidth()
                .imePadding()
                .navigationBarsPadding()
                .padding(horizontal = 16.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (assetId != null) "Activity on this photo" else "Album activity",
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.weight(1f),
                )
                IconButton({
                    scope.launch {
                        try {
                            if (myLike != null) api.deleteActivity(myLike.id) else api.addLike(albumId, assetId)
                            load()
                        } catch (e: Exception) {
                            error = e.message
                        }
                    }
                }) {
                    Icon(
                        if (myLike != null) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                        "Like",
                        tint = if (myLike != null) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
                    )
                }
                Text("$likes")
            }
            val comments = items.filter { it.type == "comment" }
            if (comments.isEmpty() && error == null) {
                Text(
                    "No comments yet",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 16.dp),
                )
            }
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            LazyColumn(Modifier.height(if (comments.isEmpty()) 0.dp else 280.dp), state = listState) {
                items(comments, key = { it.id }) { activity ->
                    ListItem(
                        leadingContent = { UserAvatar(activity.user.id, activity.user.name, size = 36.dp) },
                        headlineContent = { Text(activity.comment.orEmpty()) },
                        supportingContent = { Text("${activity.user.name} · ${formatTime(activity.createdAt)}") },
                        trailingContent = {
                            if (activity.user.id == app.session.userId) {
                                IconButton({
                                    scope.launch {
                                        runCatching { api.deleteActivity(activity.id) }
                                        load()
                                    }
                                }) { Icon(Icons.Filled.Delete, "Delete") }
                            }
                        },
                    )
                }
            }
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    text,
                    { text = it },
                    placeholder = { Text("Add a comment") },
                    modifier = Modifier.weight(1f),
                )
                IconButton(
                    enabled = text.isNotBlank(),
                    onClick = {
                        val message = text.trim()
                        text = ""
                        scope.launch {
                            try {
                                api.addComment(albumId, message, assetId)
                                load()
                            } catch (e: Exception) {
                                error = e.message ?: "Unable to send"
                            }
                        }
                    },
                ) { Icon(Icons.Filled.Send, "Send") }
            }
        }
    }
}

private fun formatTime(value: String?): String =
    value?.let {
        runCatching {
            OffsetDateTime.parse(it).format(DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT))
        }.getOrNull()
    }.orEmpty()
