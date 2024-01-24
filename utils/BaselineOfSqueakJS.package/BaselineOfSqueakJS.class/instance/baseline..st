baseline
baseline: spec
	<baseline>
	spec
		for: #'common'
		do: [
			spec
				baseline: 'SmalltalkCI' with: 
					[ spec
						loads: #('default');
						repository: 'github://hpi-swa/smalltalkCI:81b47d0982794601c3a085f98786c6384873a4e7/repository' ];
				package: 'JSBridge-Core';
				package: 'SqueakJS-Testing' with: [spec requires: #('SmalltalkCI')];
				package: 'VMMakerJS';
				yourself.
			spec
				group: 'tests' with: #('SqueakJS-Testing') ];
				yourself