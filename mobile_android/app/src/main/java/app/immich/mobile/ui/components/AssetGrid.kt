package app.immich.mobile.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyGridState
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import app.immich.mobile.app
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import app.immich.mobile.data.AssetItem
import app.immich.mobile.data.AssetSource
import app.immich.mobile.data.PagedSource
import app.immich.mobile.data.TimelineSource
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt

/** The state of a multi-select, shared by the grid and the screen's top bar. */
class Selection {
    val items = mutableMapOf<String, AssetItem>()
    var version by mutableStateOf(0)
        private set

    val active get() = version >= 0 && items.isNotEmpty()
    val count get() = version.let { items.size }

    fun contains(id: String): Boolean {
        version // observe
        return id in items
    }

    fun toggle(item: AssetItem) {
        if (items.remove(item.id) == null) items[item.id] = item
        version++
    }

    fun add(item: AssetItem) {
        items[item.id] = item
        version++
    }

    fun clear() {
        items.clear()
        version++
    }
}

@Composable
fun rememberColumns(): Int = LocalContext.current.app.prefs.tilesPerRow.coerceIn(2, 6)

/** One row of the timeline: a heading, or a thumbnail of the [index]th asset of a bucket. */
private sealed interface TimelineEntry {
    /** The month the entry belongs to, for the scrubber label. */
    val month: String

    /** A month heading, or a day heading when [isMonth] is false: [from] until [to] are the day's assets in [bucket]. */
    data class Heading(
        val key: String,
        val label: String,
        override val month: String,
        val isMonth: Boolean = true,
        val bucket: Int = -1,
        val from: Int = 0,
        val to: Int = 0,
    ) : TimelineEntry

    data class Cell(val bucket: Int, val index: Int, override val month: String) : TimelineEntry
}

// like the official app: a day is "Mon, Nov 2, 2026", a month heading is "November" (with the year for other years)
private val dayFormat = DateTimeFormatter.ofPattern("EEE, MMM d, yyyy", Locale.getDefault())
private val monthOnlyFormat = DateTimeFormatter.ofPattern("MMMM", Locale.getDefault())

private fun dayOf(item: AssetItem): LocalDate? = try {
    val zone = ZoneId.systemDefault()
    val created = item.createdAt
    if (item.isLocal || created == null) {
        Instant.ofEpochMilli(item.takenMillis).atZone(zone).toLocalDate()
    } else {
        try {
            OffsetDateTime.parse(created).atZoneSameInstant(zone).toLocalDate()
        } catch (_: Exception) {
            // some timestamps come without an offset, they already are the local time of the photo
            LocalDate.parse(created.take(10))
        }
    }
} catch (e: Exception) {
    null
}

/**
 * The rows of the grid. Grouped by month there is one heading per month. Grouped by day, every month whose assets are
 * loaded is split in one heading per day; a month that is still loading keeps its month heading.
 */
private fun timelineEntries(source: TimelineSource, byDay: Boolean): List<TimelineEntry> {
    val entries = ArrayList<TimelineEntry>(source.size + source.buckets.size)
    val thisYear = LocalDate.now().year
    source.buckets.forEachIndexed { b, bucket ->
        val month = bucketLabel(bucket.timeBucket)
        val assets = bucket.assets
        if (!byDay || assets == null) {
            entries += TimelineEntry.Heading("month-${bucket.timeBucket}", month, month)
            for (i in 0 until bucket.size) entries += TimelineEntry.Cell(b, i, month)
        } else {
            val monthDate = runCatching { LocalDate.parse(bucket.timeBucket.take(10)) }.getOrNull()
            val monthLabel = if (monthDate != null && monthDate.year == thisYear) monthDate.format(monthOnlyFormat) else month
            entries += TimelineEntry.Heading("month-${bucket.timeBucket}", monthLabel, month)
            var start = 0
            while (start < assets.size) {
                val day = dayOf(assets[start])
                var end = start + 1
                while (end < assets.size && dayOf(assets[end]) == day) end++
                entries += TimelineEntry.Heading(
                    "day-${bucket.timeBucket}-$day-$start", day?.format(dayFormat) ?: month, month,
                    isMonth = false, bucket = b, from = start, to = end,
                )
                for (i in start until end) entries += TimelineEntry.Cell(b, i, month)
                start = end
            }
        }
    }
    return entries
}

