
$path = "Calificaciones/Bienvenida/temp_ods/content.xml"
$text = [IO.File]::ReadAllText($path)
$idx = $text.IndexOf("Nombre")
if ($idx -ge 0) {
    Write-Output $text.Substring($idx, 3000)
} else {
    Write-Output "Nombre not found"
}
