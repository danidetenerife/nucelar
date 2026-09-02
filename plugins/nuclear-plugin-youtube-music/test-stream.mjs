import { execSync } from 'child_process';

const ytdlpPath = 'C:\\Users\\Danid\\AppData\\Roaming\\com.nuclearplayer\\ytdlp\\yt-dlp.exe';
const jsonStr = execSync(`"${ytdlpPath}" -f "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio" --dump-json --no-playlist "https://www.youtube.com/watch?v=ZDJQytGwyEg"`).toString();
const info = JSON.parse(jsonStr);

console.log('Stream URL generated');
console.log('Format ext:', info.ext);
console.log('User-Agent from yt-dlp:', info.http_headers?.['User-Agent']);

const uaStreamServer = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
const res1 = await fetch(info.url, { headers: { 'User-Agent': uaStreamServer, 'Range': 'bytes=0-1024' } });
console.log('Fetch with stream_server UA (Chrome 138):', res1.status, res1.statusText);

const uaYtdlp = info.http_headers?.['User-Agent'];
const res2 = await fetch(info.url, { headers: { 'User-Agent': uaYtdlp, 'Range': 'bytes=0-1024' } });
console.log('Fetch with yt-dlp UA:', res2.status, res2.statusText);
