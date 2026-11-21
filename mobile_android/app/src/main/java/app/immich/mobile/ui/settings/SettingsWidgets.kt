package app.immich.mobile.ui.settings

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import app.immich.mobile.ui.components.ImmichSwitch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.graphics.ColorUtils

/**
 * The secondary text color of the official app: the text color moved 30 % towards the background in lightness
 * (`onSurfaceSecondary` in its theme extension).
 */
@Composable
internal fun secondaryColor(): Color {
    val base = MaterialTheme.colorScheme.onSurface
    val dark = MaterialTheme.colorScheme.surface.luminance() < 0.5f
    val hsl = FloatArray(3)
    ColorUtils.colorToHSL(base.toArgb(), hsl)
    hsl[2] = (if (dark) hsl[2] - 0.3f else hsl[2] + 0.3f).coerceIn(0f, 1f)
    return Color(ColorUtils.HSLToColor(hsl))
}

/** The rows of a settings page, laid out like the official `SettingsSubPageScaffold`. */
internal class SettingsItems {
    val list = mutableListOf<@Composable () -> Unit>()

    fun item(content: @Composable () -> Unit) {
        list += content
    }
}

/**
 * A page of settings: 16 dp above and 10 dp between the rows, or a divider between the groups when [divider] is set.
 */
@Composable
internal fun SettingsList(divider: Boolean = false, build: SettingsItems.() -> Unit) {
    val items = SettingsItems().apply(build).list
    Column(Modifier.padding(vertical = 16.dp)) {
        items.forEachIndexed { index, content ->
            content()
            if (index < items.lastIndex) {
                if (divider) {
                    Column {
                        Spacer(Modifier.height(5.dp))
                        HorizontalDivider(thickness = 1.dp)
                        Spacer(Modifier.height(15.dp))
                    }
                } else {
                    Spacer(Modifier.height(10.dp))
                }
            }
        }
        Spacer(Modifier.height(60.dp))
    }
}

/** A group heading, with an optional icon and a short explanation. */
@Composable
internal fun GroupTitle(title: String, icon: ImageVector? = null, subtitle: String? = null) {
    Column(Modifier.padding(start = 20.dp, end = 20.dp, bottom = 8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) {
                Icon(icon, null, Modifier.size(20.dp), tint = secondaryColor())
                Spacer(Modifier.padding(start = 8.dp))
            }
            Text(title, style = MaterialTheme.typography.labelLarge, color = secondaryColor())
        }
        if (subtitle != null) {
            Text(
                subtitle,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 200 / 255f),
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}

@Composable
internal fun SubTitle(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.bodyLarge,
        fontWeight = FontWeight.W700,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(start = 20.dp),
    )
}

/** A row with a title and a subtitle, the official `SettingListTile`. */
@Composable
internal fun SettingTile(
    title: String,
    subtitle: String? = null,
    leading: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
    onClick: (() -> Unit)? = null,
    titleColor: Color = Color.Unspecified,
    startPadding: androidx.compose.ui.unit.Dp = 16.dp,
) {
    ListItem(
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
        leadingContent = leading,
        headlineContent = { Text(title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.W500, color = titleColor) },
        supportingContent = subtitle?.let {
            { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 215 / 255f)) }
        },
        trailingContent = trailing,
        modifier = Modifier
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(start = startPadding - 16.dp),
    )
}

/** A switch row, the official `SettingsSwitchListTile`. */
@Composable
internal fun SwitchTile(
    title: String,
    subtitle: String? = null,
    checked: Boolean,
    enabled: Boolean = true,
    icon: ImageVector? = null,
    startPadding: androidx.compose.ui.unit.Dp = 4.dp,
    endPadding: androidx.compose.ui.unit.Dp = 0.dp,
    onChange: (Boolean) -> Unit,
) {
    val disabled = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
    ListItem(
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
        leadingContent = icon?.let { { Icon(it, null, tint = if (checked) MaterialTheme.colorScheme.primary else LocalContentColorFallback()) } },
        headlineContent = {
            Text(
                title,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.W500,
                color = if (enabled) Color.Unspecified else disabled,
            )
        },
        supportingContent = subtitle?.let {
            { Text(it, style = MaterialTheme.typography.bodyMedium, color = if (enabled) secondaryColor() else disabled) }
        },
        trailingContent = { ImmichSwitch(checked, { if (enabled) onChange(it) }, enabled = enabled) },
        modifier = Modifier
            .clickable(enabled = enabled) { onChange(!checked) }
            .padding(start = startPadding, end = endPadding),
    )
}

