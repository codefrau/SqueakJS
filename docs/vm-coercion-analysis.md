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
