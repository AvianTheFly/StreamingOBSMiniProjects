$ErrorActionPreference = 'Stop'
$auditDir = Join-Path $env:LOCALAPPDATA 'StreamingHub\diagnostics\audit-20260914'
Start-Transcript -Path (Join-Path $auditDir 'stock-reset-admin.log') -Append
try {
    if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Administrator token required' }
    $profilePath = 'C:\Program Files (x86)\MSI Afterburner\Profiles\VEN_10DE&DEV_1E07&SUBSYS_24873842&REV_A1&BUS_1&DEV_0&FN_0.cfg'
    $abExe = 'C:\Program Files (x86)\MSI Afterburner\MSIAfterburner.exe'
    Get-Process MSIAfterburner -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.Path -ne $abExe) { throw 'Unexpected Afterburner executable' }
        Stop-Process -Id $_.Id
    }
    $original = [IO.File]::ReadAllText($profilePath)
    Copy-Item -LiteralPath $profilePath -Destination (Join-Path $auditDir ('afterburner-stock-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.cfg'))
    $defaults = [regex]::Match($original, '(?ms)^\[Defaults\]\s*\r?\n(.*?)(?=^\[|\z)').Groups[1].Value
    if ($defaults -notmatch '(?m)^PowerLimit=100\r?$' -or $defaults -notmatch '(?m)^CoreClkBoost=0\r?$' -or $defaults -notmatch '(?m)^MemClkBoost=0\r?$') { throw 'Unexpected default profile' }
    if ($original -match '(?m)^\[Profile5\]') { throw 'Profile 5 is already occupied; no overwrite performed' }
    $stock = $defaults.TrimEnd() + "`r`nCoreVoltageBoost=0`r`n"
    $updated = [regex]::Replace($original, '(?ms)^\[Startup\].*?(?=^\[|\z)', [Text.RegularExpressions.MatchEvaluator]{ param($m) "[Startup]`r`n" + $stock })
    $updated += "`r`n[Profile5]`r`n" + $stock
    [IO.File]::WriteAllText($profilePath, $updated, [Text.Encoding]::ASCII)
    Start-Process -FilePath $abExe -ArgumentList '-profile5' -WindowStyle Hidden
    Start-Sleep -Seconds 5
    & nvidia-smi -i 0 -pl 300
    if ($LASTEXITCODE -ne 0) { throw 'Power limit verification command failed' }
    & nvidia-smi --query-gpu=power.limit,power.default_limit,clocks.gr,clocks.mem --format=csv
    'Stock profile applied; saved profiles 1 and 2 retained.' | Set-Content (Join-Path $auditDir 'stock-reset-result.txt')
} catch {
    $_ | Out-String | Set-Content (Join-Path $auditDir 'stock-reset-result.txt')
    throw
} finally { Stop-Transcript }
