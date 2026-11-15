"use client";

/**
 * An in-page link that scrolls to its target and plays the card-focus pulse on it, every click. The founder and
 * investor cards sit side by side, so scrolling alone would look the same for both; the pulse shows which one.
 * Without JavaScript it is a plain #anchor.
 */
export function FocusLink({ target, className, children }: { target: string; className?: string; children: React.ReactNode }) {
  return (
    <a
      href={`#${target}`}
      className={className}
      onClick={(e) => {
        const el = document.getElementById(target);
        if (!el) return;
        e.preventDefault();
        history.replaceState(null, "", `#${target}`);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Restart the animation even when the same card is picked twice in a row.
        el.classList.remove("card-focus");
        void el.offsetWidth;
        el.classList.add("card-focus");
        el.addEventListener("animationend", () => el.classList.remove("card-focus"), { once: true });
      }}
    >
      {children}
    </a>
  );
}
