package app.immich.mobile.ui.settings

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import app.immich.mobile.app
import app.immich.mobile.data.changePassword
import kotlinx.coroutines.launch

/** Changes the password. When [forced] the user has to do it before using the app, so it cannot be dismissed. */
@Composable
fun ChangePasswordDialog(forced: Boolean, onDismiss: () -> Unit, onDone: () -> Unit) {
    val app = LocalContext.current.app
    val scope = rememberCoroutineScope()
    var current by remember { mutableStateOf("") }
    var new by remember { mutableStateOf("") }
    var repeat by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val valid = current.isNotEmpty() && new.length >= 8 && new == repeat

    AlertDialog(
        onDismissRequest = { if (!forced && !busy) onDismiss() },
        title = { Text(if (forced) "Choose a new password" else "Change password") },
        text = {
            Column {
                if (forced) {
                    Text(
                        "The administrator asks you to change your password before you continue.",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(bottom = 8.dp),
                    )
                }
                val keyboard = KeyboardOptions(keyboardType = KeyboardType.Password)
                OutlinedTextField(
                    current, { current = it }, label = { Text("Current password") }, singleLine = true,
                    visualTransformation = PasswordVisualTransformation(), keyboardOptions = keyboard,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    new, { new = it }, label = { Text("New password (8+ characters)") }, singleLine = true,
                    visualTransformation = PasswordVisualTransformation(), keyboardOptions = keyboard,
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                )
                OutlinedTextField(
                    repeat, { repeat = it }, label = { Text("Repeat the new password") }, singleLine = true,
                    visualTransformation = PasswordVisualTransformation(), keyboardOptions = keyboard,
                    isError = repeat.isNotEmpty() && repeat != new,
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                )
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp)) }
            }
        },
        confirmButton = {
            TextButton(
                enabled = valid && !busy,
                onClick = {
                    busy = true
                    error = null
                    scope.launch {
                        try {
                            app.api.changePassword(current, new)
                            app.session.mustChangePassword = false
                            onDone()
                        } catch (e: Exception) {
                            error = e.message ?: "Unable to change the password"
                        } finally {
                            busy = false
                        }
                    }
                },
            ) { Text("Change") }
        },
        dismissButton = {
            if (!forced) TextButton(onDismiss, enabled = !busy) { Text("Cancel") }
        },
    )
}
