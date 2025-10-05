VM coercion conformance

Scope
- Verify stream and indexed coercion semantics after VM changes:
  - String and subclasses: read Characters; writes require Character.
  - ByteString: read SmallInteger 0..255 unless convertChars; writes accept Character or 0..255 SmallInteger, with range enforced.

Automated regression
- A lightweight Node harness exercises `ReadStream`/`WriteStream` semantics for textual `ByteString` and `WideString` receivers.
- Run with `node tests/vm-coercion/stream-coercion.test.js` from the repository root.

Manual verification
1) Start the demo server:
   - npm install
   - npm start

2) In the browser console before loading an image:
   - window.SqueakDebugVM = true
   - window.SqueakDebugStream = true

3) Load Squeak 5.0 or 6.0 image and run Update.

4) Expected outcomes:
   - No “Unknown token type”
   - No “MessageNotUnderstood: ByteString>>charCode”
   - No “Improper store into indexable object”
   - [VMDBG] prim65/prim66/objectAt/objectAtPut logs show Character for String and subclasses. ByteString reads show SmallInteger unless convertChars path is used; nextPut: into String requires Character; nextPut: into ByteString accepts Character or integer 0..255 and rejects out of range.