/**
 * The grid of the whole library: a heading per month or per day (Settings > Photo Grid) followed by the thumbnails.
 */
@Composable
fun TimelineGrid(
    source: TimelineSource,
    selection: Selection,
    onOpen: (position: Int) -> Unit,
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(),
    header: (@Composable () -> Unit)? = null,
) {
    val prefs = LocalContext.current.app.prefs
    val state = rememberLazyGridState()
    val columns = rememberColumns()
    val headerCount = if (header != null) 1 else 0
    val byDay = prefs.groupByDay
    val entries = remember(source.buckets, byDay) { timelineEntries(source, byDay) }

    // where the first row of every month is, so the scrubber can snap to months
    val monthStart = remember(entries) {
        val starts = IntArray(entries.size)
        var start = 0
        entries.forEachIndexed { i, entry ->
            if (i == 0 || entry.month != entries[i - 1].month) start = i
            starts[i] = start
        }
        starts
    }

    Box(modifier) {
        LazyVerticalGrid(
            state = state,
            columns = GridCells.Fixed(columns),
            contentPadding = contentPadding,
            horizontalArrangement = Arrangement.spacedBy(2.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
            modifier = Modifier.fillMaxSize(),
        ) {
            if (header != null) {
                item(key = "header", span = { GridItemSpan(maxLineSpan) }, contentType = "extra") { header() }
            }
            items(
                count = entries.size,
                key = { i ->
                    when (val entry = entries[i]) {
                        is TimelineEntry.Heading -> entry.key
                        is TimelineEntry.Cell -> {
                            val bucket = source.buckets.getOrNull(entry.bucket)
                            bucket?.assets?.getOrNull(entry.index)?.id ?: "${bucket?.timeBucket}#${entry.index}"
                        }
                    }
                },
                span = { i -> if (entries[i] is TimelineEntry.Heading) GridItemSpan(maxLineSpan) else GridItemSpan(1) },
                contentType = { i -> if (entries[i] is TimelineEntry.Heading) "heading" else "asset" },
            ) { i ->
                when (val entry = entries[i]) {
                    is TimelineEntry.Heading -> if (entry.isMonth) {
                        Text(
                            entry.label,
                            style = MaterialTheme.typography.headlineMedium,
                            modifier = Modifier.padding(start = 12.dp, top = 24.dp, bottom = 4.dp, end = 12.dp),
                        )
                    } else {
                        DayHeading(entry, source, selection)
                    }

                    is TimelineEntry.Cell -> {
                        val bucket = source.buckets.getOrNull(entry.bucket)
                        val item = bucket?.assets?.getOrNull(entry.index)
                        if (item == null) LaunchedEffect(bucket?.timeBucket) { source.loadBucket(entry.bucket) }
                        ThumbCell(item, selection, onOpen = { onOpen(source.offsetOf(entry.bucket) + entry.index) })
                    }
                }
            }
        }

        Scrubber(
            state = state,
            totalItems = entries.size + headerCount,
            labelFor = { gridItem -> entries.getOrNull(gridItem - headerCount)?.month },
            // without smooth scrubbing the handle jumps from month to month
            snapTo = if (prefs.smoothScrubbing) null else { gridItem ->
                val index = (gridItem - headerCount).coerceIn(0, (entries.size - 1).coerceAtLeast(0))
                if (entries.isEmpty()) gridItem else monthStart[index] + headerCount
            },
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .padding(contentPadding),
        )
    }
}

/** A plain grid for search results and other lists without time buckets. */
@Composable
fun FlatGrid(
    source: AssetSource,
    selection: Selection,
    onOpen: (position: Int) -> Unit,
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(),
    header: (@Composable () -> Unit)? = null,
) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(rememberColumns()),
        contentPadding = contentPadding,
        horizontalArrangement = Arrangement.spacedBy(2.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
        modifier = modifier.fillMaxSize(),
    ) {
        if (header != null) {
            item(key = "header", span = { GridItemSpan(maxLineSpan) }, contentType = "extra") { header() }
        }
        items(
            count = source.size,
            key = { i -> source.itemAt(i)?.id ?: "#$i" },
        ) { i ->
            if (source is PagedSource) LaunchedEffect(i, source.size) { source.loadMoreNear(i) }
            ThumbCell(source.itemAt(i), selection, onOpen = { onOpen(i) })
        }
    }
}

