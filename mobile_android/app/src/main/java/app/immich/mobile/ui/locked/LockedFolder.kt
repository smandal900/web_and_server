package app.immich.mobile.ui.locked

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import app.immich.mobile.app
import app.immich.mobile.data.AuthStatus
import app.immich.mobile.data.TimelineQuery
import app.immich.mobile.data.authStatus
import app.immich.mobile.data.changePin
import app.immich.mobile.data.lockSession
import app.immich.mobile.data.setupPin
import app.immich.mobile.data.unlockSession
import app.immich.mobile.ui.AssetActions
import app.immich.mobile.ui.AssetSourceScreen
import app.immich.mobile.ui.SourceKind
import app.immich.mobile.ui.components.CenterLoading
import app.immich.mobile.ui.components.CenterMessage
import kotlinx.coroutines.launch

private val PIN = Regex("^\\d{4,6}$")

/** Asks for the PIN and unlocks the session, which allows moving photos in and out of the locked folder. */
@Composable
fun UnlockPinDialog(onDismiss: () -> Unit, onUnlocked: () -> Unit) {
    val api = LocalContext.current.app.api
    val scope = rememberCoroutineScope()
    var pin by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun submit() {
        if (!PIN.matches(pin) || busy) return
        busy = true
        error = null
        scope.launch {
            try {
                api.unlockSession(pin)
                onUnlocked()
            } catch (e: Exception) {
                error = e.message ?: "Wrong PIN"
                pin = ""
            } finally {
                busy = false
            }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Enter your PIN") },
        text = {
            Column {
                PinField(pin, { pin = it }, "PIN", ImeAction.Done) { submit() }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp)) }
            }
        },
        confirmButton = { TextButton(::submit, enabled = PIN.matches(pin) && !busy) { Text("Unlock") } },
        dismissButton = { TextButton(onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun PinField(value: String, onChange: (String) -> Unit, label: String, ime: ImeAction, onDone: () -> Unit = {}) {
    OutlinedTextField(
        value = value,
        onValueChange = { if (it.length <= 6 && it.all(Char::isDigit)) onChange(it) },
        label = { Text(label) },
        singleLine = true,
        visualTransformation = PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword, imeAction = ime),
        keyboardActions = KeyboardActions(onDone = { onDone() }, onNext = { onDone() }),
        modifier = Modifier.fillMaxWidth(),
    )
}

/** Creates a PIN (4 to 6 digits), asking twice. */
@Composable
fun SetupPinDialog(onDismiss: () -> Unit, onDone: () -> Unit) {
    val api = LocalContext.current.app.api
    val scope = rememberCoroutineScope()
    var pin by remember { mutableStateOf("") }
    var again by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    val valid = PIN.matches(pin) && pin == again

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Create a PIN") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("The locked folder is protected with a 4 to 6 digit PIN.")
                PinField(pin, { pin = it }, "PIN", ImeAction.Next)
                PinField(again, { again = it }, "Repeat the PIN", ImeAction.Done)
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = {
            TextButton(enabled = valid, onClick = {
                scope.launch {
                    try {
                        api.setupPin(pin)
                        api.unlockSession(pin)
                        onDone()
                    } catch (e: Exception) {
                        error = e.message ?: "Unable to set the PIN"
                    }
                }
            }) { Text("Create") }
        },
        dismissButton = { TextButton(onDismiss) { Text("Cancel") } },
    )
}

@Composable
fun ChangePinDialog(onDismiss: () -> Unit, onDone: () -> Unit) {
    val api = LocalContext.current.app.api
    val scope = rememberCoroutineScope()
    var old by remember { mutableStateOf("") }
    var new by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Change PIN") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                PinField(old, { old = it }, "Current PIN", ImeAction.Next)
                PinField(new, { new = it }, "New PIN", ImeAction.Done)
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = {
            TextButton(enabled = PIN.matches(old) && PIN.matches(new), onClick = {
                scope.launch {
                    try {
                        api.changePin(old, new)
                        onDone()
                    } catch (e: Exception) {
                        error = e.message ?: "Unable to change the PIN"
                    }
                }
            }) { Text("Change") }
        },
        dismissButton = { TextButton(onDismiss) { Text("Cancel") } },
    )
}

