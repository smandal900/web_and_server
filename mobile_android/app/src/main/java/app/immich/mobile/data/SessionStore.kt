package app.immich.mobile.data

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.edit
import kotlinx.serialization.encodeToString

/** Server address and credentials of the signed in user, kept in the app's private preferences. */
class SessionStore(context: Context) {
    private val prefs = context.getSharedPreferences("session", Context.MODE_PRIVATE)

    /** The API root, for example `https://photos.example.com/api`. */
    var serverUrl: String = prefs.getString(KEY_SERVER, "").orEmpty()
        private set

    var token: String = prefs.getString(KEY_TOKEN, "").orEmpty()
        private set

    var userId: String = prefs.getString(KEY_USER_ID, "").orEmpty()
        private set

    var userName: String = prefs.getString(KEY_USER_NAME, "").orEmpty()
        private set

    var userEmail: String = prefs.getString(KEY_USER_EMAIL, "").orEmpty()
        private set

    var isAdmin: Boolean = prefs.getBoolean(KEY_ADMIN, false)
        private set

    /** Observed by the navigation so signing out anywhere returns to the login screen. */
    var isLoggedIn by mutableStateOf(token.isNotEmpty() && serverUrl.isNotEmpty())
        private set

    /** True while the login screen is open on top of the offline photo viewer. Not kept between launches. */
    var showLogin by mutableStateOf(false)

    /** Extra HTTP headers sent with every request, for servers behind a proxy that needs them. */
    var customHeaders: Map<String, String> = loadHeaders()
        private set

    fun saveHeaders(headers: Map<String, String>) {
        customHeaders = headers
        prefs.edit { putString(KEY_HEADERS, kotlinx.serialization.json.Json.encodeToString(headers)) }
    }

    private fun loadHeaders(): Map<String, String> = try {
        kotlinx.serialization.json.Json.decodeFromString(prefs.getString(KEY_HEADERS, "{}").orEmpty())
    } catch (_: Exception) {
        emptyMap()
    }

    /** Set after a login that must be followed by choosing a new password. */
    var mustChangePassword by mutableStateOf(false)

    /** The pending OAuth login while the browser is open: server root, state and PKCE verifier. */
    var oauthPending: List<String>
        get() = prefs.getString(KEY_OAUTH, "").orEmpty().split(SEPARATOR).filter { it.isNotEmpty() }
        set(value) = prefs.edit { putString(KEY_OAUTH, value.joinToString(SEPARATOR)) }

    /** The server the login screen was last used with, kept after signing out. */
    var lastServerInput: String
        get() = prefs.getString(KEY_LAST_INPUT, "").orEmpty()
        set(value) = prefs.edit { putString(KEY_LAST_INPUT, value) }

    fun setServer(url: String) {
        serverUrl = url
        prefs.edit { putString(KEY_SERVER, url) }
    }

    fun signIn(login: LoginResponse) {
        token = login.accessToken
        userId = login.userId
        userName = login.name
        userEmail = login.userEmail
        isAdmin = login.isAdmin
        mustChangePassword = login.shouldChangePassword
        prefs.edit {
            putString(KEY_TOKEN, token)
            putString(KEY_USER_ID, userId)
            putString(KEY_USER_NAME, userName)
            putString(KEY_USER_EMAIL, userEmail)
            putBoolean(KEY_ADMIN, isAdmin)
        }
        isLoggedIn = true
        showLogin = false
    }

    fun signOut() {
        token = ""
        userId = ""
        userName = ""
        userEmail = ""
        isAdmin = false
        prefs.edit {
            remove(KEY_TOKEN)
            remove(KEY_USER_ID)
            remove(KEY_USER_NAME)
            remove(KEY_USER_EMAIL)
            remove(KEY_ADMIN)
        }
        isLoggedIn = false
        showLogin = false
        mustChangePassword = false
    }

    private companion object {
        const val KEY_SERVER = "server"
        const val KEY_TOKEN = "token"
        const val KEY_USER_ID = "userId"
        const val KEY_USER_NAME = "userName"
        const val KEY_USER_EMAIL = "userEmail"
        const val KEY_ADMIN = "admin"
        const val KEY_LAST_INPUT = "lastServerInput"
        const val KEY_HEADERS = "customHeaders"
        const val KEY_OAUTH = "oauthPending"
        const val SEPARATOR = "|"
    }
}