/** A day label with a check-circle at the right that selects (or clears) every asset of the day. */
@Composable
private fun DayHeading(entry: TimelineEntry.Heading, source: TimelineSource, selection: Selection) {
    val items = source.buckets.getOrNull(entry.bucket)?.assets?.let { it.subList(entry.from.coerceAtMost(it.size), entry.to.coerceAtMost(it.size)) }.orEmpty()
    val allSelected = items.isNotEmpty() && items.all { selection.contains(it.id) }
    Row(
        Modifier.fillMaxWidth().padding(start = 12.dp, top = 12.dp, bottom = 2.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(entry.label, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
        IconButton({
            if (allSelected) items.forEach { selection.toggle(it) } else items.filter { !selection.contains(it.id) }.forEach { selection.add(it) }
        }) {
            Icon(
                if (allSelected) Icons.Filled.CheckCircle else Icons.Outlined.CheckCircle,
                if (allSelected) "Deselect day" else "Select day",
                tint = if (allSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun ThumbCell(item: AssetItem?, selection: Selection, onOpen: () -> Unit) {
    val selected = item != null && selection.contains(item.id)
    AssetThumb(
        item = item,
        modifier = Modifier.fillMaxWidth().aspectRatio(1f),
        selecting = selection.active,
        selected = selected,
        onClick = {
            if (item == null) return@AssetThumb
            if (selection.active) selection.toggle(item) else onOpen()
        },
        onLongClick = { if (item != null) selection.add(item) },
    )
}



/** A draggable handle on the right edge that jumps through the grid and names the month it points at. */
@Composable
private fun Scrubber(
    state: LazyGridState,
    totalItems: Int,
    labelFor: (Int) -> String?,
    snapTo: ((Int) -> Int)? = null,
    modifier: Modifier = Modifier,
) {
    if (totalItems < 60) return
    val scope = rememberCoroutineScope()
    val density = LocalDensity.current
    var trackHeight by remember { mutableFloatStateOf(0f) }
    var dragging by remember { mutableStateOf(false) }
    var dragFraction by remember { mutableFloatStateOf(0f) }
    val handleHeight = with(density) { 48.dp.toPx() }

    val scrolledFraction by remember {
        derivedStateOf { (state.firstVisibleItemIndex.toFloat() / totalItems.coerceAtLeast(1)).coerceIn(0f, 1f) }
    }
    val fraction = if (dragging) dragFraction else scrolledFraction
    val travel = (trackHeight - handleHeight).coerceAtLeast(0f)

    Box(
        modifier
            .fillMaxHeight()
            .width(36.dp)
            .onSizeChanged { trackHeight = it.height.toFloat() }
            .pointerInput(totalItems) {
                detectVerticalDragGestures(
                    onDragStart = { offset ->
                        dragging = true
                        dragFraction = ((offset.y - handleHeight / 2) / travel.coerceAtLeast(1f)).coerceIn(0f, 1f)
                    },
                    onDragEnd = { dragging = false },
                    onDragCancel = { dragging = false },
                ) { change, _ ->
                    change.consume()
                    dragFraction = ((change.position.y - handleHeight / 2) / travel.coerceAtLeast(1f)).coerceIn(0f, 1f)
                    val raw = (dragFraction * (totalItems - 1)).roundToInt()
                    val target = snapTo?.invoke(raw) ?: raw
                    scope.launch { state.scrollToItem(target) }
                }
            },
    ) {
        val label = if (dragging) labelFor((dragFraction * (totalItems - 1)).roundToInt()) else null
        Box(
            Modifier
                .align(Alignment.TopEnd)
                .offset { IntOffset(0, (fraction * travel).roundToInt()) }
                .padding(end = 2.dp)
                .size(width = 6.dp, height = 48.dp)
                .background(
                    MaterialTheme.colorScheme.primary.copy(alpha = if (dragging) 1f else 0.5f),
                    RoundedCornerShape(3.dp),
                ),
        )
        if (label != null) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = MaterialTheme.colorScheme.primaryContainer,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .offset { IntOffset(-with(density) { 20.dp.roundToPx() }, (fraction * travel).roundToInt()) },
            ) {
                Text(label, Modifier.padding(horizontal = 14.dp, vertical = 8.dp), style = MaterialTheme.typography.labelLarge)
            }
        }
    }
}
