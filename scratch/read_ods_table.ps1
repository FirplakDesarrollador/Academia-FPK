
$path = "Calificaciones/Bienvenida/temp_ods/content.xml"
$text = [IO.File]::ReadAllText($path)
$idx = $text.IndexOf("<table:table ")
if ($idx -ge 0) {
    Write-Output $text.Substring($idx, 5000)
} else {
    Write-Output "Table not found"
}
