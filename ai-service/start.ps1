param([switch]$Setup, [switch]$SubjectSetup, [switch]$SearchSetup)
$ErrorActionPreference = 'Stop'
$servicePath = $PSScriptRoot
$environmentPython = Join-Path $servicePath '.venv\Scripts\python.exe'
if ($Setup) {
    if (-not (Test-Path -LiteralPath $environmentPython)) {
        python -m venv (Join-Path $servicePath '.venv')
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    & $environmentPython -m pip install -r (Join-Path $servicePath 'requirements.txt')
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $environmentPython (Join-Path $servicePath 'download_model.py')
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
if ($SubjectSetup) {
    $subjectPython = if (Test-Path -LiteralPath $environmentPython) { $environmentPython } else { 'python' }
    & $subjectPython (Join-Path $servicePath 'download_subject_model.py')
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
if ($SearchSetup) {
    if (-not (Test-Path -LiteralPath $environmentPython)) {
        python -m venv --system-site-packages (Join-Path $servicePath '.venv')
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    & $environmentPython -m pip install -r (Join-Path $servicePath 'requirements.txt') -r (Join-Path $servicePath 'requirements-search.txt')
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $environmentPython (Join-Path $servicePath 'download_search_model.py')
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
if (Test-Path -LiteralPath $environmentPython) { & $environmentPython (Join-Path $servicePath 'app.py') }
else { python (Join-Path $servicePath 'app.py') }
