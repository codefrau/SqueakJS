private
ifPointerVar: node then: aBlock
	(node isSend and: [node selector = #+]) ifTrue: [
		^self ifPointerVar: node receiver then: aBlock].
	node isVariable ifTrue: [
		(self typeOfVariable: node name) ifNotNil: [:type |
			(type includes: $*) ifTrue: [aBlock value: type]]].
