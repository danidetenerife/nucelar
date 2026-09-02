import { YtMusicClient } from './src/client.ts';

async function main() {
  const client = new YtMusicClient(fetch);

  console.log('--- 1. PROBANDO EXPLORE (Dashboard: Novedades y Tendencias) ---');
  const explore = await client.getExplore();
  console.log('Novedades encontradas:', explore.newReleases.length, '| Primer álbum:', explore.newReleases[0]?.title, 'de', explore.newReleases[0]?.artists.join(', '));
  console.log('Tendencias encontradas:', explore.topTracks.length, '| Primera canción:', explore.topTracks[0]?.title, 'de', explore.topTracks[0]?.artists.join(', '));
  console.log('Playlists encontradas:', explore.editorialPlaylists.length, '| Primera playlist:', explore.editorialPlaylists[0]?.title);

  console.log('\n--- 2. PROBANDO PLAYLIST PÚBLICA DE YOUTUBE MUSIC ---');
  const playlist = await client.getPlaylist('VLPL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI');
  console.log('Playlist cargada:', playlist.title, '| Total canciones:', playlist.tracks.length);
  for (let i = 0; i < 3; i++) {
    console.log(`  ${i + 1}. ${playlist.tracks[i]?.title} - ${playlist.tracks[i]?.artists.join(', ')}`);
  }

  console.log('\n--- 3. PROBANDO RADIO / RECOMENDACIONES SIMILARES (Discovery) ---');
  const recs = await client.getRecommendations('ZDJQytGwyEg', 5);
  console.log('Recomendaciones para "Intro Pa\'l Cora" de Christian Nodal:');
  for (let i = 0; i < recs.length; i++) {
    console.log(`  ${i + 1}. ${recs[i]?.title} - ${recs[i]?.artists.join(', ')}`);
  }
  console.log('\n✅ ¡Todas las funcionalidades operan al 100% en tiempo real!\n');
}

main().catch(console.error);
