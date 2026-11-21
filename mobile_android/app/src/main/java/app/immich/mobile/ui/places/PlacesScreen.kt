package app.immich.mobile.ui.places

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.immich.mobile.app
import app.immich.mobile.data.AssetDto
import app.immich.mobile.data.cities
import app.immich.mobile.ui.components.CenterLoading
import app.immich.mobile.ui.components.CenterMessage
import coil3.compose.AsyncImage

/** One card for every city the photos were taken in, with the city's name over a photo from there. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlacesScreen(onBack: () -> Unit, onOpenPlace: (String) -> Unit) {
    val api = LocalContext.current.app.api
    var places by remember { mutableStateOf<List<AssetDto>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        try {
            places = api.cities()
                .filter { !it.exifInfo?.city.isNullOrBlank() }
                .sortedBy { it.exifInfo?.city?.lowercase() }
        } catch (e: Exception) {
            error = e.message ?: "Unable to load places"
        }
    }

    Scaffold(
        contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0),
        topBar = {
            TopAppBar(
                title = { Text("Places") },
                navigationIcon = { IconButton(onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
            )
        },
    ) { padding ->
        val list = places
        Box(
            Modifier
                .padding(padding)
                .fillMaxSize(),
        ) {
            when {
                list == null && error == null -> CenterLoading()
                list == null -> CenterMessage("Unable to load places", detail = error)
                list.isEmpty() -> CenterMessage("No places yet", detail = "Photos with a location show up here")
                else -> LazyVerticalGrid(
                    columns = GridCells.Fixed(2),
                    contentPadding = PaddingValues(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    items(list, key = { it.id }) { asset ->
                        val city = asset.exifInfo?.city.orEmpty()
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .aspectRatio(1.3f)
                                .clip(RoundedCornerShape(14.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant)
                                .clickable { onOpenPlace(city) },
                        ) {
                            AsyncImage(
                                model = api.thumbnailUrl(asset.id, asset.thumbhash),
                                contentDescription = null,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize(),
                            )
                            Box(
                                Modifier
                                    .fillMaxSize()
                                    .background(Brush.verticalGradient(listOf(Color.Transparent, Color(0xAA000000)))),
                            )
                            Text(
                                city,
                                color = Color.White,
                                style = MaterialTheme.typography.titleSmall,
                                modifier = Modifier
                                    .align(Alignment.BottomStart)
                                    .padding(12.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}
