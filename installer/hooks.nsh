; The standard Tauri template creates the Start Menu shortcut.
; Add a desktop shortcut for this explicitly requested desktop distribution.
!macro NSIS_HOOK_POSTINSTALL
  CreateShortcut "$DESKTOP\Senda.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\${MAINBINARYNAME}.exe" 0
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  Delete "$DESKTOP\Senda.lnk"
!macroend
