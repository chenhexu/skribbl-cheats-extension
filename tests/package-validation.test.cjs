const {test}=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');

test('package guard accepts model metadata and rejects duplicate, nested, missing and misleading manifests',{skip:process.platform!=='win32'},()=>{
  const script=String.raw`
    $ErrorActionPreference = 'Stop'
    . './tools/package-validation.ps1'
    Assert-SingleExtensionManifest @('manifest.json','browser-ai/models/model-index.json','browser-ai/models/words.onnx')
    $invalid = @(
      @('manifest.json','browser-ai/models/manifest.json'),
      @('manifest.json','browser-ai\models\MANIFEST.JSON'),
      @('extension/manifest.json'),
      @('MANIFEST.JSON'),
      @('browser-ai/models/model-index.json')
    )
    foreach ($paths in $invalid) {
      $rejected = $false
      try { Assert-SingleExtensionManifest $paths } catch { $rejected = $true }
      if (-not $rejected) { throw "Accepted invalid package: $($paths -join ', ')" }
    }
    Write-Output 'All invalid packages rejected'
  `;
  const result=spawnSync('powershell',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',script],{cwd:require('node:path').resolve(__dirname,'..'),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.error?.message);assert.match(result.stdout,/All invalid packages rejected/);
});
