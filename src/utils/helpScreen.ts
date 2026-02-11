/**
 * Opens the help screen in a popup window
 * Replicates the legacy OpenHelp() JavaScript function
 */
export function OpenHelp() {
  const width = 500;
  const height = 500;
  const left = (window.screen.width - width) / 2;
  const top = (window.screen.height - height) / 2;

  window.open(
    "/dashboard/help",
    "helpscreen",
    `width=${width},height=${height},scrollbars=yes,status=yes,left=${left},top=${top}`
  );
}
