package app.immich.mobile.ui.library

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ListItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import app.immich.mobile.app
import app.immich.mobile.data.PersonDto
import app.immich.mobile.data.allPeople
import app.immich.mobile.ui.search.PersonAvatar
import java.time.LocalDate

/** Asks for a date of birth as YYYY-MM-DD, an empty value removes it. */
@Composable
fun BirthdayDialog(initial: String?, onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    var text by remember { mutableStateOf(initial.orEmpty()) }
    val valid = text.isEmpty() || runCatching { LocalDate.parse(text) }.getOrNull()?.let { !it.isAfter(LocalDate.now()) } == true
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Date of birth") },
        text = {
            OutlinedTextField(
                value = text,
                onValueChange = { text = it.trim() },
                label = { Text("YYYY-MM-DD") },
                singleLine = true,
                isError = !valid,
            )
        },
        confirmButton = { TextButton({ onConfirm(text) }, enabled = valid) { Text("Save") } },
        dismissButton = { TextButton(onDismiss) { Text("Cancel") } },
    )
}

/** Picks the people that are the same person as [target]; they are merged into it. */
@Composable
fun MergePeopleDialog(target: PersonDto, onDismiss: () -> Unit, onConfirm: (List<String>) -> Unit) {
    val api = LocalContext.current.app.api
    var people by remember { mutableStateOf<List<PersonDto>?>(null) }
    val chosen = remember { mutableStateListOf<String>() }
    LaunchedEffect(Unit) {
        people = runCatching {
            api.allPeople().filter { it.id != target.id }
                .sortedWith(compareByDescending<PersonDto> { it.name.isNotBlank() }.thenBy { it.name.lowercase() })
        }.getOrDefault(emptyList())
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Merge into ${target.name.ifBlank { "this person" }}") },
        text = {
            val list = people
            when {
                list == null -> Text("Loading…")
                list.isEmpty() -> Text("There is nobody else to merge")
                else -> LazyColumn {
                    items(list, key = { it.id }) { person ->
                        ListItem(
                            leadingContent = { PersonAvatar(person, onClick = {}, size = 40, showName = false) },
                            headlineContent = { Text(person.name.ifBlank { "Unnamed" }) },
                            trailingContent = {
                                Row { Checkbox(person.id in chosen, null) }
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { if (person.id in chosen) chosen.remove(person.id) else chosen.add(person.id) },
                        )
                    }
                }
            }
        },
        confirmButton = { TextButton({ onConfirm(chosen.toList()) }, enabled = chosen.isNotEmpty()) { Text("Merge") } },
        dismissButton = { TextButton(onDismiss) { Text("Cancel") } },
    )
}
