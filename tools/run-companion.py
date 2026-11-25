"""Optional: start the Desk Hub companion without its ASCII folding.

The board's fonts only cover ASCII, so the companion folds all text to it: "Işıklı
Yağmur" becomes "Iskl Yagmur". A phone has the letters. This starts the unmodified
companion with that one function replaced; its files stay as they are.

Run it with the companion's own Python, from its folder, with the same options:

    cd ..\\deskhub\\companion
    uv run python ..\\..\\deskhub-mobile\\tools\\run-companion.py --config config.toml

The tray's Restart, and the Startup shortcut of deskhub-install, start the companion
without this file, so they bring the folding back.

Written for companion/deskhub/text.py at b78c505279a50f80cd40bfc86f0d9de9ac79437c.
"""
import inspect
import sys
import unicodedata


def keep_text(s: str | None, limit: int = 120) -> str:
    """ascii_fold() without the folding: the whitespace clean-up and the limit stay."""
    if not s:
        return ""
    return " ".join(unicodedata.normalize("NFC", s).split())[:limit]


def main() -> None:
    # The modules do "from .text import ascii_fold", so it has to be replaced before
    # any of them is imported.
    try:
        import deskhub.text as text
    except ModuleNotFoundError:
        sys.exit("The deskhub package isn't installed here. Run this with the companion's Python (see the top of the file).")

    fold = getattr(text, "ascii_fold", None)
    if fold is None or list(inspect.signature(fold).parameters) != ["s", "limit"]:
        sys.exit("This companion's ascii_fold isn't the one this was written for. Start the companion as usual instead.")
    text.ascii_fold = keep_text

    from deskhub.__main__ import main as run

    run()


if __name__ == "__main__":
    main()
