package app.immich.mobile

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import app.immich.mobile.ui.AppNavigation
import app.immich.mobile.ui.theme.ImmichTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            ImmichTheme {
                AppNavigation()
            }
        }
        if (savedInstanceState == null) handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    @Suppress("DEPRECATION")
    private fun handleIntent(intent: Intent?) {
        if (intent == null) return
        val data = intent.data
        when (intent.action) {
            Intent.ACTION_VIEW -> when {
                data != null && data.scheme == "app.immich" && data.path?.startsWith("/oauth-callback") == true ->
                    app.completeOAuth(data.toString())

                data != null && (data.scheme == "content" || data.scheme == "file") -> app.pendingView = data
            }

            Intent.ACTION_SEND -> {
                val uri = if (Build.VERSION.SDK_INT >= 33) {
                    intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
                } else {
                    intent.getParcelableExtra(Intent.EXTRA_STREAM)
                }
                if (uri != null) app.pendingShare = listOf(uri)
            }

            Intent.ACTION_SEND_MULTIPLE -> {
                val uris = if (Build.VERSION.SDK_INT >= 33) {
                    intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
                } else {
                    intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
                }
                if (!uris.isNullOrEmpty()) app.pendingShare = uris
            }
        }
    }
}
