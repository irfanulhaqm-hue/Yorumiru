package com.yorumiru.app

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONArray
import org.json.JSONObject

data class Anime(
    val id: Long,
    val title: String,
    val seasons: List<Season>
) {
    val totalEpisodes get() = seasons.sumOf { it.episodes.size }
    val watchedEpisodes get() = seasons.sumOf { it.episodes.count { ep -> ep.watched } }
    val progress get() = if (totalEpisodes == 0) 0f else watchedEpisodes.toFloat() / totalEpisodes
}

data class Season(
    val number: Int,
    val episodes: List<Episode>
)

data class Episode(
    val number: Int,
    val watched: Boolean = false
)

class WatchStore(private val context: Context) {
    private val prefs = context.getSharedPreferences("yorumiru", Context.MODE_PRIVATE)

    fun load(): List<Anime> {
        val raw = prefs.getString("anime", "[]") ?: "[]"
        val arr = JSONArray(raw)
        return buildList {
            for (i in 0 until arr.length()) {
                val a = arr.getJSONObject(i)
                val seasonsArr = a.getJSONArray("seasons")
                val seasons = buildList {
                    for (s in 0 until seasonsArr.length()) {
                        val so = seasonsArr.getJSONObject(s)
                        val epsArr = so.getJSONArray("episodes")
                        val eps = buildList {
                            for (e in 0 until epsArr.length()) {
                                val eo = epsArr.getJSONObject(e)
                                add(Episode(eo.getInt("number"), eo.getBoolean("watched")))
                            }
                        }
                        add(Season(so.getInt("number"), eps))
                    }
                }
                add(Anime(a.getLong("id"), a.getString("title"), seasons))
            }
        }
    }

    fun save(items: List<Anime>) {
        val arr = JSONArray()
        items.forEach { anime ->
            val ao = JSONObject().put("id", anime.id).put("title", anime.title)
            val sa = JSONArray()
            anime.seasons.forEach { season ->
                val so = JSONObject().put("number", season.number)
                val ea = JSONArray()
                season.episodes.forEach { ep ->
                    ea.put(JSONObject().put("number", ep.number).put("watched", ep.watched))
                }
                so.put("episodes", ea)
                sa.put(so)
            }
            ao.put("seasons", sa)
            arr.put(ao)
        }
        prefs.edit().putString("anime", arr.toString()).apply()
    }
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { YorumiruApp(WatchStore(this)) }
    }
}

@Composable
fun YorumiruApp(store: WatchStore) {
    var anime by remember { mutableStateOf(store.load()) }
    var selected by remember { mutableStateOf<Anime?>(null) }
    var showAdd by remember { mutableStateOf(false) }

    val bg = Color(0xFF09090D)
    val surface = Color(0xFF14141B)
    val accent = Color(0xFFB56CFF)

    MaterialTheme(
        colorScheme = darkColorScheme(
            background = bg,
            surface = surface,
            primary = accent,
            secondary = Color(0xFF65D9FF)
        )
    ) {
        Surface(Modifier.fillMaxSize(), color = bg) {
            when {
                selected != null -> {
                    EpisodeScreen(
                        anime = anime.first { it.id == selected!!.id },
                        onBack = { selected = null },
                        onChange = { changed ->
                            anime = anime.map { if (it.id == changed.id) changed else it }
                            store.save(anime)
                        }
                    )
                }
                else -> {
                    HomeScreen(
                        anime = anime,
                        onOpen = { selected = it },
                        onAdd = { showAdd = true },
                        accent = accent
                    )
                }
            }

            if (showAdd) {
                AddAnimeDialog(
                    onDismiss = { showAdd = false },
                    onAdd = { title, seasonCount, episodesPerSeason ->
                        val seasons = (1..seasonCount).map { s ->
                            Season(s, (1..episodesPerSeason[s - 1]).map { Episode(it) })
                        }
                        val newAnime = Anime(
                            System.currentTimeMillis(),
                            title.trim(),
                            seasons
                        )
                        anime = anime + newAnime
                        store.save(anime)
                        showAdd = false
                    }
                )
            }
        }
    }
}

@Composable
fun HomeScreen(
    anime: List<Anime>,
    onOpen: (Anime) -> Unit,
    onAdd: () -> Unit,
    accent: Color
) {
    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(start = 20.dp, end = 16.dp, top = 22.dp, bottom = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text("YOROMIRU", fontSize = 26.sp, fontWeight = FontWeight.Black, letterSpacing = 3.sp)
                Text("YOUR ANIME JOURNAL", color = Color.Gray, fontSize = 10.sp, letterSpacing = 2.sp)
            }
            IconButton(onClick = onAdd) {
                Icon(Icons.Default.Add, contentDescription = "Add anime", tint = accent)
            }
        }

        if (anime.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Nothing here yet", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(8.dp))
                    Text("Add the anime you want to track.", color = Color.Gray)
                    Spacer(Modifier.height(18.dp))
                    Button(onClick = onAdd) { Text("Add your first anime") }
                }
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(anime, key = { it.id }) { item ->
                    AnimeCard(item, onOpen)
                }
            }
        }
    }
}

