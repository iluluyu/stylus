# Stage integration boundary

Ordinary authoring needs only sections, `goTo(index)`, and optionally
`slidechange`, `data-speaker-notes`, and `data-anim`.
Use `no-rail` for a presentation without transient editing controls.

The migrated runtime retains its upstream host protocol, not a bundled host.
Rail operations dispatch a bubbling, composed `dc-op` CustomEvent with a
`detail` operation. Without `window.__dcUpdate`, structural operations mutate
the live DOM locally; those changes do not persist to HTML source on disk.
With that host runtime present, operations use `emitOnly: true`; a host must
validate/apply the operation, update the DOM/source, and acknowledge by posting
`{__dc_op_ack: true, applied: true}`. While a structural operation is pending,
rail input is locked. A false acknowledgement unlocks without applying.
Do not send acknowledgements unless you own that host.

The source comments beside `_emitDcOp` and its callers describe operation
payloads. This skill does not ship the upstream editor, source persistence,
undo stack, presenter popup, or its external operation documentation. It does
not claim these are standalone features. Parent-window presentation/preview
messages are compatibility hooks only.

Security: serve trusted HTML and trusted PPTX configs. Both can execute
JavaScript. The stage retains permissive upstream postMessage behavior and is
not an isolation boundary for untrusted embedded content.
