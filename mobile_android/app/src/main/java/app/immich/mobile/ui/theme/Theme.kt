package app.immich.mobile.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import android.app.Activity
import android.os.Build
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.ui.platform.LocalContext
import app.immich.mobile.app
import app.immich.mobile.data.ThemePreset
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import app.immich.mobile.R
import com.materialkolor.PaletteStyle
import com.materialkolor.dynamiccolor.ColorSpec
import com.materialkolor.rememberDynamicColorScheme

/** Same seed colors as the official app (mobile/lib/theme/color_scheme.dart, constants/colors.dart). */
val ImmichBrandLight = Color(0xFF4150AF)
val ImmichBrandDark = Color(0xFFACCBFA)

private val GoogleSans = FontFamily(
    Font(R.font.googlesans_regular, FontWeight.Normal),
    Font(R.font.googlesans_italic, FontWeight.Normal, FontStyle.Italic),
    Font(R.font.googlesans_medium, FontWeight.Medium),
    Font(R.font.googlesans_semibold, FontWeight.SemiBold),
    Font(R.font.googlesans_bold, FontWeight.Bold),
)

/** Monospace face used for the version line on the sign-in screen and for logs. */
val GoogleSansCode = FontFamily(
    Font(R.font.googlesanscode_regular, FontWeight.Normal),
    Font(R.font.googlesanscode_medium, FontWeight.Medium),
    Font(R.font.googlesanscode_semibold, FontWeight.SemiBold),
)

private fun typography(): Typography {
    val base = Typography()
    fun TextStyle.sans() = copy(fontFamily = GoogleSans)
    return Typography(
        displayLarge = base.displayLarge.sans(),
        displayMedium = base.displayMedium.sans(),
        displaySmall = base.displaySmall.sans(),
        headlineLarge = base.headlineLarge.sans(),
        headlineMedium = base.headlineMedium.sans(),
        headlineSmall = base.headlineSmall.sans(),
        // official textTheme: titleLarge 26/600, titleMedium 18/600, titleSmall 16/600
        titleLarge = base.titleLarge.sans().copy(fontSize = 26.sp, fontWeight = FontWeight.SemiBold),
        titleMedium = base.titleMedium.sans().copy(fontSize = 18.sp, fontWeight = FontWeight.SemiBold),
        titleSmall = base.titleSmall.sans().copy(fontSize = 16.sp, fontWeight = FontWeight.SemiBold),
        bodyLarge = base.bodyLarge.sans(),
        bodyMedium = base.bodyMedium.sans(),
        bodySmall = base.bodySmall.sans(),
        labelLarge = base.labelLarge.sans(),
        labelMedium = base.labelMedium.sans(),
        labelSmall = base.labelSmall.sans(),
    )
}

/** Mirrors Flutter's ColorScheme.fromSeed (tonal spot) with the primary pinned to the seed, like the indigo preset. */
@Composable
private fun immichColors(dark: Boolean, preset: ThemePreset, dynamic: Boolean, colorful: Boolean): ColorScheme {
    val context = LocalContext.current
    if (dynamic && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        return if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
    }
    val seed = Color(if (dark) preset.dark else preset.light)
    val generated = rememberDynamicColorScheme(
        seedColor = seed,
        isDark = dark,
        isAmoled = false,
        // the official "colorful interface" off setting keeps the surfaces neutral
        style = if (colorful && preset != ThemePreset.SlateGray) PaletteStyle.TonalSpot else PaletteStyle.Neutral,
        specVersion = ColorSpec.SpecVersion.SPEC_2021,
    )
    return remember(generated, dark, preset) {
        generated.copy(
            primary = seed,
            onSurface = if (dark || preset != ThemePreset.Indigo) generated.onSurface else Color(0xFF221F20),
        )
    }
}

/** The theme the user chose in Settings > Preferences: light, dark or the system's, and the primary color. */
@Composable
fun ImmichTheme(content: @Composable () -> Unit) {
    val prefs = LocalContext.current.app.prefs
    val dark = when (prefs.themeMode) {
        "light" -> false
        "dark" -> true
        else -> isSystemInDarkTheme()
    }
    // keep the status and navigation bar icons readable when the theme differs from the system's
    val view = LocalView.current
    SideEffect {
        val window = (view.context as? Activity)?.window ?: return@SideEffect
        val controller = WindowCompat.getInsetsController(window, view)
        controller.isAppearanceLightStatusBars = !dark
        controller.isAppearanceLightNavigationBars = !dark
    }
    ImmichTheme(dark, ThemePreset.of(prefs.primaryColor), prefs.dynamicColor, prefs.colorfulInterface, content)
}

@Composable
fun ImmichTheme(
    dark: Boolean,
    preset: ThemePreset,
    dynamic: Boolean,
    colorful: Boolean,
    content: @Composable () -> Unit,
) {
    MaterialTheme(colorScheme = immichColors(dark, preset, dynamic, colorful), typography = remember { typography() }) {
        // gives every screen the theme's background and a readable default text color
        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.surface, content = content)
    }
}
