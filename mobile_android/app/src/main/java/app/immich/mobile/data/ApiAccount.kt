package app.immich.mobile.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import okhttp3.Request
import java.security.MessageDigest
import java.security.SecureRandom
import android.util.Base64

@Serializable
data class AuthStatus(
    val pinCode: Boolean = false,
    val password: Boolean = true,
    val isElevated: Boolean = false,
)

@Serializable
private data class OAuthUrl(val url: String)

suspend fun ImmichApi.authStatus(): AuthStatus = get("/auth/status")

suspend fun ImmichApi.setupPin(pin: String) {
    post("/auth/pin-code", """{"pinCode":"$pin"}""")
}

suspend fun ImmichApi.changePin(pin: String, newPin: String) {
    put("/auth/pin-code", """{"pinCode":"$pin","newPinCode":"$newPin"}""")
}

suspend fun ImmichApi.unlockSession(pin: String) {
    post("/auth/session/unlock", """{"pinCode":"$pin"}""")
}

suspend fun ImmichApi.lockSession() {
    post("/auth/session/lock", null)
}

suspend fun ImmichApi.changePassword(current: String, new: String) {
    val body = JsonObject(mapOf("password" to JsonPrimitive(current), "newPassword" to JsonPrimitive(new)))
    post("/auth/change-password", body.toString())
}

/** The features a server offers, asked before signing in to know whether to offer OAuth or a password. */
suspend fun ImmichApi.featuresAt(root: String): ServerFeatures =
    json.decodeFromString(execute(Request.Builder().url("$root/server/features").build(), notifyUnauthorized = false))

suspend fun ImmichApi.configAt(root: String): ServerConfig =
    json.decodeFromString(execute(Request.Builder().url("$root/server/config").build(), notifyUnauthorized = false))

const val OAUTH_REDIRECT = "app.immich:///oauth-callback"

class OAuthStart(val url: String, val state: String, val verifier: String)

/** Asks the server where to send the user to sign in with the identity provider. Uses PKCE. */
suspend fun ImmichApi.startOAuth(root: String): OAuthStart {
    val random = SecureRandom()
    fun token(bytes: Int) = ByteArray(bytes).also { random.nextBytes(it) }
        .let { Base64.encodeToString(it, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP) }

    val verifier = token(48)
    val state = token(16)
    val challenge = Base64.encodeToString(
        MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray(Charsets.US_ASCII)),
        Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP,
    )
    val body = JsonObject(
        mapOf(
            "redirectUri" to JsonPrimitive(OAUTH_REDIRECT),
            "state" to JsonPrimitive(state),
            "codeChallenge" to JsonPrimitive(challenge),
        ),
    ).toString()
    val request = Request.Builder().url("$root/oauth/authorize").post(body.jsonBody()).build()
    val response: OAuthUrl = json.decodeFromString(execute(request, notifyUnauthorized = false))
    return OAuthStart(response.url, state, verifier)
}

/** Finishes the OAuth login with the address the browser redirected back to. */
suspend fun ImmichApi.finishOAuth(root: String, callbackUrl: String, state: String, verifier: String): LoginResponse {
    val body = JsonObject(
        mapOf(
            "url" to JsonPrimitive(callbackUrl),
            "state" to JsonPrimitive(state),
            "codeVerifier" to JsonPrimitive(verifier),
        ),
    ).toString()
    val request = Request.Builder().url("$root/oauth/callback").post(body.jsonBody()).build()
    return json.decodeFromString(execute(request, notifyUnauthorized = false))
}
