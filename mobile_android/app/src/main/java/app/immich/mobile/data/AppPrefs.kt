package app.immich.mobile.data

import android.content.Context
import android.content.SharedPreferences
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.edit
import kotlin.reflect.KProperty

private class BoolPref(private val sp: SharedPreferences, private val key: String, default: Boolean) {
    private var state by mutableStateOf(sp.getBoolean(key, default))
    operator fun getValue(owner: Any?, property: KProperty<*>) = state
    operator fun setValue(owner: Any?, property: KProperty<*>, value: Boolean) {
        state = value
        sp.edit { putBoolean(key, value) }
    }
}

private class IntPref(private val sp: SharedPreferences, private val key: String, default: Int) {
    private var state by mutableStateOf(sp.getInt(key, default))
    operator fun getValue(owner: Any?, property: KProperty<*>) = state
    operator fun setValue(owner: Any?, property: KProperty<*>, value: Int) {
        state = value
        sp.edit { putInt(key, value) }
    }
}

private class TextPref(private val sp: SharedPreferences, private val key: String, default: String) {
    private var state by mutableStateOf(sp.getString(key, default) ?: default)
    operator fun getValue(owner: Any?, property: KProperty<*>) = state
    operator fun setValue(owner: Any?, property: KProperty<*>, value: String) {
        state = value
        sp.edit { putString(key, value) }
    }
}

/**
 * The options of the settings screens, the same groups as the official app: preferences, photo grid, asset viewer and
 * networking. Every property is observable from composition and saved as soon as it changes.
 */
class AppPrefs(context: Context) {
    private val sp = context.getSharedPreferences("settings", Context.MODE_PRIVATE)

    // ---- Preferences ----------------------------------------------------------------------------------------------
    /** `system`, `light` or `dark`. */
    var themeMode by TextPref(sp, "themeMode", "system")

    /** The name of a [ThemePreset]. */
    var primaryColor by TextPref(sp, "primaryColor", "indigo")
    var dynamicColor by BoolPref(sp, "dynamicColor", false)
    var colorfulInterface by BoolPref(sp, "colorfulInterface", true)
    var haptics by BoolPref(sp, "haptics", true)

    // ---- Advanced -------------------------------------------------------------------------------------------------
    /** Shows extra technical details, for troubleshooting. */
    var troubleshooting by BoolPref(sp, "troubleshooting", false)

    /** Hides everything that changes or shares photos. */
    var readOnlyMode by BoolPref(sp, "readOnlyMode", false)

    /** The level of the log, 1 (FINEST) to 8 (SHOUT) as in the official app. */
    var logLevel by IntPref(sp, "logLevel", 5)

    /** Move the files of the phone to its trash when they were deleted on the server, and back when restored. */
    var syncRemoteDeletions by BoolPref(sp, "syncRemoteDeletions", false)

    /** The device photos that sync moved to the trash: one `key TAB server id TAB uri` per line. */
    var syncTrashedText by TextPref(sp, "syncTrashed", "")

    /** Changes of the server that wait for a network: one `kind TAB value` per line, see PendingServerChanges. */
    var pendingServerText by TextPref(sp, "pendingServer", "")

    /** Load the server's pictures instead of the files on this phone. */
    var preferRemoteImage by BoolPref(sp, "preferRemoteImage", false)

    /** Whether sharing sends the original file (true) or the smaller preview. */
    var shareOriginal by BoolPref(sp, "shareOriginal", true)

    // ---- Photo grid -----------------------------------------------------------------------------------------------
    var tilesPerRow by IntPref(sp, "tilesPerRow", 4)

    /** Group the timeline by day (true) or by month. */
    var groupByDay by BoolPref(sp, "groupByDay", true)

    /** The scrollbar scrolls continuously (true) or jumps from month to month. */
    var smoothScrubbing by BoolPref(sp, "smoothScrubbing", false)
    var storageIndicator by BoolPref(sp, "storageIndicator", true)

    // ---- Asset viewer ---------------------------------------------------------------------------------------------
    var loadOriginalImage by BoolPref(sp, "loadOriginalImage", false)
    var tapToNavigate by BoolPref(sp, "tapToNavigate", false)
    var autoPlayVideo by BoolPref(sp, "autoPlayVideo", true)
    var loopVideo by BoolPref(sp, "loopVideo", false)
    var loadOriginalVideo by BoolPref(sp, "loadOriginalVideo", false)
    var slideshowRepeat by BoolPref(sp, "slideshowRepeat", false)
    var slideshowSeconds by IntPref(sp, "slideshowSeconds", 5)

    /** `contain`, `cover` or `blurred`. */
    var slideshowLook by TextPref(sp, "slideshowLook", "contain")

    /** `forward`, `backward` or `shuffle`. */
    var slideshowDirection by TextPref(sp, "slideshowDirection", "forward")

    // ---- Free Up Space --------------------------------------------------------------------------------------------
    var keepFavorites by BoolPref(sp, "keepFavorites", false)

    /** `none`, `photos` or `videos`: the kind of file that is never removed. */
    var keepMediaType by TextPref(sp, "keepMediaType", "none")
    private var keepAlbumText by TextPref(sp, "keepAlbumIds", "")
    var keepAlbumIds: Set<String>
        get() = keepAlbumText.lines().filter { it.isNotBlank() }.toSet()
        set(value) {
            keepAlbumText = value.joinToString("\n")
        }

    // ---- Networking -----------------------------------------------------------------------------------------------
    var autoSwitchEndpoint by BoolPref(sp, "autoSwitchEndpoint", false)
    var localWifiName by TextPref(sp, "localWifiName", "")
    var localEndpoint by TextPref(sp, "localEndpoint", "")

    /** The external server addresses, one per line, tried in this order. */
    private var externalText by TextPref(sp, "externalEndpoints", "")
    var externalEndpoints: List<String>
        get() = externalText.lines().map { it.trim() }.filter { it.isNotEmpty() }
        set(value) {
            externalText = value.joinToString("\n")
        }
}

/** The colors a user can pick as the primary color, with the seeds the official app uses for light and dark. */
enum class ThemePreset(val title: String, val light: Long, val dark: Long) {
    Indigo("Indigo", 0xFF4150AF, 0xFFACCBFA),
    DeepPurple("Deep purple", 0xFF6F43C0, 0xFFD3BBFF),
    Pink("Pink", 0xFFED79B5, 0xFFED79B5),
    Red("Red", 0xFFC51C16, 0xFFD3302F),
    Orange("Orange", 0xFFFF5B01, 0xFFCC6D08),
    Yellow("Yellow", 0xFFFFB400, 0xFFFFB400),
    Lime("Lime", 0xFFCDDC39, 0xFFCDDC39),
    Green("Green", 0xFF18C249, 0xFF18C249),
    Cyan("Cyan", 0xFF00BCD4, 0xFF00BCD4),
    SlateGray("Slate gray", 0xFF696969, 0xFF696969),
    ;

    companion object {
        fun of(name: String) = entries.firstOrNull { it.name.equals(name, ignoreCase = true) } ?: Indigo
    }
}
