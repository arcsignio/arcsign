# Generate a minimal valid ICO file
$icoBase64 = @"
AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAABILAAASCwAAAAAAAA
AAAAD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A//
//AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///
8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///w
D///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP
///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A//
//AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///
8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///w
D///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP
///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A//
//AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///
8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///w
D///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP
///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A//
//AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///
8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///w
D///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP
///wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAA==
"@

$bytes = [Convert]::FromBase64String($icoBase64)
[IO.File]::WriteAllBytes("$PSScriptRoot\icon.ico", $bytes)
Write-Host "✓ Generated valid icon.ico file"
