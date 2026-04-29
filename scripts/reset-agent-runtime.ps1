[CmdletBinding()]
param(
  [switch]$Restart,
  [switch]$StopDevServer = $true
)

$ErrorActionPreference = 'Stop'

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runtimeDir = Join-Path $workspaceRoot '.agent-runtime'
$nextBuildDir = Join-Path $workspaceRoot '.next'
$nextDevDir = Join-Path $workspaceRoot '.next-dev'
$runtimeStateFile = Join-Path $runtimeDir 'backend-state.json'
$agentBackendPath = Join-Path $workspaceRoot 'Glowmia_Agent\backend'

function Write-Step([string]$Message) {
  Write-Host "[agent-reset] $Message"
}

function Stop-ProcessSafe([int]$ProcessId, [string]$Reason) {
  if ($ProcessId -le 0) {
    return
  }

  try {
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
    Write-Step "Stopping PID $ProcessId ($($process.ProcessName)) - $Reason"
    Stop-Process -Id $ProcessId -Force -ErrorAction Stop
  } catch {
    Write-Step "PID $ProcessId already stopped or unavailable."
  }
}

function Remove-DirectoryWithRetry([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  for ($attempt = 1; $attempt -le 5; $attempt++) {
    try {
      Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
      Write-Step "Removed $Path"
      return
    } catch {
      if ($attempt -eq 5) {
        throw
      }

      Write-Step "Retrying delete for $Path (attempt $attempt failed)."
      Start-Sleep -Seconds 2
    }
  }
}

Write-Step "Workspace root: $workspaceRoot"

if (Test-Path -LiteralPath $runtimeStateFile) {
  try {
    $runtimeState = Get-Content -LiteralPath $runtimeStateFile -Raw | ConvertFrom-Json

    if ($null -ne $runtimeState.pid) {
      Stop-ProcessSafe -ProcessId ([int]$runtimeState.pid) -Reason 'tracked Glowmia agent backend'
    }
  } catch {
    Write-Step "Unable to parse backend-state.json. Continuing with broader cleanup."
  }
}

$pythonProcesses = Get-CimInstance Win32_Process -Filter "Name = 'python.exe' OR Name = 'pythonw.exe' OR Name = 'py.exe'" |
  Where-Object {
    ($_.CommandLine -like "*$workspaceRoot*") -and (
      ($_.CommandLine -like "*Glowmia_Agent*backend*") -or
      ($_.CommandLine -like "*.agent-runtime*")
    )
  }

foreach ($process in $pythonProcesses) {
  Stop-ProcessSafe -ProcessId ([int]$process.ProcessId) -Reason 'Glowmia agent runtime python process'
}

if ($StopDevServer) {
  $nodeProcesses = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
    Where-Object {
      ($_.CommandLine -like "*$workspaceRoot*") -and ($_.CommandLine -like "*next*dev*")
    }

  foreach ($process in $nodeProcesses) {
    Stop-ProcessSafe -ProcessId ([int]$process.ProcessId) -Reason 'Glowmia Next.js dev server'
  }
}

Start-Sleep -Seconds 2

Remove-DirectoryWithRetry -Path $runtimeDir
Remove-DirectoryWithRetry -Path $nextBuildDir
Remove-DirectoryWithRetry -Path $nextDevDir

Write-Step "Local runtime cache cleared."
Write-Step "Bundled backend path remains: $agentBackendPath"

if ($Restart) {
  Write-Step 'Starting npm run dev in a new PowerShell window.'
  Start-Process -FilePath 'powershell' -ArgumentList '-NoProfile', '-Command', "Set-Location '$workspaceRoot'; npm run dev"
} else {
  Write-Step 'Run npm run dev when you are ready.'
}
