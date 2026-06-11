
$path = "Calificaciones/Bienvenida/temp_ods/content.xml"
$text = [IO.File]::ReadAllText($path)
$idx = $text.IndexOf("Milton")
if ($idx -ge 0) {
    Write-Output $text.Substring($idx, 2000)
} else {
    Write-Output "Milton not found"
}
