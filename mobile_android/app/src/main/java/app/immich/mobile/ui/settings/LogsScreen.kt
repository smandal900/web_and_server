package app.immich.mobile.ui.settings

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.immich.mobile.data.AppLog
import app.immich.mobile.ui.theme.GoogleSansCode
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val timeFormat = DateTimeFormatter.ofPattern("HH:mm:ss.SSS").withZone(ZoneId.systemDefault())

private fun truncate(message: String, maxLines: Int): String {
    val lines = message.split("\n")
    return if (lines.size < maxLines) message else lines.take(maxLines).joinToString("\n") + " ..."
}

/** The log of the app, like the official Logs page: a coloured dot per level, newest first, tap for the details. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LogsScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    var open by remember { mutableStateOf<AppLog.Entry?>(null) }
    AppLog.version // recompose when a message arrives
    val messages = AppLog.messages()
    val primary = MaterialTheme.colorScheme.primary
    val snackbar = remember { SnackbarHostState() }

    open?.let { entry ->
        LogDetail(entry, onBack = { open = null })
        return
    }

    Scaffold(
        contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0),
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                title = {
                    Text("Logs", fontWeight = FontWeight.Bold, fontSize = 16.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                },
                navigationIcon = { IconButton(onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                actions = {
                    IconButton({ AppLog.clear() }) { Icon(Icons.Outlined.DeleteOutline, "Clear logs", Modifier.size(20.dp), tint = primary) }
                    IconButton({
                        val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, AppLog.asText())
                        runCatching { context.startActivity(Intent.createChooser(send, "Share Logs").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                    }) { Icon(Icons.Outlined.Share, "Share logs", Modifier.size(20.dp), tint = primary) }
                },
            )
        },
    ) { padding ->
        LazyColumn(Modifier.padding(padding).fillMaxSize()) {
            items(messages) { entry ->
                val tile = when {
                    entry.level >= AppLog.SEVERE -> Color(0xFFFF5252).copy(alpha = 0.25f)
                    entry.level == AppLog.WARNING -> Color(0xFFFFAB40).copy(alpha = 0.25f)
                    entry.level == AppLog.INFO -> Color.Transparent
                    else -> primary.copy(alpha = 0.1f)
                }
                val dot = when {
                    entry.level >= AppLog.SEVERE -> Color(0xFFFF5252)
                    entry.level == AppLog.WARNING -> Color(0xFFFFAB40)
                    entry.level == AppLog.INFO -> primary
                    else -> Color.Gray
                }
                Row(
                    Modifier
                        .fillMaxWidth()
                        .background(tile)
                        .clickable { open = entry }
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.size(10.dp).background(dot, CircleShape))
                    Column(Modifier.weight(1f).padding(start = 16.dp)) {
                        Text(
                            truncate(entry.message, 4),
                            fontSize = 14.sp,
                            fontFamily = GoogleSansCode,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Text(
                            "at ${timeFormat.format(Instant.ofEpochMilli(entry.time))} in ${entry.tag}",
                            fontSize = 12.sp,
                            color = secondaryColor(),
                        )
                    }
                    Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, Modifier.size(20.dp))
                }
                HorizontalDivider(thickness = 0.dp)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LogDetail(entry: AppLog.Entry, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }
    Scaffold(
        contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0),
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                title = { Text("Log detail") },
                navigationIcon = { IconButton(onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
            )
        },
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize().verticalScroll(rememberScrollState())) {
            fun copy(text: String) {
                val manager = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                manager.setPrimaryClip(ClipData.newPlainText("log", text))
                scope.launch { snackbar.showSnackbar("Copied to clipboard!") }
            }
            LogBlock("MESSAGE", entry.message, onCopy = { copy(entry.message) })
            LogBlock("FROM", entry.tag, onCopy = null)
            entry.error?.let { LogBlock("STACK TRACE", it, onCopy = { copy(it) }) }
        }
    }
}

@Composable
private fun LogBlock(header: String, text: String, onCopy: (() -> Unit)?) {
    Column(Modifier.padding(8.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(
                header,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(bottom = 8.dp),
            )
            if (onCopy != null) {
                IconButton(onCopy) { Icon(Icons.Filled.ContentCopy, "Copy", Modifier.size(16.dp), tint = MaterialTheme.colorScheme.primary) }
            }
        }
        Box(
            Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surfaceContainerHigh, RoundedCornerShape(15.dp))
                .padding(8.dp),
        ) {
            SelectionContainer {
                Text(text, fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = GoogleSansCode)
            }
        }
    }
}
