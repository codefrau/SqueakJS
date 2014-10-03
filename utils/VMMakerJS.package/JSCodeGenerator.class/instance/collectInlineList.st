inlining
collectInlineList
	"Make a list of methods that should be inlined."
	"Details: The method must not include any inline C, since the translator cannot
	currently map variable names in inlined C code. The #inline: directive may be
	used to override this for cases in which the C code or declarations are harmless.
	Methods to be inlined must be small or called from only one place."

	| methodsNotToInline callsOf inlineIt hasCCode nodeCount senderCount
sel |
	methodsNotToInline := Set new: methods size.

	"build dictionary to record the number of calls to each method"
	callsOf := Dictionary new: methods size * 2.
	methods keys do: [ :s | callsOf at: s put: 0 ].

	"For each method, scan its parse tree once to:
		1. determine if the method contains C code or declarations
		2. determine how many nodes it has
		3. increment the sender counts of the methods it calls
		4. determine if it includes any C declarations or code"
	inlineList := Set new: methods size * 2.
	methods do: [ :m |
		inlineIt := #dontCare.
		(translationDict includesKey: m selector) ifTrue: [
			hasCCode := true.
		] ifFalse: [
			hasCCode := m declarations size > 0.
			nodeCount := 0.
			m parseTree nodesDo: [ :node |
				node isSend ifTrue: [
					sel := node selector.
					(sel = #cCode: or: [sel = #cCode:inSmalltalk:])
						ifTrue: [ hasCCode := true ].
					senderCount := callsOf at: sel ifAbsent: [ nil ].
					nil = senderCount ifFalse: [
						callsOf at: sel put: senderCount + 1.
					].
				].
				nodeCount := nodeCount + 1.
			].
			inlineIt := m extractInlineDirective.  "may be true, false, or
#dontCare"
		].
		(inlineIt ~= true and: [hasCCode or: [inlineIt = false]]) ifTrue: [
			"Don't inline if method has C code or if it contains a negative inline
			directive. If it contains a positive inline directive, permit inlining even
			if C code is present."
			methodsNotToInline add: m selector.
		] ifFalse: [
			((nodeCount < 40) or: [inlineIt = true]) ifTrue: [
				"inline if method has no C code and is either small or contains
inline directive"
				inlineList add: m selector.
			].
		].
	].

	callsOf associationsDo: [ :assoc |
		((assoc value = 1) and: [(methodsNotToInline includes: assoc key)
not]) ifTrue: [
			inlineList add: assoc key.
		].
	].