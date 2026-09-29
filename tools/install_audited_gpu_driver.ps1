$ErrorActionPreference = 'Stop'
$auditDir = Join-Path $env:LOCALAPPDATA 'StreamingHub\diagnostics\audit-20260914'
Start-Transcript -Path (Join-Path $auditDir 'driver-install-admin.log') -Append
try {
    if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Administrator token required' }
    if (Get-Process obs64 -ErrorAction SilentlyContinue) { throw 'Close OBS before installing the driver' }
    $setup = Join-Path $auditDir 'driver-616.92\setup.exe'
    $signature = Get-AuthenticodeSignature -LiteralPath $setup
    if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'NVIDIA Corporation') { throw 'NVIDIA installer signature failed validation' }
    $previous = Get-CimInstance Win32_PnPSignedDriver | Where-Object { $_.DeviceName -eq 'NVIDIA GeForce RTX 2080 Ti' }
    if (-not $previous) { throw 'Expected GPU not found' }
    $previous | Select-Object DeviceName,DriverVersion,InfName | ConvertTo-Json | Set-Content (Join-Path $auditDir 'driver-before-install.json')
    $backupDir = Join-Path $auditDir 'driver-rollback'
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    foreach ($driver in $previous) {
        & pnputil /export-driver $driver.InfName $backupDir
        if ($LASTEXITCODE -ne 0) { throw 'Could not export previous driver for rollback' }
    }
    Get-Process MSIAfterburner -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.Path -ne 'C:\Program Files (x86)\MSI Afterburner\MSIAfterburner.exe') { throw 'Unexpected tuning process' }
        Stop-Process -Id $_.Id
    }
    $installer = Start-Process -FilePath $setup -ArgumentList '-s -n -noreboot Display.Driver' -WorkingDirectory (Split-Path $setup) -WindowStyle Hidden -PassThru -Wait
    @{exitCode=$installer.ExitCode; time=(Get-Date).ToString('o')} | ConvertTo-Json | Set-Content (Join-Path $auditDir 'driver-install-result.json')
    if ($installer.ExitCode -notin 0,1) { throw "NVIDIA installer failed with exit code $($installer.ExitCode)" }
    & nvidia-smi --query-gpu=name,driver_version,power.limit,power.default_limit --format=csv
} catch {
    $_ | Out-String | Set-Content (Join-Path $auditDir 'driver-install-error.txt')
    throw
} finally { Stop-Transcript }
