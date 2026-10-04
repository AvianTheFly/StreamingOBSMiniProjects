$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$taskPython = 'C:\Users\Michael\AppData\Local\Python\pythoncore-3.11-64\pythonw.exe'
if (-not (Test-Path -LiteralPath $taskPython)) { throw 'Python 3.11 was not found.' }
$env:Path = 'F:\ffmpeg\bin;' + $env:Path
$taskData = Join-Path $env:LOCALAPPDATA 'FootageDesk'
New-Item -ItemType Directory -Path $taskData -Force | Out-Null
function Open-FootageDesk {
    $taskEdge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    if (Test-Path -LiteralPath $taskEdge) {
        Start-Process -FilePath $taskEdge -ArgumentList '--app=http://127.0.0.1:8791 --window-size=1500,950'
    } else { Start-Process 'http://127.0.0.1:8791' }
}
try {
    $taskHealth = Invoke-RestMethod 'http://127.0.0.1:8791/health' -TimeoutSec 2
    if ($taskHealth.source -eq (Join-Path $taskRoot 'footage_manager')) {
        Open-FootageDesk
        exit 0
    }
} catch { }
Start-Process -FilePath $taskPython -ArgumentList ('"' + (Join-Path $taskRoot 'footage_manager\app.py') + '" --no-browser') -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskData 'server.log') -RedirectStandardError (Join-Path $taskData 'server-error.log')
for ($taskAttempt = 0; $taskAttempt -lt 30; $taskAttempt++) {
    try {
        $taskHealth = Invoke-RestMethod 'http://127.0.0.1:8791/health' -TimeoutSec 1
        if ($taskHealth.app -eq 'Footage Desk') { Open-FootageDesk; exit 0 }
    } catch { }
    Start-Sleep -Milliseconds 300
}
throw 'Footage Desk did not start. See %LOCALAPPDATA%\FootageDesk\server-error.log.'
