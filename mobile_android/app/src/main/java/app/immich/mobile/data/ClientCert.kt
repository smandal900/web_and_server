package app.immich.mobile.data

import android.content.Context
import java.io.ByteArrayInputStream
import java.io.File
import java.security.KeyStore
import javax.net.ssl.KeyManagerFactory
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLSocketFactory
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager

/**
 * The SSL client certificate of Settings > Advanced (PKCS12 only). The server proves who it is as usual and the app
 * answers with this certificate when a proxy in front of the server asks for one (mutual TLS).
 */
object ClientCert {
    private var directory: File? = null
    private var prefs: android.content.SharedPreferences? = null

    private val file get() = File(directory, "client_cert.p12")

    fun init(context: Context) {
        directory = context.filesDir
        prefs = context.getSharedPreferences("client_cert", Context.MODE_PRIVATE)
    }

    fun exists(): Boolean = file.exists() && file.length() > 0

    /** Throws when the file is no PKCS12 certificate or the password is wrong. */
    fun import(bytes: ByteArray, password: String) {
        val store = KeyStore.getInstance("PKCS12")
        store.load(ByteArrayInputStream(bytes), password.toCharArray())
        require(store.aliases().hasMoreElements()) { "The file holds no certificate" }
        file.writeBytes(bytes)
        prefs?.edit()?.putString("password", password)?.apply()
    }

    fun remove() {
        file.delete()
        prefs?.edit()?.remove("password")?.apply()
    }

    /** What OkHttp needs to answer the server with the certificate, or null when there is none. */
    fun sslConfig(): Pair<SSLSocketFactory, X509TrustManager>? {
        if (!exists()) return null
        return runCatching {
            val password = prefs?.getString("password", "").orEmpty().toCharArray()
            val store = KeyStore.getInstance("PKCS12").apply { load(file.inputStream(), password) }
            val keys = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm()).apply { init(store, password) }
            val trust = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm()).apply { init(null as KeyStore?) }
            val manager = trust.trustManagers.filterIsInstance<X509TrustManager>().first()
            val context = SSLContext.getInstance("TLS").apply { init(keys.keyManagers, arrayOf(manager), null) }
            context.socketFactory to manager
        }.onFailure { AppLog.e("ClientCert", "Unable to use the client certificate", it) }.getOrNull()
    }
}