@Composable
private fun LocalContentColorFallback(): Color = MaterialTheme.colorScheme.onSurface

/** A slider with its title above, the official `SettingsSliderListTile`. [onChangeEnd] runs when the finger is lifted. */
@Composable
internal fun SliderTile(
    text: String,
    value: Int,
    range: IntRange,
    label: String? = null,
    enabled: Boolean = true,
    onChange: (Int) -> Unit,
) {
    var dragging by remember(value) { mutableStateOf(value.toFloat()) }
    Column(Modifier.padding(horizontal = 20.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(text, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.W500)
            if (label != null) Text(label, style = MaterialTheme.typography.bodyMedium, color = secondaryColor())
        }
        Slider(
            value = dragging,
            onValueChange = { dragging = it },
            onValueChangeFinished = { onChange(dragging.toInt().coerceIn(range)) },
            valueRange = range.first.toFloat()..range.last.toFloat(),
            steps = (range.last - range.first - 1).coerceAtLeast(0),
            enabled = enabled,
        )
    }
}

/** A radio row with the button on the right, the official `SettingsRadioListTile`. */
@Composable
internal fun RadioTile(title: String, selected: Boolean, onClick: () -> Unit) {
    ListItem(
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
        headlineContent = { Text(title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.W500) },
        trailingContent = { RadioButton(selected, onClick = null) },
        modifier = Modifier.clickable(onClick = onClick).padding(start = 4.dp),
    )
}

/** A row that opens something: title, a status chip, an explanation and an arrow (`SettingsActionTile`). */
@Composable
internal fun ActionTile(
    title: String,
    subtitle: String,
    statusText: String? = null,
    statusColor: Color? = null,
    onClick: () -> Unit,
) {
    ListItem(
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
        headlineContent = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.W500, modifier = Modifier.weight(1f))
                if (statusText != null) {
                    val color = statusColor ?: MaterialTheme.colorScheme.onSurfaceVariant
                    Surface(
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.surface,
                        border = BorderStroke(1.dp, statusColor ?: MaterialTheme.colorScheme.outlineVariant),
                        modifier = Modifier.padding(start = 8.dp),
                    ) {
                        Text(
                            statusText,
                            style = MaterialTheme.typography.labelMedium,
                            color = color,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 2.dp),
                        )
                    }
                }
            }
        },
        supportingContent = { Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = secondaryColor()) },
        trailingContent = {
            Icon(Icons.AutoMirrored.Filled.ArrowForwardIos, null, Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        },
        modifier = Modifier.clickable(onClick = onClick).padding(start = 4.dp),
    )
}

/** An icon, a title, an explanation and a button (`SettingsButtonListTile`). */
@Composable
internal fun ButtonTile(icon: ImageVector, title: String, subtitle: String?, buttonText: String, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp)) {
        Icon(icon, null, Modifier.padding(top = 2.dp))
        Column(Modifier.padding(start = 20.dp)) {
            Text(title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.W500)
            if (subtitle != null) {
                Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = secondaryColor(), modifier = Modifier.padding(top = 4.dp))
            }
            Button(onClick, Modifier.padding(top = 6.dp)) { Text(buttonText) }
        }
    }
}

/** A small dialog with one text field, for addresses and names. */
@Composable
internal fun TextDialog(title: String, initial: String, label: String, onDismiss: () -> Unit, onSave: (String) -> Unit) {
    var text by remember { mutableStateOf(initial) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            OutlinedTextField(
                value = text,
                onValueChange = { text = it },
                label = { Text(label) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        },
        confirmButton = { TextButton({ onSave(text.trim()) }) { Text("Save") } },
        dismissButton = { TextButton(onDismiss) { Text("Cancel") } },
    )
}
