$ErrorActionPreference = 'Stop'
$widgetDir = $PSScriptRoot
$electronPath = Join-Path $widgetDir 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path -LiteralPath $electronPath)) { throw 'Electron is missing. Run npm install and npm run setup in desktop-widget first.' }
$desktopDir = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopDir 'NewsNow 新闻卡片.lnk'
$ws = New-Object -ComObject WScript.Shell
$shortcut = $ws.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $electronPath
$shortcut.Arguments = '"' + $widgetDir + '"'
$shortcut.WorkingDirectory = $widgetDir
$shortcut.IconLocation = (Join-Path $widgetDir 'newsnow.ico') + ',0'
$shortcut.Description = 'NewsNow 桌面插件 - 贴在桌面，可拖动缩放，支持系统托盘'
$shortcut.Save()
Write-Output $shortcutPath
