package app.immich.mobile.ui.local

import android.app.Activity
import android.app.RecoverableSecurityException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

/**
 * Returns a function that deletes files of the device. By default they go to the bin (Android 11 and later), which
 * keeps them for 30 days; with [trash] off they are removed for good. Android asks the user to confirm, [onResult]
 * tells whether the files were deleted.
 */
@Composable
fun rememberDeviceDelete(trash: Boolean = Build.VERSION.SDK_INT >= 30, onResult: (Boolean) -> Unit): (List<Uri>) -> Unit {
    val context = LocalContext.current
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { result ->
        onResult(result.resultCode == Activity.RESULT_OK)
    }
    return { uris ->
        if (uris.isEmpty()) {
            onResult(false)
        } else {
            try {
                if (Build.VERSION.SDK_INT >= 30) {
                    // trash keeps the files in the trash of the gallery for a while, delete removes them for good
                    val sender = (
                        if (trash) MediaStore.createTrashRequest(context.contentResolver, uris, true)
                        else MediaStore.createDeleteRequest(context.contentResolver, uris)
                        ).intentSender
                    launcher.launch(IntentSenderRequest.Builder(sender).build())
                } else {
                    var asked = false
                    var ok = true
                    for (uri in uris) {
                        try {
                            context.contentResolver.delete(uri, null, null)
                        } catch (e: SecurityException) {
                            if (Build.VERSION.SDK_INT >= 29 && e is RecoverableSecurityException && !asked) {
                                asked = true
                                launcher.launch(IntentSenderRequest.Builder(e.userAction.actionIntent.intentSender).build())
                            } else {
                                ok = false
                            }
                        }
                    }
                    if (!asked) onResult(ok)
                }
            } catch (_: Exception) {
                onResult(false)
            }
        }
    }
}

/** Returns a function that takes files out of the bin of the device (Android 11 and later), after Android asked the user. */
@Composable
fun rememberDeviceRestore(onResult: (Boolean) -> Unit): (List<Uri>) -> Unit {
    val context = LocalContext.current
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { result ->
        onResult(result.resultCode == Activity.RESULT_OK)
    }
    return { uris ->
        if (uris.isEmpty() || Build.VERSION.SDK_INT < 30) {
            onResult(false)
        } else {
            try {
                val sender = MediaStore.createTrashRequest(context.contentResolver, uris, false).intentSender
                launcher.launch(IntentSenderRequest.Builder(sender).build())
            } catch (_: Exception) {
                onResult(false)
            }
        }
    }
}

/** Opens the share sheet with files of the device. */
fun shareUris(context: Context, uris: List<Uri>, mimeTypes: List<String>) {
    val mime = when {
        mimeTypes.distinct().size == 1 -> mimeTypes.first()
        mimeTypes.all { it.startsWith("image/") } -> "image/*"
        else -> "*/*"
    }
    val intent = if (uris.size == 1) {
        Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM, uris.first())
    } else {
        Intent(Intent.ACTION_SEND_MULTIPLE).putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(uris))
    }
    intent.setType(mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    context.startActivity(Intent.createChooser(intent, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
}
