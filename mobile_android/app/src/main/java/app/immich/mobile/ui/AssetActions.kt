package app.immich.mobile.ui

import androidx.compose.material3.SnackbarHostState
import app.immich.mobile.ImmichApp
import app.immich.mobile.data.AssetSource
import app.immich.mobile.data.PendingServerChanges
import app.immich.mobile.data.createStack
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/** Changes to assets that several screens offer. Each one updates the server and then the list on screen. */
class AssetActions(
    private val app: ImmichApp,
    private val source: AssetSource,
    private val scope: CoroutineScope,
    private val snackbar: SnackbarHostState,
) {
    private fun run(errorMessage: String, block: suspend () -> Unit, onDone: () -> Unit = {}) {
        scope.launch {
            try {
                block()
                onDone()
            } catch (e: Exception) {
                snackbar.showSnackbar(e.message ?: errorMessage)
            }
        }
    }

    fun setFavorite(ids: Collection<String>, favorite: Boolean, onDone: () -> Unit = {}) = run("Unable to update", {
        app.api.setFavorite(ids, favorite)
        ids.forEach { id -> source.update(id) { it.copy(isFavorite = favorite) } }
    }, onDone)

    /** Archived assets leave the timeline, unarchived ones leave the archive. */
    fun setArchived(ids: Collection<String>, archived: Boolean, onDone: () -> Unit = {}) = run("Unable to update", {
        app.api.setVisibility(ids, if (archived) "archive" else "timeline")
        source.remove(ids.toSet())
        snackbar.showSnackbar(if (archived) "Moved to the archive" else "Moved to the timeline")
    }, onDone)

    fun trash(ids: Collection<String>, onDone: () -> Unit = {}) = run("Unable to delete", {
        app.api.trash(ids)
        source.remove(ids.toSet())
        snackbar.showSnackbar("Moved to the trash")
    }, onDone)

    fun deletePermanently(ids: Collection<String>, onDone: () -> Unit = {}) = run("Unable to delete", {
        app.api.trash(ids, force = true)
        source.remove(ids.toSet())
    }, onDone)

    fun restore(ids: Collection<String>, onDone: () -> Unit = {}) = run("Unable to restore", {
        app.api.restore(ids)
        source.remove(ids.toSet())
        snackbar.showSnackbar("Restored")
    }, onDone)

    fun removeFromAlbum(albumId: String, ids: Collection<String>, onDone: () -> Unit = {}) = run("Unable to remove", {
        app.api.removeFromAlbum(albumId, ids.toList())
        source.remove(ids.toSet())
    }, onDone)

    fun addToAlbum(albumId: String, ids: Collection<String>, onDone: () -> Unit = {}) = run("Unable to add", {
        app.api.addToAlbums(listOf(albumId), ids.toList())
        snackbar.showSnackbar("Added to the album")
    }, onDone)

    fun addToNewAlbum(name: String, ids: Collection<String>, onDone: () -> Unit = {}) = run("Unable to create the album", {
        app.api.createAlbum(name, ids.toList())
        snackbar.showSnackbar("Created \"$name\"")
    }, onDone)

    /** Stacks the assets under the first one, the others disappear from the grid behind it. */
    fun stack(ids: List<String>, onDone: () -> Unit = {}) = run("Unable to stack", {
        app.api.createStack(ids)
        source.refresh()
        snackbar.showSnackbar("Stacked ${ids.size} items")
    }, onDone)

    /** Moves assets into the locked folder, or back to the timeline. The session has to be unlocked for it. */
    fun setLocked(ids: Collection<String>, locked: Boolean, onDone: () -> Unit = {}) = run("Unable to move", {
        app.api.setVisibility(ids, if (locked) "locked" else "timeline")
        source.remove(ids.toSet())
        snackbar.showSnackbar(if (locked) "Moved to the locked folder" else "Removed from the locked folder")
    }, onDone)

    /** Sends photos of the device to the server. The grid shows the server's copy once that is done. */
    fun uploadLocal(items: Collection<app.immich.mobile.data.AssetItem>, onDone: () -> Unit = {}) = run("Unable to upload", {
        val assets = items.mapNotNull { app.backup.localAsset(it) }
        if (assets.isEmpty()) return@run
        scope.launch { snackbar.showSnackbar("Uploading ${assets.size} ${if (assets.size == 1) "item" else "items"}") }
        val failed = app.backup.uploadNow(assets)
        source.refresh()
        snackbar.currentSnackbarData?.dismiss()
        snackbar.showSnackbar(if (failed == 0) "Uploaded" else "$failed could not be uploaded")
    }, onDone)

    /**
     * Finishes a delete of [plan]: the files of the phone are in its bin by now, the copies on the server move to the
     * trash of the server. Photos that were never uploaded only touch the phone.
     */
    fun delete(plan: DeletePlan, onDone: () -> Unit = {}) = run("Unable to delete", {
        var serverError: String? = null
        var waiting = false
        if (plan.serverIds.isNotEmpty()) {
            try {
                app.api.trash(plan.serverIds)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                if (PendingServerChanges.isOffline(e)) {
                    // offline or the server is down: the trash of the server follows when it answers again
                    app.pending.trash(plan.serverIds)
                    waiting = true
                } else {
                    serverError = e.message ?: "the server refused it"
                }
            }
        }
        // the files are gone from the gallery, the grids of the device show that
        if (plan.deviceUris.isNotEmpty()) scope.launch { runCatching { app.backup.scanDevice() } }
        if (serverError == null) source.remove(plan.items.map { it.id }.toSet()) else source.refresh()
        val message = when {
            serverError != null -> "Moved to the bin on this phone, but not to the trash on the server: $serverError"
            waiting && plan.deviceUris.isNotEmpty() -> "Moved to the bin. The trash on the server follows when you are back online"
            waiting -> "The trash on the server follows when you are back online"
            plan.deviceUris.isNotEmpty() && plan.serverIds.isNotEmpty() -> "Moved to the bin and to the trash on the server"
            plan.deviceUris.isNotEmpty() -> "Moved to the bin"
            else -> "Moved to the trash"
        }
        scope.launch { snackbar.showSnackbar(message) }
    }, onDone)
}
