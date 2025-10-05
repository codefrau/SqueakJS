VM-side character/byte coercion analysis (SqueakJS)

Scope
- Primitives: Stream 65 (primitiveNext), 66 (primitiveNextPut), 67 (primitiveAtEnd)
- Indexed access: objectAt/objectAtPut and at-cache helpers
- Character conversion: charFromInt/charToInt (Spur-aware)
- Kind/class checks: isBytes/isWords/isPointers; isKindOf decisions via isA helper
- Goal: Validate against Squeak semantics and identify mismatches

Squeak semantics (expected)
- String and subclasses (text):
  - Read returns Character
  - Write requires Character
- ByteString and other byte arrays:
  - Read SmallInteger 0..255 unless textual/convertChars=true → Character
  - Write accepts Character or 0..255 SmallInteger; enforce bounds
- Stream primitives should mirror these rules:
  - next returns Character for String/isKindOf(String)
  - nextPut: requires Character for String/isKindOf(String); for ByteString accepts Character or 0..255 integer
- Subclasses: use isKindOf, not strict class equality
- CompiledMethod byte area: treated as bytes; at:/atPut: semantics similar to ByteArray/ByteString with bounds enforcement
- WideString/Unicode: characters are first-class; writes must be Character; integer writes rejected

Code locations (for reviewers)
- vm.primitives.js
  - primitiveNext/primitiveNextPut/primitiveAtEnd (Stream): section around stream primitives
  - objectAt/objectAtPut: indexed access section
  - charFromInt/charToInt (and Spur variants)
- vm.object.js
  - isBytes/isWords/isPointers; class accessors/helpers
- vm.object.spur.js
  - Spur object formats; decoding for bytes/words/pointers
- vm.interpreter.js
  - DNU paths; primitive failure logging (for verification with VM debug flags)

Current implementation (key points)
- primitiveNext (65):
  - Pointers: returns pointer element
  - Words: returns 32-bit integer unless falling back with convertChars
  - Bytes:
    - Exact String returns Character
    - Other bytes return SmallInteger byte
  - Fallback objectAt invoked with convertChars=true only if arr.sqClass === String
- primitiveNextPut (66):
  - Pointers: store object
  - Words: require signed 32-bit SmallInteger
  - Bytes:
    - Accept Character or SmallInteger 0..255 (range-enforced)
  - Fallback objectAtPut convertChars set only for exact String
- primitiveAtEnd (67): position check
- objectAt:
  - pointers: object
  - words: Character if convertChars else 32-bit int
  - bytes: Character if convertChars else SmallInteger byte
  - compiled methods: byte area handled like bytes after header/pointers
- objectAtPut:
  - pointers: object
  - words: Character if convertChars else 32-bit SmallInteger
  - bytes: Character if convertChars else SmallInteger; range 0..255 enforced
  - compiled methods: byte area writes supported with same bounds
- charFromInt/charToInt (Spur): delegate to image; callers must enforce bounds

Validated mismatches vs semantics
1) Strict equality vs isKindOf for String
   - Stream 65/66 and fallback convertChars decisions use arr.sqClass === String
   - Effect: String subclasses read as SmallInteger and may accept integer writes, violating textual rules
   - Consequences: DNU ByteString>>charCode, “Unknown token type,” “Improper store into indexable object”
2) Stream semantics for String writes
   - nextPut: bytes path allows integer writes unless correctly routed
   - If convertChars not set due to subclass, integers can be written into String
3) Textual read for String subclasses
   - Without convertChars=true via isKindOf, next/objectAt return SmallInteger instead of Character
4) WideString/Unicode subclasses
   - Any path that relies on byte semantics for String subclasses will corrupt or reject valid Characters; must uniformly require Character writes and return Characters on reads
5) CompiledMethod byte area
   - Should remain byte-oriented; ensure convertChars is not erroneously enabled for method byte area when accessed textually via generic paths

Validated alignments (good)
- objectAt/objectAtPut correctly implement convertChars behavior and bound checks for bytes
- ByteString writes enforce 0..255; Character writes coerce via charToInt
- Words path supports convertChars route to Character where requested
- CompiledMethod byte area is properly treated as bytes with bounds enforced

Recommendations
- Use isKindOf(String) semantics at decision points:
  - primitiveNext: treat String and subclasses as textual (return Character)
  - primitiveNextPut: require Character when receiver is isKindOf(String)
  - Fallback objectAt/objectAtPut: set convertChars based on isKindOf(String)
- Preserve ByteString behavior:
  - Reads: SmallInteger unless convertChars requested
  - Writes: Accept Character or 0..255 SmallInteger; enforce range
- CompiledMethod byte area:
  - Keep byte semantics; do not enable convertChars for method byte area access by default
- WideString/Unicode handling:
  - Ensure all textual paths require Character on writes and produce Character on reads for isKindOf(String) receivers (including WideString subclasses)
- Avoid duplicating conversion logic by delegating to objectAt/objectAtPut with correct convertChars
- Keep bounds/type checks as implemented in objectAtPut

Verification strategy
- Manual: enable SqueakDebugVM/SqueakDebugStream; run Squeak 5.0/6.0 updates
  - Expect: no “Unknown token type”, no “MessageNotUnderstood: ByteString>>charCode”, no “Improper store …”
  - Logs show Characters for String/subclasses; ByteString integers unless convertChars
  - For compiled method access, verify byte read/write bounds logs without textual coercion
