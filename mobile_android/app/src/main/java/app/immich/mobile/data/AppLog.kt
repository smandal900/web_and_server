package app.immich.mobile.data

import android.content.Context
import android.util.Log
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import java.io.File

/**
 * The log of the app that Settings > Advanced > Log level controls and that the Logs screen shows. The levels and
 * their numbers are the ones of the official app (`Level.LEVELS` of the Dart logging package).
 */
object AppLog {
    val levelNames = listOf("ALL", "FINEST", "FINER", "FINE", "CONFIG", "INFO", "WARNING", "SEVERE", "SHOUT", "OFF")

    const val FINE = 3
    const val INFO = 5
    const val WARNING = 6
    const val SEVERE = 7

    data class Entry(val time: Long, val level: Int, val tag: String, val message: String, val error: String? = null)

    private const val MAX = 1000
    private val entries = ArrayDeque<Entry>()
    private var file: File? = null

    /** Messages below this level are dropped. */
    @Volatile
    var minLevel = INFO

    /** Changes whenever the log does, so a screen that reads it recomposes. */
    var version by mutableIntStateOf(0)
        private set

    fun init(context: Context, level: Int) {
        minLevel = level
        val target = File(context.filesDir, "app_log.txt").also { file = it }
        runCatching {
            if (target.exists()) {
                target.readLines().takeLast(MAX).forEach { line ->
                    val parts = line.split('\t', limit = 5)
                    if (parts.size >= 4) {
                        entries.addLast(
                            Entry(
                                parts[0].toLongOrNull() ?: 0L,
                                parts[1].toIntOrNull() ?: INFO,
                                parts[2],
                                parts[3].replace("\\n", "\n"),
                                parts.getOrNull(4)?.replace("\\n", "\n")?.takeIf { it.isNotEmpty() },
                            ),
                        )
                    }
                }
            }
        }
    }

    fun log(level: Int, tag: String, message: String, error: Throwable? = null) {
        if (level < minLevel || minLevel >= 9) return
        val androidPriority = when {
            level >= SEVERE -> Log.ERROR
            level == WARNING -> Log.WARN
            level == INFO -> Log.INFO
            else -> Log.DEBUG
        }
        Log.println(androidPriority, tag, message + (error?.let { " / $it" } ?: ""))
        val entry = Entry(System.currentTimeMillis(), level, tag, message, error?.stackTraceToString())
        synchronized(entries) {
            entries.addLast(entry)
            while (entries.size > MAX) entries.removeFirst()
        }
        runCatching {
            file?.appendText(
                "${entry.time}\t$level\t$tag\t${message.replace("\n", "\\n")}\t${entry.error.orEmpty().replace("\n", "\\n")}\n",
            )
        }
        version++
    }

    fun d(tag: String, message: String) = log(FINE, tag, message)
    fun i(tag: String, message: String) = log(INFO, tag, message)
    fun w(tag: String, message: String, error: Throwable? = null) = log(WARNING, tag, message, error)
    fun e(tag: String, message: String, error: Throwable? = null) = log(SEVERE, tag, message, error)

    /** The messages, newest first. */
    fun messages(): List<Entry> = synchronized(entries) { entries.toList().asReversed() }

    fun clear() {
        synchronized(entries) { entries.clear() }
        runCatching { file?.writeText("") }
        version++
    }

    fun asText(): String = messages().asReversed().joinToString("\n") { entry ->
        val name = levelNames.getOrElse(entry.level) { entry.level.toString() }
        "[$name] ${java.time.Instant.ofEpochMilli(entry.time)} ${entry.tag}: ${entry.message}" + (entry.error?.let { e -> "\n$e" } ?: "")
    }
}
