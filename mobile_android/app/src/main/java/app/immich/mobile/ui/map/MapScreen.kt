package app.immich.mobile.ui.map

import android.graphics.PointF
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.luminance
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.material3.MaterialTheme
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import app.immich.mobile.app
import app.immich.mobile.data.MapMarker
import app.immich.mobile.data.mapMarkers
import app.immich.mobile.ui.components.CenterLoading
import app.immich.mobile.ui.components.CenterMessage
import coil3.compose.AsyncImage
import org.maplibre.android.MapLibre
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.geometry.LatLngBounds
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import org.maplibre.android.style.expressions.Expression
import org.maplibre.android.style.layers.CircleLayer
import org.maplibre.android.style.layers.PropertyFactory
import org.maplibre.android.style.sources.GeoJsonOptions
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.geojson.Feature
import org.maplibre.geojson.FeatureCollection
import org.maplibre.geojson.Point

private const val SOURCE = "photos"
private const val CLUSTERS = "photo-clusters"
private const val POINTS = "photo-points"
private const val MAX_SHEET = 300

/** All geotagged photos on a map. Nearby ones are grouped, tap a group to zoom in and a dot to open the photo. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MapScreen(
    onBack: () -> Unit,
    onOpenAssets: (ids: List<String>, index: Int) -> Unit,
) {
    val context = LocalContext.current
    val app = context.app
    val dark = MaterialTheme.colorScheme.surface.luminance() < 0.5f
    var markers by remember { mutableStateOf<List<MapMarker>?>(null) }
    var styleUrl by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var inView by remember { mutableStateOf<List<MapMarker>>(emptyList()) }
    var sheet by remember { mutableStateOf(false) }

    LaunchedEffect(dark) {
        try {
            val config = app.api.config()
            val url = if (dark) config.mapDarkStyleUrl else config.mapLightStyleUrl
            if (url.isBlank()) error = "The server does not offer a map style" else styleUrl = url
            markers = app.api.mapMarkers()
        } catch (e: Exception) {
            error = e.message ?: "Unable to load the map"
        }
    }

    Box(Modifier.fillMaxSize()) {
        val list = markers
        val style = styleUrl
        when {
            error != null && (list == null || style == null) -> CenterMessage("Map unavailable", detail = error)
            list == null || style == null -> CenterLoading()
            else -> {
                MarkerMap(
                    markers = list,
                    styleUrl = style,
                    primary = MaterialTheme.colorScheme.primary.toArgb(),
                    onViewChanged = { inView = it },
                    onOpenAsset = { onOpenAssets(listOf(it), 0) },
                )
                if (inView.isNotEmpty()) {
                    ExtendedFloatingActionButton(
                        onClick = { sheet = true },
                        icon = { Icon(Icons.Filled.PhotoLibrary, null) },
                        text = { Text("${inView.size} photos in view") },
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .navigationBarsPadding()
                            .padding(16.dp),
                    )
                }
            }
        }
        FilledIconButton(
            onClick = onBack,
            modifier = Modifier
                .align(Alignment.TopStart)
                .statusBarsPadding()
                .padding(12.dp),
        ) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
    }

    if (sheet) {
        val shown = inView.take(MAX_SHEET)
        ModalBottomSheet(onDismissRequest = { sheet = false }) {
            val api = app.api
            LazyVerticalGrid(
                columns = GridCells.Fixed(4),
                contentPadding = PaddingValues(4.dp),
                horizontalArrangement = Arrangement.spacedBy(2.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                items(shown.size, key = { shown[it].id }) { i ->
                    AsyncImage(
                        model = api.thumbnailUrl(shown[i].id),
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .aspectRatio(1f)
                            .clickable {
                                sheet = false
                                onOpenAssets(shown.map { it.id }, i)
                            },
                    )
                }
            }
        }
    }
}

/** A MapView that follows the lifecycle of the screen it is in. */
@Composable
internal fun rememberMapViewWithLifecycle(): MapView {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val mapView = remember {
        MapLibre.getInstance(context)
        MapView(context).also { it.onCreate(null) }
    }

    DisposableEffect(lifecycle, mapView) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_START -> mapView.onStart()
                Lifecycle.Event.ON_RESUME -> mapView.onResume()
                Lifecycle.Event.ON_PAUSE -> mapView.onPause()
                Lifecycle.Event.ON_STOP -> mapView.onStop()
                else -> Unit
            }
        }
        lifecycle.addObserver(observer)
        // the view is created while the screen is already started
        if (lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) mapView.onStart()
        if (lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) mapView.onResume()
        onDispose {
            lifecycle.removeObserver(observer)
            mapView.onPause()
            mapView.onStop()
            mapView.onDestroy()
        }
    }
    return mapView
}

/**
 * The map on the "Places" card of the Library: the server's map style, centred on where the photos were taken, with no
 * gestures (a tap on the card opens the places list).
 */
