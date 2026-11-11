# Coding standards

Judgement calls a reviewer enforces. Anything a linter, a test or CI can
check lives there instead.

## Device state is traced across a lifecycle

Anything kept on the device that must outlast a session or a screen (a
once-only mark, a remembered answer, a pending tap) is reviewed by tracing
leave-and-return, a remount, a kill, sign-out, and a second account on the
same phone.

The #138 invite mark needed three fixes before a review traced exactly these.
