param(
    [ValidateSet('cuda', 'cpu')]
    [string]$Runtime = $env:WHISPER_RUNTIME,
    [int]$Port = $(if ($env:WHISPER_PORT) { [int]$env:WHISPER_PORT } else { 8000 }),
    [string]$Image = $env:WHISPER_IMAGE,
    [switch]$UseWsl
)

if (-not $Runtime) {
    $Runtime = 'cuda'
}

if (-not $Image) {
    $Image = if ($Runtime -eq 'cuda') {
        'fedirz/faster-whisper-server:latest-cuda'
    } else {
        'fedirz/faster-whisper-server:latest-cpu'
    }
}

Write-Host "Starting Whisper server on http://localhost:$Port"
Write-Host "Runtime: $Runtime"
Write-Host "Image: $Image"
Write-Host 'Keep this terminal open while Casper is running.'

$gpuArgs = if ($Runtime -eq 'cuda') { @('--gpus', 'all') } else { @() }

if (-not $UseWsl) {
    $docker = Get-Command docker.exe -ErrorAction SilentlyContinue

    if ($docker) {
        $cachePath = Join-Path $env:USERPROFILE '.cache\huggingface'
        New-Item -ItemType Directory -Force $cachePath | Out-Null

        & docker.exe run --rm @gpuArgs --publish "${Port}:8000" --volume "${cachePath}:/root/.cache/huggingface" $Image
        exit $LASTEXITCODE
    }
}

$wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue

if (-not $wsl) {
    Write-Error 'Neither docker.exe nor wsl.exe was found. Install Docker Desktop or start the server manually.'
    exit 1
}

$gpuText = if ($Runtime -eq 'cuda') { '--gpus all ' } else { '' }
$command = @"
set -e
mkdir -p ~/.cache/huggingface
docker run --rm ${gpuText}--publish ${Port}:8000 --volume ~/.cache/huggingface:/root/.cache/huggingface ${Image}
"@

wsl.exe bash -lc $command