@Composable
fun PlacesMapPreview(modifier: Modifier = Modifier) {
    val app = LocalContext.current.app
    val dark = MaterialTheme.colorScheme.surface.luminance() < 0.5f
    var styleUrl by remember { mutableStateOf<String?>(null) }
    var center by remember { mutableStateOf<Pair<Double, Double>?>(null) }
    LaunchedEffect(dark) {
        runCatching {
            val config = app.api.config()
            styleUrl = (if (dark) config.mapDarkStyleUrl else config.mapLightStyleUrl).takeIf { it.isNotBlank() }
            val markers = app.api.mapMarkers()
            if (markers.isNotEmpty()) center = markers.map { it.lat }.average() to markers.map { it.lon }.average()
        }
    }
    val url = styleUrl ?: return
    val mapView = rememberMapViewWithLifecycle()
    var loadedStyle by remember { mutableStateOf<String?>(null) }
    AndroidView(
        factory = { mapView },
        modifier = modifier,
        update = { view ->
            if (loadedStyle == url) return@AndroidView
            loadedStyle = url
            view.getMapAsync { map ->
                map.uiSettings.setAllGesturesEnabled(false)
                map.uiSettings.isAttributionEnabled = false
                map.uiSettings.isLogoEnabled = false
                center?.let { (lat, lon) ->
                    map.cameraPosition = org.maplibre.android.camera.CameraPosition.Builder()
                        .target(org.maplibre.android.geometry.LatLng(lat, lon)).zoom(6.0).build()
                }
                map.setStyle(Style.Builder().fromUri(url))
            }
        },
    )
}

@Composable
private fun MarkerMap(
    markers: List<MapMarker>,
    styleUrl: String,
    primary: Int,
    onViewChanged: (List<MapMarker>) -> Unit,
    onOpenAsset: (String) -> Unit,
) {
    val mapView = rememberMapViewWithLifecycle()

    var loadedStyle by remember { mutableStateOf<String?>(null) }

    AndroidView(
        factory = { mapView },
        modifier = Modifier.fillMaxSize(),
        update = { view ->
            if (loadedStyle == styleUrl) return@AndroidView
            loadedStyle = styleUrl
            view.getMapAsync { map ->
                map.setStyle(Style.Builder().fromUri(styleUrl)) { style ->
                    installLayers(style, markers, primary)
                    bindMap(map, markers, onViewChanged, onOpenAsset)
                }
            }
        },
    )
}

private fun installLayers(style: Style, markers: List<MapMarker>, primary: Int) {
    val features = markers.map {
        Feature.fromGeometry(Point.fromLngLat(it.lon, it.lat)).also { f -> f.addStringProperty("id", it.id) }
    }
    style.addSource(
        GeoJsonSource(
            SOURCE,
            FeatureCollection.fromFeatures(features),
            GeoJsonOptions().withCluster(true).withClusterRadius(48).withClusterMaxZoom(14),
        ),
    )
    style.addLayer(
        CircleLayer(CLUSTERS, SOURCE).withFilter(Expression.has("point_count")).withProperties(
            PropertyFactory.circleColor(primary),
            PropertyFactory.circleOpacity(0.85f),
            PropertyFactory.circleStrokeColor(android.graphics.Color.WHITE),
            PropertyFactory.circleStrokeWidth(2f),
            PropertyFactory.circleRadius(
                Expression.step(
                    Expression.get("point_count"),
                    Expression.literal(14),
                    Expression.stop(10, 18),
                    Expression.stop(100, 24),
                    Expression.stop(1000, 30),
                ),
            ),
        ),
    )
    style.addLayer(
        CircleLayer(POINTS, SOURCE).withFilter(Expression.not(Expression.has("point_count"))).withProperties(
            PropertyFactory.circleColor(primary),
            PropertyFactory.circleRadius(8f),
            PropertyFactory.circleStrokeColor(android.graphics.Color.WHITE),
            PropertyFactory.circleStrokeWidth(2f),
        ),
    )
}

private fun bindMap(
    map: MapLibreMap,
    markers: List<MapMarker>,
    onViewChanged: (List<MapMarker>) -> Unit,
    onOpenAsset: (String) -> Unit,
) {
    if (markers.isNotEmpty()) {
        val builder = LatLngBounds.Builder()
        markers.forEach { builder.include(LatLng(it.lat, it.lon)) }
        runCatching { map.moveCamera(CameraUpdateFactory.newLatLngBounds(builder.build(), 80)) }
    }

    fun report() {
        val bounds = map.projection.visibleRegion.latLngBounds
        onViewChanged(markers.filter { bounds.contains(LatLng(it.lat, it.lon)) })
    }
    map.addOnCameraIdleListener { report() }
    report()

    map.addOnMapClickListener { point ->
        val screen: PointF = map.projection.toScreenLocation(point)
        val hit = map.queryRenderedFeatures(screen, CLUSTERS, POINTS).firstOrNull() ?: return@addOnMapClickListener false
        if (hit.hasProperty("point_count")) {
            map.animateCamera(CameraUpdateFactory.newLatLngZoom(point, map.cameraPosition.zoom + 2.5))
        } else {
            hit.getStringProperty("id")?.let(onOpenAsset)
        }
        true
    }
}
