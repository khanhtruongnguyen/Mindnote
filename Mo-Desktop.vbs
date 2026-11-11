Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strPath

exePath = strPath & "\node_modules\electron\dist\electron.exe"

If fso.FileExists(exePath) Then
    WshShell.Run """" & exePath & """ .", 1, False
Else
    WshShell.Run "cmd /c Chay-Desktop.bat", 1, True
End If
