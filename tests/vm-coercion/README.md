VM coercion conformance: manual verification

Scope
- Verify stream and indexed coercion semantics after VM changes:
  - String and subclasses: read Characters; writes require Character.
  - ByteString: read SmallInteger 0..255 unless convertChars; writes accept Character or 0..255 SmallInteger, with range enforced.

How to run manually
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

Notes
- This repository does not currently include a headless unit-test harness that constructs Squeak objects and invokes primitives without fully loading an image. If desired, a future follow-up can add a Node-based harness around dist/squeak_headless_bundle.js to fabricate String/ByteString instances and drive primitives 65/66 and objectAt/objectAtPut directly.
