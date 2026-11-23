# Coding standards

Judgement calls a reviewer enforces. Anything a linter, a test or CI can
check lives there instead.

## Device state is traced across a lifecycle

Anything kept on the device that must outlast a session or a screen (a
once-only mark, a remembered answer, a pending tap) is reviewed by tracing
leave-and-return, a remount, a kill, sign-out, and a second account on the
same phone.

The #138 invite mark needed three fixes before a review traced exactly these.

## A User's choice travels to the server as the choice itself

When the server acts on something the User chose, the request carries what
they chose, never a value the app derived from its own copy of server data (a
complement, a resolved id list, "everything except"). That copy goes stale
the moment the server learns something the app hasn't loaded, and a derived
value then fails open. Review it by asking what happens when the server knows
something the app doesn't.

ADR-0009 sent the Filter's complement, computed from the app's cached
Categories; it showed Subcategories the cache had never loaded, passed two
reviews, and was caught on a device (ADR-0010).

## A platform-quirk workaround replays what a device showed

Code that works around OS or framework behaviour names where that behaviour
was observed (device or simulator, OS version, keyboard), and its tests
replay that recorded sequence. Review it by asking where the sequence came
from, and whether each test fails on the code before the fix.

The #145 iOS secure-field repair went through four versions: the first two
matched a guessed event order and passed their tests, until a log drawn on
screen in the simulator showed the real one.
