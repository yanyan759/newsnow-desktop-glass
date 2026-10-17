$ErrorActionPreference = 'Stop'
$widgetDir = $PSScriptRoot
$electronPath = Join-Path $widgetDir 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path -LiteralPath $electronPath)) { throw 'Electron is missing. Run npm install and npm run setup in desktop-widget first.' }
$desktopDir = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopDir 'AI 前沿新闻卡片.lnk'
$ws = New-Object -ComObject WScript.Shell
$shortcut = $ws.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $electronPath
$shortcut.Arguments = '"' + $widgetDir + '"'
$shortcut.WorkingDirectory = $widgetDir
$shortcut.IconLocation = (Join-Path $widgetDir 'newsnow.ico') + ',0'
$shortcut.Description = 'AI 前沿 - arXiv、Hugging Face 论文与 AI 资讯，贴在桌面自动更新'
$shortcut.Save()
Write-Output $shortcutPath
