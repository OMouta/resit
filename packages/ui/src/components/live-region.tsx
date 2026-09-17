/**
 * Visually hidden live region. Render it once and change `message` to have
 * screen readers announce it. "assertive" interrupts; use it for errors only.
 */
function LiveRegion({
  message,
  politeness = "polite",
}: {
  message: string;
  politeness?: "polite" | "assertive";
}) {
  return (
    <div
      data-slot="live-region"
      role={politeness === "assertive" ? "alert" : "status"}
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}

export { LiveRegion };
