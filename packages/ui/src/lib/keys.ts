/** Platform-aware shortcut labels. Uses ⌘ on macOS and Ctrl elsewhere. */
export function isMac(): boolean {
  return (
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform)
  );
}

export function shortcutLabel(
  combo: string,
  platformIsMac = isMac(),
): string[] {
  return combo.split("+").map((key) => {
    switch (key.trim().toLowerCase()) {
      case "mod":
        return platformIsMac ? "⌘" : "Ctrl";
      case "shift":
        return platformIsMac ? "⇧" : "Shift";
      case "alt":
        return platformIsMac ? "⌥" : "Alt";
      case "enter":
        return "↵";
      case "escape":
        return "Esc";
      case "backspace":
        return "⌫";
      case "arrowup":
        return "↑";
      case "arrowdown":
        return "↓";
      case "arrowleft":
        return "←";
      case "arrowright":
        return "→";
      default:
        return key.length === 1 ? key.toUpperCase() : key;
    }
  });
}
