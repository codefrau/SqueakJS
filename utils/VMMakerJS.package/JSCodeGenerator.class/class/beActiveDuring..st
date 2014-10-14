preferences
beActiveDuring: aBlock
	| wasActive |
	wasActive := self isActive.
	self isActive: true.
	aBlock ensure: [self isActive: wasActive].