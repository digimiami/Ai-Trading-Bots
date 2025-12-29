# npm-wrapper.ps1
# Wrapper script to ensure npm always runs from the workspace directory
# Usage: .\npm-wrapper.ps1 <npm-command> [args...]

$logPath = 'C:\Users\pablobots\Documents\Cursor App\Pablo-AI-Trading\Pablo AI Trading\Pablo AI Trading\.cursor\debug.log'
$workspacePath = 'C:\Users\pablobots\Documents\Cursor App\Pablo-AI-Trading\Pablo AI Trading\Pablo AI Trading'

# #region agent log
$logEntry = @{
    sessionId = 'debug-session'
    runId = 'post-fix'
    hypothesisId = 'E'
    location = 'npm-wrapper.ps1:11'
    message = 'npm-wrapper invoked'
    data = @{
        currentDirectory = $PWD.Path
        workspacePath = $workspacePath
    }
    timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
}
$logJson = ($logEntry | ConvertTo-Json -Compress)
Add-Content -Path $logPath -Value $logJson
# #endregion agent log

# Change to workspace directory
if ($PWD.Path -ne $workspacePath) {
    Write-Host "Current directory: $($PWD.Path)" -ForegroundColor Yellow
    Write-Host "Changing to workspace directory: $workspacePath" -ForegroundColor Cyan
    Set-Location $workspacePath
    
    # #region agent log
    $logEntry = @{
        sessionId = 'debug-session'
        runId = 'post-fix'
        hypothesisId = 'E'
        location = 'npm-wrapper.ps1:30'
        message = 'Changed to workspace directory'
        data = @{
            newDirectory = (Get-Location).Path
        }
        timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    }
    $logJson = ($logEntry | ConvertTo-Json -Compress)
    Add-Content -Path $logPath -Value $logJson
    # #endregion agent log
}

# Verify package.json exists
if (-not (Test-Path 'package.json')) {
    Write-Host "ERROR: package.json not found in workspace directory!" -ForegroundColor Red
    Write-Host "Workspace: $workspacePath" -ForegroundColor Red
    exit 1
}

# #region agent log
$logEntry = @{
    sessionId = 'debug-session'
    runId = 'post-fix'
    hypothesisId = 'E'
    location = 'npm-wrapper.ps1:52'
    message = 'Running npm command'
    data = @{
        currentDirectory = (Get-Location).Path
        npmArgs = ($args -join ' ')
    }
    timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
}
$logJson = ($logEntry | ConvertTo-Json -Compress)
Add-Content -Path $logPath -Value $logJson
# #endregion agent log

# Run npm with provided arguments
& npm @args

# #region agent log
$logEntry = @{
    sessionId = 'debug-session'
    runId = 'post-fix'
    hypothesisId = 'E'
    location = 'npm-wrapper.ps1:70'
    message = 'npm command completed'
    data = @{
        exitCode = $LASTEXITCODE
    }
    timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
}
$logJson = ($logEntry | ConvertTo-Json -Compress)
Add-Content -Path $logPath -Value $logJson
# #endregion agent log

exit $LASTEXITCODE