/**
 * The locked folder: asks to create a PIN the first time and for the PIN after that, then shows the hidden photos.
 * Leaving the screen locks the session again.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LockedFolderScreen(onBack: () -> Unit, onOpen: (Int) -> Unit) {
    val app = LocalContext.current.app
    var status by remember { mutableStateOf<AuthStatus?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var unlocking by remember { mutableStateOf(false) }
    var setup by remember { mutableStateOf(false) }
    var changing by remember { mutableStateOf(false) }
    var reload by remember { mutableStateOf(0) }

    LaunchedEffect(reload) {
        try {
            status = app.api.authStatus()
            error = null
        } catch (e: Exception) {
            error = e.message ?: "Unable to reach the server"
        }
    }
    DisposableEffect(Unit) {
        onDispose {
            app.dropSource("locked")
            app.appScope.launch { runCatching { app.api.lockSession() } }
        }
    }

    val current = status
    when {
        current == null && error == null -> CenterLoading()
        current == null -> Scaffold(
            contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0),
            topBar = { LockedTopBar(onBack) },
        ) { padding ->
            Column(Modifier.padding(padding)) {
                CenterMessage("Unable to open", detail = error, action = "Try again", onAction = { reload++ })
            }
        }

        current.isElevated && current.pinCode -> {
            val source = remember { app.timeline("locked", TimelineQuery(visibility = "locked", withStacked = false)) }
            LaunchedEffect(Unit) { source.refresh() }
            AssetSourceScreen(
                title = "Locked folder",
                source = source,
                kind = SourceKind.Locked,
                emptyMessage = "Nothing is locked. Use \"Move to locked folder\" on a photo to hide it here.",
                onBack = onBack,
                onOpen = onOpen,
                actions = {
                    TextButton({ changing = true }) { Text("Change PIN") }
                },
            )
        }

        else -> Scaffold(
            contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0),
            topBar = { LockedTopBar(onBack) },
        ) { padding ->
            Column(
                Modifier
                    .padding(padding)
                    .fillMaxSize()
                    .padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Icon(Icons.Filled.Lock, null, modifier = Modifier.padding(bottom = 16.dp))
                Text(
                    if (current.pinCode) "The locked folder is locked" else "Protect the locked folder with a PIN",
                    style = MaterialTheme.typography.titleMedium,
                )
                Button(
                    onClick = { if (current.pinCode) unlocking = true else setup = true },
                    modifier = Modifier.padding(top = 16.dp),
                ) { Text(if (current.pinCode) "Enter PIN" else "Create PIN") }
            }
        }
    }

    if (unlocking) UnlockPinDialog(onDismiss = { unlocking = false }, onUnlocked = { unlocking = false; reload++ })
    if (setup) SetupPinDialog(onDismiss = { setup = false }, onDone = { setup = false; reload++ })
    if (changing) ChangePinDialog(onDismiss = { changing = false }, onDone = { changing = false })
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LockedTopBar(onBack: () -> Unit) {
    TopAppBar(
        title = { Text("Locked folder") },
        navigationIcon = { IconButton(onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
    )
}

/**
 * Returns a function that moves assets into the locked folder. It first makes sure there is a PIN and that the
 * session is unlocked, asking for the PIN when needed.
 */
@Composable
fun rememberMoveToLocked(
    actions: AssetActions,
    snackbar: androidx.compose.material3.SnackbarHostState,
    scope: kotlinx.coroutines.CoroutineScope,
): (List<String>, () -> Unit) -> Unit {
    val api = LocalContext.current.app.api
    var pending by remember { mutableStateOf<Pair<List<String>, () -> Unit>?>(null) }

    pending?.let { (ids, done) ->
        UnlockPinDialog(
            onDismiss = { pending = null },
            onUnlocked = {
                pending = null
                actions.setLocked(ids, true, done)
            },
        )
    }

    return { ids, done ->
        scope.launch {
            try {
                val status = api.authStatus()
                when {
                    !status.pinCode -> snackbar.showSnackbar("Create a PIN first, in Library > Locked folder")
                    status.isElevated -> actions.setLocked(ids, true, done)
                    else -> pending = ids to done
                }
            } catch (e: Exception) {
                snackbar.showSnackbar(e.message ?: "Unable to reach the server")
            }
        }
    }
}
