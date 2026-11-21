package app.immich.mobile.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.immich.mobile.app
import app.immich.mobile.data.SessionStore
import kotlinx.coroutines.launch

private class HeaderRow(name: String, value: String) {
    var name by mutableStateOf(name)
    var value by mutableStateOf(value)
}

/** Editable list of header names and values. Rows with an empty name are dropped when saving. */
@Composable
private fun HeadersList(rows: MutableList<HeaderRow>) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        rows.forEachIndexed { index, row ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    row.name,
                    { row.name = it.trim() },
                    label = { Text("Header") },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
                OutlinedTextField(
                    row.value,
                    { row.value = it },
                    label = { Text("Value") },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
                IconButton({ rows.removeAt(index) }) { Icon(Icons.Filled.Close, "Remove") }
            }
        }
        TextButton({ rows.add(HeaderRow("", "")) }) {
            Icon(Icons.Filled.Add, null)
            Text("Add header")
        }
    }
}

private fun SessionStore.save(rows: List<HeaderRow>) {
    saveHeaders(rows.filter { it.name.isNotBlank() }.associate { it.name to it.value })
}

@Composable
private fun rememberRows(session: SessionStore) = remember {
    mutableStateListOf<HeaderRow>().apply {
        session.customHeaders.forEach { (name, value) -> add(HeaderRow(name, value)) }
        if (isEmpty()) add(HeaderRow("", ""))
    }
}

/** The same editor as a dialog, used on the login screen before there is a session. */
@Composable
fun HeadersDialog(onDismiss: () -> Unit) {
    val session = LocalContext.current.app.session
    val rows = rememberRows(session)
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Custom headers") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                Text(
                    "Sent with every request, for example for a reverse proxy that needs a token.",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(bottom = 8.dp),
                )
                HeadersList(rows)
            }
        },
        confirmButton = { TextButton({ session.save(rows); onDismiss() }) { Text("Save") } },
        dismissButton = { TextButton(onDismiss) { Text("Cancel") } },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HeadersSettingsScreen(onBack: () -> Unit) {
    val session = LocalContext.current.app.session
    val rows = rememberRows(session)
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }
    Scaffold(
        contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0),
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                title = { Text("Custom headers") },
                navigationIcon = { IconButton(onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                actions = {
                    TextButton({
                        session.save(rows)
                        scope.launch { snackbar.showSnackbar("Saved") }
                    }) { Text("Save") }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
        ) {
            Text(
                "Sent with every request to the server, for example for a reverse proxy that needs a token.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp),
            )
            HeadersList(rows)
        }
    }
}
