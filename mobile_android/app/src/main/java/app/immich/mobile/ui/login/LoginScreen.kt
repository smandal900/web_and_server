package app.immich.mobile.ui.login

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.TextButton
import androidx.compose.runtime.LaunchedEffect
import android.content.Intent
import android.net.Uri
import app.immich.mobile.data.ServerFeatures
import app.immich.mobile.data.configAt
import app.immich.mobile.data.featuresAt
import app.immich.mobile.data.startOAuth
import app.immich.mobile.ui.settings.HeadersDialog
import kotlinx.coroutines.delay
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import app.immich.mobile.R
import app.immich.mobile.app
import kotlinx.coroutines.launch

@Composable
fun LoginScreen() {
    val app = LocalContext.current.app
    val scope = rememberCoroutineScope()
    val focus = LocalFocusManager.current

    var server by remember { mutableStateOf(app.session.lastServerInput) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var resolvedRoot by remember { mutableStateOf<String?>(null) }
    var features by remember { mutableStateOf<ServerFeatures?>(null) }
    var oauthLabel by remember { mutableStateOf("OAuth") }
    var headers by remember { mutableStateOf(false) }
    val context = LocalContext.current
    // the login screen is optional, back returns to the photo viewer of the phone
    androidx.activity.compose.BackHandler(enabled = app.session.showLogin) { app.session.showLogin = false }

    // find out what the server offers once the address looks complete
    LaunchedEffect(server) {
        resolvedRoot = null
        features = null
        if (server.length < 4) return@LaunchedEffect
        delay(700)
        val root = runCatching { app.api.resolveServer(server) }.getOrNull() ?: return@LaunchedEffect
        resolvedRoot = root
        features = runCatching { app.api.featuresAt(root) }.getOrNull()
        oauthLabel = runCatching { app.api.configAt(root).oauthButtonText }.getOrNull()?.ifBlank { null } ?: "OAuth"
    }

    fun submit() {
        if (busy || server.isBlank() || email.isBlank() || password.isEmpty()) return
        focus.clearFocus()
        busy = true
        error = null
        scope.launch {
            try {
                val root = app.api.resolveServer(server)
                if (root == null) {
                    error = "Unable to reach the server. Check the address and your connection."
                    return@launch
                }
                val login = app.api.login(root, email.trim(), password)
                app.session.lastServerInput = server.trim()
                app.session.setServer(root)
                app.session.signIn(login)
            } catch (e: Exception) {
                error = e.message ?: "Unable to sign in"
            } finally {
                busy = false
            }
        }
    }

    Box(
        Modifier
            .fillMaxSize()
            .safeDrawingPadding()
            .imePadding(),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 28.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Image(painterResource(R.drawable.ic_launcher_foreground), null, Modifier.size(96.dp))
            Text("MyImmich", style = MaterialTheme.typography.headlineMedium)
            Text(
                "Sign in to your Immich server",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            OutlinedTextField(
                value = server,
                onValueChange = { server = it },
                label = { Text("Server address") },
                placeholder = { Text("photos.example.com") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Next),
                modifier = Modifier.fillMaxWidth(),
            )
            val passwordLogin = features?.passwordLogin != false
            val oauth = features?.oauth == true
            if (passwordLogin) {
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password") },
                    singleLine = true,
                    visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton({ showPassword = !showPassword }) {
                            Icon(
                                if (showPassword) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                                if (showPassword) "Hide password" else "Show password",
                            )
                        }
                    },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Go),
                    keyboardActions = KeyboardActions(onGo = { submit() }),
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            (error ?: app.oauthError)?.let {
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
            }

            if (passwordLogin) {
                Button(onClick = ::submit, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
                    if (busy) {
                        CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                    } else {
                        Text("Sign in")
                    }
                }
            }
            if (oauth) {
                OutlinedButton(
                    onClick = {
                        val root = resolvedRoot ?: return@OutlinedButton
                        busy = true
                        error = null
                        app.oauthError = null
                        scope.launch {
                            try {
                                val start = app.api.startOAuth(root)
                                app.session.lastServerInput = server.trim()
                                app.session.oauthPending = listOf(root, start.state, start.verifier)
                                context.startActivity(
                                    Intent(Intent.ACTION_VIEW, Uri.parse(start.url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                                )
                            } catch (e: Exception) {
                                error = e.message ?: "Unable to start the sign-in"
                            } finally {
                                busy = false
                            }
                        }
                    },
                    enabled = !busy && !app.oauthBusy && resolvedRoot != null,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    if (app.oauthBusy) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                    else Text("Sign in with $oauthLabel")
                }
            }
            TextButton({ headers = true }) { Text("Custom headers") }
            TextButton({ app.session.showLogin = false }) { Text("Continue without signing in") }
            if (headers) HeadersDialog(onDismiss = { headers = false })
        }
    }
}
