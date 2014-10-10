preferences
beActiveDuring: aBlock
	| wasActive |
	wasActive := self isActive.
	aBlock ensure: [self isActive: wasActive].