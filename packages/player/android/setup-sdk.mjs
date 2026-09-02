import { execSync } from 'child_process';
import fs from 'fs';
import https from 'https';
import path from 'path';

const sdkDir = 'C:\\Users\\Danid\\AppData\\Local\\Android\\Sdk';
const cmdlineToolsDir = path.join(sdkDir, 'cmdline-tools');
const latestDir = path.join(cmdlineToolsDir, 'latest');
const zipPath = path.join(sdkDir, 'cmdline-tools.zip');

if (!fs.existsSync(cmdlineToolsDir)) {
  fs.mkdirSync(cmdlineToolsDir, { recursive: true });
}

console.log('Downloading Android SDK Command-line Tools from Google...');
const url = 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip';

function downloadFile(sourceUrl, targetPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(targetPath);
    https.get(sourceUrl, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadFile(response.headers.location, targetPath).then(resolve).catch(reject);
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(targetPath, () => {});
      reject(err);
    });
  });
}

async function run() {
  await downloadFile(url, zipPath);
  console.log('Downloaded cmdline-tools.zip. Extracting...');

  const tempExtract = path.join(sdkDir, 'temp_extract');
  if (fs.existsSync(tempExtract)) {
    fs.rmSync(tempExtract, { recursive: true, force: true });
  }
  fs.mkdirSync(tempExtract, { recursive: true });

  execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempExtract}' -Force"`);

  if (fs.existsSync(latestDir)) {
    fs.rmSync(latestDir, { recursive: true, force: true });
  }

  fs.renameSync(path.join(tempExtract, 'cmdline-tools'), latestDir);
  fs.rmSync(tempExtract, { recursive: true, force: true });
  fs.unlinkSync(zipPath);

  console.log('Android Command-line Tools installed in:', latestDir);

  // Write local.properties
  const localPropsPath = 'C:\\Users\\Danid\\Desktop\\proyectos\\nuclear-master\\packages\\player\\android\\local.properties';
  const sdkDirEscaped = sdkDir.replace(/\\/g, '\\\\');
  fs.writeFileSync(localPropsPath, `sdk.dir=${sdkDirEscaped}\n`);
  console.log('Created local.properties pointing to:', sdkDir);

  // Accept licenses and install platform-tools, platforms;android-34, build-tools;34.0.0
  const sdkManagerPath = path.join(latestDir, 'bin', 'sdkmanager.bat');
  const javaHome = 'C:\\Program Files\\Microsoft\\jdk-17.0.20.101-hotspot';
  const env = { ...process.env, JAVA_HOME: javaHome, PATH: `${path.join(javaHome, 'bin')};${process.env.PATH}` };

  console.log('Accepting Android SDK licenses...');
  execSync(`cmd.exe /c "echo y | \"${sdkManagerPath}\" --licenses --sdk_root=\"${sdkDir}\""`, { env, stdio: 'inherit' });

  console.log('Installing platforms;android-34 and build-tools;34.0.0...');
  execSync(`cmd.exe /c "\"${sdkManagerPath}\" --sdk_root=\"${sdkDir}\" \"platform-tools\" \"platforms;android-34\" \"build-tools;34.0.0\""`, { env, stdio: 'inherit' });

  console.log('Android SDK setup complete!');
}

run().catch(console.error);