@Composable
fun AnimeCard(anime: Anime, onOpen: (Anime) -> Unit) {
    val gradient = Brush.linearGradient(
        listOf(Color(0xFF201A31), Color(0xFF15151D))
    )
    Card(
        Modifier.fillMaxWidth().clickable { onOpen(anime) },
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent)
    ) {
        Row(
            Modifier.background(gradient).padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                Modifier.size(78.dp, 104.dp).clip(RoundedCornerShape(12.dp))
                    .background(Brush.verticalGradient(listOf(Color(0xFF6D3FA8), Color(0xFF24203A)))),
                contentAlignment = Alignment.Center
            ) {
                Text("✦", fontSize = 34.sp, color = Color.White)
            }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(anime.title, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(5.dp))
                Text(
                    "${anime.seasons.size} season${if (anime.seasons.size == 1) "" else "s"}  •  ${anime.watchedEpisodes}/${anime.totalEpisodes} episodes",
                    color = Color.Gray,
                    fontSize = 12.sp
                )
                Spacer(Modifier.height(12.dp))
                LinearProgressIndicator(
                    progress = { anime.progress },
                    Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(10.dp)),
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    if (anime.progress >= 1f) "COMPLETED" else if (anime.watchedEpisodes > 0) "WATCHING" else "PLANNED",
                    color = if (anime.progress >= 1f) Color(0xFF7FE6A1) else Color(0xFFB56CFF),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )
            }
            Icon(Icons.Default.ChevronRight, contentDescription = null, tint = Color.Gray)
        }
    }
}

@Composable
fun EpisodeScreen(anime: Anime, onBack: () -> Unit, onChange: (Anime) -> Unit) {
    var seasonIndex by remember { mutableIntStateOf(0) }
    val season = anime.seasons.getOrNull(seasonIndex) ?: return

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextButton(onClick = onBack) { Text("‹  BACK") }
            Text(anime.title, Modifier.weight(1f), fontSize = 19.sp, fontWeight = FontWeight.Bold)
        }

        ScrollableTabRow(
            selectedTabIndex = seasonIndex,
            edgePadding = 12.dp,
            containerColor = Color.Transparent
        ) {
            anime.seasons.forEachIndexed { index, s ->
                Tab(
                    selected = index == seasonIndex,
                    onClick = { seasonIndex = index },
                    text = { Text("Season ${s.number}") }
                )
            }
        }

        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text("Season ${season.number}", fontSize = 22.sp, fontWeight = FontWeight.Bold)
                Text("${season.episodes.count { it.watched }}/${season.episodes.size} watched", color = Color.Gray)
            }
            OutlinedButton(onClick = {
                val allWatched = season.episodes.all { it.watched }
                val updated = anime.copy(
                    seasons = anime.seasons.mapIndexed { i, old ->
                        if (i == seasonIndex) old.copy(episodes = old.episodes.map { it.copy(watched = !allWatched) }) else old
                    }
                )
                onChange(updated)
            }) {
                Text(if (season.episodes.all { it.watched }) "Unwatch all" else "Mark all")
            }
        }

        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(season.episodes, key = { it.number }) { ep ->
                EpisodeRow(ep) {
                    val updated = anime.copy(
                        seasons = anime.seasons.mapIndexed { i, old ->
                            if (i == seasonIndex) old.copy(
                                episodes = old.episodes.map {
                                    if (it.number == ep.number) it.copy(watched = !it.watched) else it
                                }
                            ) else old
                        }
                    )
                    onChange(updated)
                }
            }
        }
    }
}

@Composable
fun EpisodeRow(ep: Episode, onClick: () -> Unit) {
    Card(
        Modifier.fillMaxWidth().clickable { onClick() },
        colors = CardDefaults.cardColors(
            containerColor = if (ep.watched) Color(0xFF171F1B) else Color(0xFF14141B)
        ),
        shape = RoundedCornerShape(14.dp)
    ) {
        Row(
            Modifier.padding(horizontal = 16.dp, vertical = 13.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                Modifier.size(38.dp).clip(RoundedCornerShape(10.dp))
                    .background(if (ep.watched) Color(0xFF31583E) else Color(0xFF24242D)),
                contentAlignment = Alignment.Center
            ) {
                if (ep.watched) Icon(Icons.Default.Check, contentDescription = null)
                else Text(ep.number.toString(), fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.width(14.dp))
            Text("Episode ${ep.number}", Modifier.weight(1f), fontSize = 16.sp)
            if (!ep.watched) Icon(Icons.Default.PlayArrow, contentDescription = null, tint = Color.Gray)
        }
    }
}

@Composable
fun AddAnimeDialog(
    onDismiss: () -> Unit,
    onAdd: (String, Int, List<Int>) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var seasonCount by remember { mutableIntStateOf(1) }
    var episodeCounts by remember { mutableStateOf(listOf(12)) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add anime") },
        text = {
            Column {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Anime title") },
                    singleLine = true
                )
                Spacer(Modifier.height(14.dp))
                Text("Seasons", fontWeight = FontWeight.Bold)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = {
                        if (seasonCount > 1) {
                            seasonCount--
                            episodeCounts = episodeCounts.dropLast(1)
                        }
                    }) { Icon(Icons.Default.Remove, null) }
                    Text(seasonCount.toString(), Modifier.width(30.dp))
                    IconButton(onClick = {
                        if (seasonCount < 10) {
                            seasonCount++
                            episodeCounts = episodeCounts + 12
                        }
                    }) { Icon(Icons.Default.Add, null) }
                }
                episodeCounts.forEachIndexed { i, count ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Season ${i + 1}", Modifier.weight(1f))
                        OutlinedTextField(
                            value = count.toString(),
                            onValueChange = { value ->
                                value.toIntOrNull()?.let { n ->
                                    if (n in 1..999) {
                                        episodeCounts = episodeCounts.toMutableList().also { it[i] = n }
                                    }
                                }
                            },
                            modifier = Modifier.width(90.dp),
                            singleLine = true
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                enabled = title.isNotBlank(),
                onClick = { onAdd(title, seasonCount, episodeCounts) }
            ) { Text("Add") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}
