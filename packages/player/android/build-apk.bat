@echo off
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
set "PATH=%JAVA_HOME%\bin;%PATH%"
cd /d "C:\Users\Danid\Desktop\proyectos\nuclear-master\packages\player\android"
call gradlew.bat assembleDebug
if not exist "C:\Users\Danid\Desktop\proyectos\nuclear-master\ejecutables" mkdir "C:\Users\Danid\Desktop\proyectos\nuclear-master\ejecutables"
if exist "app\build\outputs\apk\debug\app-debug.apk" (
    copy /y "app\build\outputs\apk\debug\app-debug.apk" "C:\Users\Danid\Desktop\proyectos\nuclear-master\ejecutables\nuclear-music-player.apk"
    copy /y "app\build\outputs\apk\debug\app-debug.apk" "C:\Users\Danid\Desktop\proyectos\nuclear-master\nuclear-music-player.apk"
)
