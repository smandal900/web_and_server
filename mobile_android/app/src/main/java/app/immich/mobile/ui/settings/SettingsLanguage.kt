package app.immich.mobile.ui.settings

import android.app.LocaleManager
import android.os.Build
import android.os.LocaleList
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.SearchOff
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import java.util.Locale

/** The languages the official app offers, with the tag Android knows them by. */
internal val appLanguages = listOf(
    "English (en)" to "en",
    "Arabic (ar)" to "ar",
    "Basque (eu)" to "eu",
    "Belarusian (be)" to "be",
    "Bengali (bn)" to "bn",
    "Brazilian Portuguese (pt_BR)" to "pt-BR",
    "Bulgarian (bg)" to "bg",
    "Catalan (ca)" to "ca",
    "Cantonese (Traditional)" to "yue-Hant",
    "Chinese Simplified (zh_CN)" to "zh-Hans",
    "Chinese Traditional (zh_TW)" to "zh-Hant",
    "Croatian (hr)" to "hr",
    "Czech (cs)" to "cs",
    "Danish (da)" to "da",
    "Dutch (nl)" to "nl",
    "English (United Kingdom) (en_GB)" to "en-GB",
    "Estonian (et)" to "et",
    "Filipino (fil)" to "fil",
    "Filipino (Tagalog) (tl)" to "tl",
    "Finnish (fi)" to "fi",
    "French (fr)" to "fr",
    "Galician (gl)" to "gl",
    "German (de)" to "de",
    "Greek (el)" to "el",
    "Hebrew (he)" to "he",
    "Hindi (hi)" to "hi",
    "Hungarian (hu)" to "hu",
    "Indonesian (id)" to "id",
    "Italian (it)" to "it",
    "Japanese (ja)" to "ja",
    "Kabyle (kab)" to "kab",
    "Khmer (Northern) (kxm)" to "kxm",
    "Korean (ko)" to "ko",
    "Latvian (lv)" to "lv",
    "Lithuanian (lt)" to "lt",
    "Lombard (lmo)" to "lmo",
    "Mongolian (mn)" to "mn",
    "Māori (mi)" to "mi",
    "Nepali (ne)" to "ne",
    "Norwegian Bokmål (nb_NO)" to "nb-NO",
    "Polish (pl)" to "pl",
    "Portuguese (pt)" to "pt",
    "Romanian (ro)" to "ro",
    "Russian (ru)" to "ru",
    "Serbian Cyrillic (sr_Cyrl)" to "sr-Cyrl",
    "Serbian Latin (sr_Latn)" to "sr-Latn",
    "Slovak (sk)" to "sk",
    "Slovenian (sl)" to "sl",
    "Spanish (es)" to "es",
    "Swabian (swg)" to "swg",
    "Swahili (sw)" to "sw",
    "Swedish (sv)" to "sv",
    "Tamil (ta)" to "ta",
    "Telugu (te)" to "te",
    "Thai (th)" to "th",
    "Turkish (tr)" to "tr",
    "Ukrainian (uk)" to "uk",
    "Vietnamese (vi)" to "vi",
)

/** Language settings like the official page: a search field, the list of languages and an Apply button. */
@Composable
internal fun LanguagePage(snackbar: SnackbarHostState, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val currentTag = remember {
        val chosen = if (Build.VERSION.SDK_INT >= 33) {
            context.getSystemService(LocaleManager::class.java).applicationLocales.takeIf { !it.isEmpty }?.get(0)
        } else {
            null
        } ?: Locale.getDefault()
        val tag = chosen.toLanguageTag()
        appLanguages.firstOrNull { it.second.equals(tag, ignoreCase = true) }?.second
            ?: appLanguages.firstOrNull { it.second == chosen.language }?.second
            ?: "en"
    }
    var selected by remember { mutableStateOf(currentTag) }
    var search by remember { mutableStateOf("") }
    val filtered = if (search.isBlank()) appLanguages else appLanguages.filter { it.first.contains(search, ignoreCase = true) }
    val primary = MaterialTheme.colorScheme.primary

    Column(modifier.fillMaxSize()) {
        Box(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).padding(top = 16.dp, bottom = 8.dp, start = 50.dp, end = 50.dp)) {
            TextField(
                value = search,
                onValueChange = { search = it },
                placeholder = { Text("Search languages...") },
                leadingIcon = { Icon(Icons.Filled.Search, null) },
                trailingIcon = {
                    if (search.isNotEmpty()) IconButton({ search = "" }) { Icon(Icons.Filled.Clear, "Clear") }
                },
                singleLine = true,
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color.Transparent,
                    unfocusedContainerColor = Color.Transparent,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .background(
                        Brush.linearGradient(
                            listOf(primary.copy(alpha = 0.075f), primary.copy(alpha = 0.09f), primary.copy(alpha = 0.075f)),
                        ),
                    ),
            )
        }
        if (filtered.isEmpty()) {
            Column(Modifier.weight(1f).fillMaxWidth(), verticalArrangement = androidx.compose.foundation.layout.Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Filled.SearchOff, null, Modifier.size(64.dp), tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f))
                Text("No languages found", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp))
                Text(
                    "Try adjusting your search term",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f),
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        } else {
            LazyColumn(Modifier.weight(1f), contentPadding = androidx.compose.foundation.layout.PaddingValues(8.dp)) {
                items(filtered, key = { it.second }) { (name, tag) ->
                    val isSelected = tag == selected
                    Box(Modifier.padding(horizontal = 8.dp, vertical = 4.dp)) {
                        ListItem(
                            colors = ListItemDefaults.colors(
                                containerColor = if (isSelected) primary.copy(alpha = 0.15f)
                                else MaterialTheme.colorScheme.surfaceContainerLowest.copy(alpha = 0.6f),
                            ),
                            headlineContent = {
                                Text(
                                    name,
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = if (isSelected) FontWeight.W600 else FontWeight.Normal,
                                    color = if (isSelected) primary else MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            },
                            trailingContent = if (isSelected) ({ Icon(Icons.Filled.Check, null, Modifier.size(20.dp), tint = primary) }) else null,
                            modifier = Modifier
                                .height(64.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .border(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f), RoundedCornerShape(16.dp))
                                .clickable { selected = tag },
                        )
                    }
                }
            }
            Box(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).padding(16.dp)) {
                Button(
                    onClick = {
                        if (Build.VERSION.SDK_INT >= 33) {
                            context.getSystemService(LocaleManager::class.java).applicationLocales = LocaleList.forLanguageTags(selected)
                        } else {
                            scope.launch { snackbar.showSnackbar("Changing the language needs Android 13 or later") }
                        }
                    },
                    enabled = selected != currentTag,
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                ) { Text("Apply", fontWeight = FontWeight.W600, style = MaterialTheme.typography.bodyLarge) }
            }
        }
    }
}
