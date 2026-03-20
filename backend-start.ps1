param(
  [string]$ListenHost = "0.0.0.0",
  [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

if (-not $env:DATABASE_URL) {
  $env:DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/pickup_mvp"
}

Write-Host "Using Python: $(Get-Command python | Select-Object -ExpandProperty Source)"
Write-Host "Python version: $(python --version)"

python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host $ListenHost --port $Port
