$deadline = (Get-Date).AddSeconds(120)
$ready = $false

while ((Get-Date) -lt $deadline) {
    if (Test-NetConnection -ComputerName 127.0.0.1 -Port 7420 -InformationLevel Quiet) {
        $ready = $true
        break
    }
    Start-Sleep -Milliseconds 500
}

if ($ready) {
    Start-Process "http://localhost:7420"
}
