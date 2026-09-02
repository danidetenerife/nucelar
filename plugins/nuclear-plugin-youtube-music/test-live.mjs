import { YtMusicClient } from './src/client.ts';

const query = process.argv.slice(2).join(' ') || 'Daft Punk Get Lucky';

async function main() {
  console.log(`\n🎵 Probando búsqueda en YouTube Music para: "${query}"...\n`);
  const client = new YtMusicClient(fetch);

  console.log('--- 1. CANCIONES (Audio Oficial de Estudio) ---');
  const songs = await client.searchSongs(query, 5);
  for (const song of songs) {
    const mins = song.durationMs ? `${Math.floor(song.durationMs / 60000)}:${String(Math.floor((song.durationMs % 60000) / 1000)).padStart(2, '0')}` : 'N/A';
    console.log(`▶ [${song.id}] ${song.artists.join(', ')} - ${song.title} (${mins}) | Álbum: ${song.album || 'N/A'}`);
  }

  console.log('\n--- 2. ÁLBUMES ---');
  const albums = await client.searchAlbums(query, 3);
  for (const album of albums) {
    console.log(`💽 [${album.id}] ${album.title} (${album.year || 'N/A'}) - ${album.artists.join(', ')}`);
  }

  console.log('\n--- 3. ARTISTAS ---');
  const artists = await client.searchArtists(query, 2);
  for (const artist of artists) {
    console.log(`👤 [${artist.id}] ${artist.name} (${artist.subscribers || ''})`);
  }

  console.log('\n✅ Prueba en vivo completada exitosamente.\n');
}

main().catch(console.error);