- Automated (future follow-up):
  - Node harness around dist/squeak_headless_bundle.js to fabricate:
    - String and String subclass: next returns Character; nextPut requires Character
    - ByteString: next returns SmallInteger; with convertChars: Character; nextPut accepts Character or 0..255 integer; rejects out-of-range
    - CompiledMethod: at:/atPut: respects byte semantics and range; no convertChars
    - WideString subclass: treated as textual; writes require Character; reads yield Character

Conclusion
- Primary issue: exact-class checks exclude subclasses, violating Squeak’s isKindOf rules for textual collections
- With isKindOf applied in stream primitives and fallback convertChars, VM aligns with expected Squeak semantics while preserving byte/word and compiled-method correctness
- Proposed verification ensures parser/scanner stability and guards against regressions in byte/word arrays and method byte areas
VM-side character/byte coercion analysis (SqueakJS)

Scope
- Primitives: Stream 65 (primitiveNext), 66 (primitiveNextPut), 67 (primitiveAtEnd)
- Indexed access: objectAt/objectAtPut and at-cache helpers
- Character conversion: charFromInt/charToInt (Spur-aware)
- Kind/class checks: isBytes/isWords/isPointers; isKindOf decisions via isA helper
- Goal: Validate against Squeak semantics and identify mismatches

Squeak semantics (expected)
- String and subclasses (text):
  - Read returns Character
  - Write requires Character
- ByteString and other byte arrays:
  - Read SmallInteger 0..255 unless textual/convertChars=true → Character
  - Write accepts Character or 0..255 SmallInteger; enforce bounds
- Stream primitives should mirror these rules:
  - next returns Character for String/isKindOf(String)
  - nextPut: requires Character for String/isKindOf(String); for ByteString accepts Character or 0..255 integer
- Subclasses: use isKindOf, not strict class equality

Current implementation (key points)
- primitiveNext (65):
  - Pointers: returns pointer element
  - Words: returns 32-bit integer unless falling back with convertChars
  - Bytes:
    - Exact String returns Character
    - Other bytes return SmallInteger byte
  - Fallback objectAt invoked with convertChars=true only if arr.sqClass === String
- primitiveNextPut (66):
  - Pointers: store object
  - Words: require signed 32-bit SmallInteger
  - Bytes:
    - Accept Character or SmallInteger 0..255 (range-enforced)
  - Fallback objectAtPut convertChars set only for exact String
- primitiveAtEnd (67): position check
- objectAt:
  - pointers: object
  - words: Character if convertChars else 32-bit int
  - bytes: Character if convertChars else SmallInteger byte
- objectAtPut:
  - pointers: object
  - words: Character if convertChars else 32-bit SmallInteger
  - bytes: Character if convertChars else SmallInteger; range 0..255 enforced
- charFromInt/charToInt (Spur): delegate to image; callers must enforce bounds

Validated mismatches vs semantics
1) Strict equality vs isKindOf for String
   - Stream 65/66 and fallback convertChars decisions use arr.sqClass === String
   - Effect: String subclasses read as SmallInteger and may accept integer writes, violating textual rules
   - Consequences: DNU ByteString>>charCode, “Unknown token type,” “Improper store into indexable object”
2) Stream semantics for String writes
   - nextPut: bytes path allows integer writes unless correctly routed
   - If convertChars not set due to subclass, integers can be written into String
3) Textual read for String subclasses
   - Without convertChars=true via isKindOf, next/objectAt return SmallInteger instead of Character

Validated alignments (good)
- objectAt/objectAtPut correctly implement convertChars behavior and bound checks for bytes
- ByteString writes enforce 0..255; Character writes coerce via charToInt
- Words path supports convertChars route to Character where requested

Recommendations
- Use isKindOf(String) semantics at decision points:
  - primitiveNext: treat String and subclasses as textual (return Character)
  - primitiveNextPut: require Character when receiver is isKindOf(String)
  - Fallback objectAt/objectAtPut: set convertChars based on isKindOf(String)
- Preserve ByteString behavior:
  - Reads: SmallInteger unless convertChars requested
  - Writes: Accept Character or 0..255 SmallInteger; enforce range
- Avoid duplicating conversion logic by delegating to objectAt/objectAtPut with correct convertChars
- Keep bounds/type checks as implemented in objectAtPut

Verification strategy
- Manual: enable SqueakDebugVM/SqueakDebugStream; run Squeak 5.0/6.0 updates
  - Expect: no “Unknown token type”, no “ByteString>>charCode”, no “Improper store …”
  - Logs show Characters for String/subclasses; ByteString integers unless convertChars
- Automated (future follow-up):
  - Node harness around dist/squeak_headless_bundle.js to fabricate String/ByteString and drive primitives 65/66 and objectAt/objectAtPut
  - Cases:
    - String + subclass read returns Character; write requires Character
    - ByteString read returns SmallInteger; with convertChars: Character
    - ByteString write accepts Character/0..255; rejects out-of-range

Conclusion
- Primary issue: exact-class checks exclude subclasses, violating Squeak’s isKindOf rules for textual collections
- With isKindOf applied in stream primitives and fallback convertChars, VM aligns with expected Squeak semantics while preserving byte/word enforcement and avoiding regressions
References
- Repository paths of interest:
  - vm.primitives.js (stream primitives 65/66/67, objectAt/objectAtPut, charFromInt/charToInt)
  - vm.object.js (isBytes/isWords/isPointers, class helpers)
  - vm.object.spur.js (Spur formats and decoding)
  - vm.interpreter.js (DNU paths and debug logging toggles)
- Link to Devin run: https://app.devin.ai/sessions/312b21a8cfee4949a3d201841628327b
- Requested by: Paul Bernard (@pauljbernard)
