"SqueakJS compatibility: restore the classic VM display/input path that 64-bit Pharo builds dropped (they are SDL2/FFI-only). Filed in automatically at startup."!

SharedPool subclass: #EventSensorConstants
	instanceVariableNames: ''
	classVariableNames: 'BlueButtonBit ButtonsBitMask CommandKeyBit CtrlKeyBit EventKeyChar EventKeyDown EventKeyUp EventTypeDragDropFiles EventTypeIndexInBuffer EventTypeKeyboard EventTypeMenu EventTypeMouse EventTypeNone EventTypeWindow KeyboardModifierIndexInEventBuffer ModifierKeysBitMask MouseButtonIndexInEventBuffer MouseModifierIndexInEventBuffer MouseXCoordinateIndexInEventBuffer MouseYCoordinateIndexInEventBuffer OptionKeyBit RedButtonBit ShiftKeyBit WindowEventActivated WindowEventClose WindowEventIconise WindowEventMetricChange WindowEventPaint YellowButtonBit'
	package: 'System-VMEvents-Support'!

!EventSensorConstants class methodsFor: 'private - initialization' stamp: ''!
initializeEventKeyConstants
	"Press codes for keyboard events"
	
	EventKeyChar := 0.
	EventKeyDown := 1.
	EventKeyUp := 2.! !

!EventSensorConstants class methodsFor: 'class initialization' stamp: ''!
initialize

	self 
		initializeButtonBits;
		initializeSpecialKeyBits;
		initializeEventTypeConstants;
		initializeEventKeyConstants;
		initializeWindowEventConstants;
		initializeEventIndexesConstants! !

!EventSensorConstants class methodsFor: 'private - initialization' stamp: ''!
initializeEventTypeConstants
	"Types of events"
	
	EventTypeNone := 0.
	EventTypeMouse := 1.
	EventTypeKeyboard := 2.
	EventTypeDragDropFiles := 3.
	EventTypeMenu := 4.
	EventTypeWindow := 5! !

!EventSensorConstants class methodsFor: 'private - initialization' stamp: ''!
initializeButtonBits

	RedButtonBit := 4.
	BlueButtonBit := 1.
	YellowButtonBit := 2.
	ButtonsBitMask := RedButtonBit | BlueButtonBit | YellowButtonBit! !

!EventSensorConstants class methodsFor: 'private - initialization' stamp: ''!
initializeSpecialKeyBits

	ShiftKeyBit := 1.
	CtrlKeyBit := 2.
	OptionKeyBit := 4.
	CommandKeyBit := 8.
	ModifierKeysBitMask := OptionKeyBit | CommandKeyBit | CtrlKeyBit! !

!EventSensorConstants class methodsFor: 'private - initialization' stamp: ''!
initializeWindowEventConstants
	"Window event action codes"

	WindowEventMetricChange := 1. "Size or position of window changed - value1-4 are left/top/right/bottom values"
	WindowEventClose := 2. "Window close icon pressed"
	WindowEventIconise := 3. "Window iconised or hidden etc."
	WindowEventActivated :=4. "Window made active - some platforms only - do not rely upon this"
	WindowEventPaint := 5. "Window area (in value1-4) needs updating. Some platforms do not need to send this, do not rely on it in image"	! !

!EventSensorConstants class methodsFor: 'private - initialization' stamp: ''!
initializeEventIndexesConstants
	EventTypeIndexInBuffer := 1.
	MouseModifierIndexInEventBuffer := 6.
	MouseButtonIndexInEventBuffer := 5.
	MouseXCoordinateIndexInEventBuffer := 3.
	MouseYCoordinateIndexInEventBuffer := 4.
	KeyboardModifierIndexInEventBuffer := 5! !

EventSensorConstants initialize!

Object subclass: #InputEventHandler
	instanceVariableNames: 'eventFetcher'
	classVariableNames: ''
	poolDictionaries: 'EventSensorConstants'
	package: 'System-VMEvents-Base'!

!InputEventHandler methodsFor: 'events' stamp: ''!
handleEvent: eventBuffer
	self subclassResponsibility! !

!InputEventHandler methodsFor: 'events' stamp: ''!
flushEvents! !

!InputEventHandler methodsFor: 'events - testing' stamp: ''!
isKeyboardEvent: eventBuffer

	^self class isKeyboardEvent: eventBuffer! !

!InputEventHandler methodsFor: 'initialization' stamp: ''!
registerIn: anEventFetcher
	eventFetcher := anEventFetcher.
	eventFetcher registerHandler: self! !

!InputEventHandler methodsFor: 'initialization' stamp: ''!
unregister
	eventFetcher ifNotNil: [
			eventFetcher unregisterHandler: self.
			eventFetcher := nil. ]! !

!InputEventHandler class methodsFor: 'events - testing' stamp: ''!
isKeyboardEvent: eventBuffer
	^ eventBuffer first = EventTypeKeyboard and: [ eventBuffer fourth = EventKeyChar ]! !

InputEventHandler subclass: #InputEventSensor
	instanceVariableNames: 'eventQueue modifiers mouseButtons mousePosition'
	classVariableNames: 'ButtonDecodeTable KeyDecodeTable'
	poolDictionaries: 'EventSensorConstants'
	package: 'System-VMEvents-Base'!

!InputEventSensor methodsFor: 'events' stamp: ''!
nextEvent
	"Return the next event from the receiver."
	| evt |

	evt := eventQueue nextOrNil.
	^ evt ifNotNil: [ self processEvent: evt ]
! !

!InputEventSensor methodsFor: 'private - events' stamp: ''!
nextKeyboardEvent
	"Allows for use of old Sensor protocol to get at the keyboard,
	as when running kbdTest or the InterpreterSimulator in Morphic"

	| evtBuf |
	evtBuf := eventQueue findFirst: [:buf | self isKeyboardEvent: buf].
	self flushNonKbdEvents.
	^evtBuf! !

!InputEventSensor methodsFor: 'private - events' stamp: ''!
processEvent: evt
	"Process a single event. This method is run at high priority."

	| type |
	type := evt at: EventTypeIndexInBuffer.

	"Treat menu events first"
	type = EventTypeMenu
		ifTrue:
			[ "Do we still have EventTypeMenu? All the code handling this was removed from Pharo. I keep this guard just in case." ^ nil ].

	"Tackle mouse events first"
	type = EventTypeMouse
		ifTrue: [ ^ self processMouseEvent: evt ].


	"Finally keyboard"
	type = EventTypeKeyboard
		ifTrue: [ ^ self processKeyboardEvent: evt ].

	"Handle all events other than Keyboard or Mouse."
	^ evt! !

!InputEventSensor methodsFor: 'initialization' stamp: ''!
initialize
	"Initialize the receiver"
	super initialize.
	eventQueue := WaitfreeQueue new.
	mouseButtons := 0.
	mousePosition := 0 @ 0.
	modifiers := 0! !

!InputEventSensor methodsFor: 'private - events' stamp: ''!
characterForEvent: evtBuf

	| keycode |
	evtBuf ifNil: [^nil].
	keycode := evtBuf sixth.
	^keycode
		ifNotNil: [Unicode value: keycode]! !

!InputEventSensor methodsFor: 'modifier keys' stamp: ''!
controlKeyPressed
	"Answer whether the control key on the keyboard is being held down."

	^self modifiers anyMask: CtrlKeyBit! !

!InputEventSensor methodsFor: 'keyboard' stamp: ''!
keyboardPressed
	"Answer true if keystrokes are available."

	^self peekKeyboardEvent notNil! !

!InputEventSensor methodsFor: 'private' stamp: ''!
primReadJoystick: index
	"Return the joystick input word for the joystick with the given index in the range [1..16]. Returns zero if the index does not correspond to a currently installed joystick."

	<primitive: 'primitiveReadJoystick' module: 'JoystickTabletPlugin'>
	^ 0

	! !

!InputEventSensor methodsFor: 'private - events' stamp: ''!
queueEvent: evt
	"Queue the given event in the event queue"
	eventQueue nextPut: evt! !

!InputEventSensor methodsFor: 'private - events' stamp: ''!
mouseButtons
	"button state; bitfield with the following entries:
		1	-	yellow (e.g., right) button
		2	-	blue (e.g., middle) button
		4	-	red (e.g., left) button
		[all other bits are currently undefined]"

	"Fetch the next event if any to update state.
	Makes sure that the old polling methods consume events"
	self nextEvent.
	
	^mouseButtons! !

!InputEventSensor methodsFor: 'mouse' stamp: ''!
waitButtonOrKeyboard
	"Wait for the user to press either any mouse button or any key. 
	Answer the current cursor location or nil if a keypress occurred."

	| delay |
	delay := Delay forMilliseconds: 50.
	[self anyButtonPressed]
		whileFalse: [delay wait.
			self keyboardPressed
				ifTrue: [^ nil]].
	^ self cursorPoint
! !

!InputEventSensor methodsFor: 'mouse' stamp: ''!
waitClickButton
	"Wait for the user to click (press and then release) any mouse button and 
	then answer with the current location of the cursor."

	self waitButton.
	^self waitNoButton! !

!InputEventSensor methodsFor: 'events' stamp: ''!
peekEvent
	"Look ahead at the next event."

	| nextEvent |
	nextEvent := eventQueue peek.
	^ (nextEvent notNil
		and: [ (nextEvent at: EventTypeIndexInBuffer) ~= EventTypeMenu ])
		ifTrue: [ self processEvent: nextEvent ]! !

!InputEventSensor methodsFor: 'mouse' stamp: ''!
waitNoButton
	"Wait for the user to release any mouse button and then answer the current location of the cursor."

	| delay |
	delay := Delay forMilliseconds: 50.
	[self anyButtonPressed] whileTrue: [ delay wait].
	^self cursorPoint
! !

!InputEventSensor methodsFor: 'events' stamp: ''!
someEventInQueue
	^eventQueue isEmpty not! !

!InputEventSensor methodsFor: 'mouse' stamp: ''!
noButtonPressed
	"Answer whether any mouse button is not being pressed."

	^self anyButtonPressed not
! !

!InputEventSensor methodsFor: 'joystick' stamp: ''!
joystickOn: index

	^ (((self primReadJoystick: index) bitShift: -27) bitAnd: 1) ~= 0
	! !

!InputEventSensor methodsFor: 'joystick' stamp: ''!
joystickButtons: index

	^ ((self primReadJoystick: index) bitShift: -22) bitAnd: 16r71F
	! !

!InputEventSensor methodsFor: 'modifier keys' stamp: ''!
shiftPressed
	"Answer whether the shift key on the keyboard is being held down."

	^self modifiers anyMask: ShiftKeyBit
! !

!InputEventSensor methodsFor: 'keyboard' stamp: ''!
flushKeyboard
	"Remove all characters from the keyboard buffer."

	[self keyboardPressed]
		whileTrue: [self keyboard]! !

!InputEventSensor methodsFor: 'private - events' stamp: ''!
flushNonKbdEvents
	eventQueue ifNil: [^ self].
	eventQueue flushAllSuchThat:
		[:buf | (self isKeyboardEvent: buf) not]! !

!InputEventSensor methodsFor: 'private - events' stamp: ''!
processKeyboardEvent: evt
	modifiers := evt at: KeyboardModifierIndexInEventBuffer.	"Update state for polling calls"
	^ evt! !

!InputEventSensor methodsFor: 'private' stamp: ''!
primTabletRead: cursorIndex
	"Answer the pen tablet data for the cursor having the given index. Answer nil if there is no pen tablet. The data is:
	1. index of the cursor to which this data applies
	2. timestamp of the last state chance for this cursor
	3., 4., and 5. x, y, and z coordinates of the cursor (z is typically 0)
	6. and 7. xTilt and yTilt of the cursor; (signed)
	8. type of cursor (0 = unknown, 1 = pen, 2 = puck, 3 = eraser)
	9. cursor buttons
	10. cursor pressure, downward
	11. cursor pressure, tangential
	12. flags"

	<primitive: 'primitiveReadTablet' module: 'JoystickTabletPlugin'>
	self primitiveFailed
! !

!InputEventSensor methodsFor: 'private - events' stamp: ''!
peekKeyboardEvent
	"Allows for use of old Sensor protocol to get at the keyboard,
	as when running kbdTest or the InterpreterSimulator in Morphic"

	^eventQueue findFirst: [:buf | self isKeyboardEvent: buf]! !

!InputEventSensor methodsFor: 'private' stamp: ''!
primTabletGetParameters: cursorIndex
	"Answer the pen tablet parameters. For parameters that differ from cursor to cursor, answer those associated with the cursor having the given index. Answer nil if there is no pen tablet. The parameters are:
	1. tablet width, in tablet units
	2. tablet height, in tablet units
	3. number of tablet units per inch
	4. number of cursors (pens, pucks, etc; some tablets have more than one)
	5. this cursor index
	6. and 7. x scale and x offset for scaling tablet coordinates (e.g., to fit the screen)
	8. and 9. y scale and y offset for scaling tablet coordinates  (e.g., to fit the screen)
	10. number of pressure levels
	11. presure threshold needed close pen tip switch 
	12. number of pen tilt angles"

	<primitive: 'primitiveGetTabletParameters' module: 'JoystickTabletPlugin'>
	^ nil
! !

!InputEventSensor methodsFor: 'private - events' stamp: ''!
modifiers
	"modifier keys; bitfield with the following entries:
		1	-	shift key
		2	-	ctrl key
		4	-	(Mac specific) option key
		8	-	Cmd/Alt key"

	"Fetch the next event if any to update state.
	Makes sure that the old polling methods consume events"

"	self nextEvent."
	

	^modifiers! !

!InputEventSensor methodsFor: 'modifier keys' stamp: ''!
commandKeyPressed
	"Answer whether the command key on the keyboard is being held down."

	^self modifiers anyMask: CommandKeyBit! !

!InputEventSensor methodsFor: 'mouse' stamp: ''!
waitButton
	"Wait for the user to press any mouse button and then answer with the 
	current location of the cursor."

	| delay |
	delay := Delay forMilliseconds: 50.
	[self anyButtonPressed] whileFalse: [ delay wait ].
	^self cursorPoint
! !

!InputEventSensor methodsFor: 'tablet' stamp: ''!
tabletPressure
	"Answer the current pressure of the first tablet pointing device (pen, puck, or eraser), a number between 0.0 (no pressure) and 1.0 (max pressure)"

	| params data |
	params := self primTabletGetParameters: 1.
	params ifNil: [^ self].
	data := self primTabletRead: 1.  "state of first/primary pen"
	^ (data at: 10) asFloat / ((params at: 10) - 1)
! !

!InputEventSensor methodsFor: 'tablet' stamp: ''!
hasTablet
	"Answer true if there is a pen tablet available on this computer."

	^ (self primTabletGetParameters: 1) notNil
! !

!InputEventSensor methodsFor: 'tablet' stamp: ''!
tabletPoint
	"Answer the current position of the first tablet pointing device (pen, puck, or eraser) in tablet coordinates."

	| data |
	data := self primTabletRead: 1.  "state of first/primary pen"
	^ (data at: 3) @ (data at: 4)
! !

!InputEventSensor methodsFor: 'mouse' stamp: ''!
redButtonPressed
	"Answer true if only the red mouse button is being pressed.
	This is the first mouse button, usually the left one."

	^(self mouseButtons bitAnd: ButtonsBitMask) = RedButtonBit
! !

!InputEventSensor methodsFor: 'events' stamp: ''!
handleEvent: evt

	self queueEvent: evt shallowCopy! !

!InputEventSensor methodsFor: 'private - events' stamp: ''!
mapButtons: buttons modifiers: anInteger
	"Map the buttons to yellow or blue based on the given modifiers.
	 If only the red button is pressed, then map
		Ctrl-RedButton -> YellowButtonBit.
		Cmd-RedButton -> BlueButtonBit.
	"

	buttons = RedButtonBit
		ifFalse: [ ^ buttons ].
	(anInteger allMask: CtrlKeyBit)
		ifTrue: [ ^ YellowButtonBit ].
	(anInteger allMask: CommandKeyBit)
		ifTrue: [ ^ BlueButtonBit ].
	^ buttons! !

!InputEventSensor methodsFor: 'joystick' stamp: ''!
joystickXY: index

	| inputWord x y |
	inputWord := self primReadJoystick: index.
	x := (inputWord bitAnd: 16r7FF) - 16r400.
	y := ((inputWord bitShift: -11) bitAnd: 16r7FF) - 16r400.
	^ x@y
	! !

!InputEventSensor methodsFor: 'tablet' stamp: ''!
tabletTimestamp
	"Answer the time (in tablet clock ticks) at which the tablet's primary pen last changed state. This can be used in polling loops; if this timestamp hasn't changed, then the pen state hasn't changed either."

	| data |
	data := self primTabletRead: 1.  "state of first/primary pen"
	^ data at: 2
! !

!InputEventSensor methodsFor: 'keyboard' stamp: ''!
keyboardPeek
	"Answer the next character in the keyboard buffer without removing it, or nil if it is empty."

	^ self characterForEvent: self peekKeyboardEvent! !

!InputEventSensor methodsFor: 'events' stamp: ''!
flushAllButDandDEvents! !

!InputEventSensor methodsFor: 'mouse' stamp: ''!
blueButtonPressed
	"Answer whether only the blue mouse button is being pressed. 
	This is the third mouse button or cmd+click on the Mac."

	^(self mouseButtons bitAnd: ButtonsBitMask) = BlueButtonBit
! !

!InputEventSensor methodsFor: 'mouse' stamp: ''!
yellowButtonPressed
	"Answer whether only the yellow mouse button is being pressed. 
	This is the second mouse button or option+click on the Mac."

	^(self mouseButtons bitAnd: ButtonsBitMask) = YellowButtonBit
! !

!InputEventSensor methodsFor: 'private - events' stamp: ''!
processMouseEvent: evt
	"Transmogrify the button state according to the platform's button map definition"
	evt
		at: MouseButtonIndexInEventBuffer
		put: (ButtonDecodeTable at: (evt at: MouseButtonIndexInEventBuffer) + 1).
	"Map the mouse buttons depending on modifiers"
	evt
		at: MouseButtonIndexInEventBuffer
		put:
			(self
				mapButtons: (evt at: MouseButtonIndexInEventBuffer)
				modifiers: (evt at: MouseModifierIndexInEventBuffer)).

	"Update state for polling calls"
	mousePosition := (evt at: MouseXCoordinateIndexInEventBuffer) @ (evt at: MouseYCoordinateIndexInEventBuffer).
	modifiers := evt at: MouseModifierIndexInEventBuffer.
	mouseButtons := evt at: MouseButtonIndexInEventBuffer.
	^ evt! !

!InputEventSensor methodsFor: 'events' stamp: ''!
flushEvents
	eventQueue ifNotNil:[eventQueue flush]! !

!InputEventSensor methodsFor: 'system startup' stamp: ''!
startUp
	self initialize! !

!InputEventSensor methodsFor: 'mouse' stamp: ''!
anyButtonPressed
	"Answer whether at least one mouse button is currently being pressed.
	 This can be checked by looking if any of the 3 bits representing the 3 mouse buttons states is set to 1."

	^self mouseButtons anyMask: ButtonsBitMask! !

!InputEventSensor methodsFor: 'tablet' stamp: ''!
tabletExtent
	"Answer the full tablet extent in tablet coordinates."

	| params |
	params := self primTabletGetParameters: 1.
	params ifNil: [^ self error: 'no tablet available'].
	^ (params at: 1)@(params at: 2)
! !

!InputEventSensor methodsFor: 'modifier keys' stamp: ''!
anyModifierKeyPressed
	"Answer whether at least one modifier key is currently being pressed.
	 This can be checked by looking if any of the 3 bits representing the state of cmd, opt and ctrl modifiers is set to 1."

	^self modifiers anyMask: ModifierKeysBitMask! !

!InputEventSensor methodsFor: 'cursor' stamp: ''!
cursorPoint
	"Answer a Point indicating the cursor location."

	"Fetch the next event if any to update state.
	Makes sure that the old polling methods consume events
	self nextEvent."

	^ mousePosition! !

!InputEventSensor methodsFor: 'keyboard' stamp: ''!
keyboard
	"Answer the next character from the keyboard."

	^self characterForEvent: self nextKeyboardEvent! !

!InputEventSensor methodsFor: 'system startup' stamp: ''!
shutDown! !

!InputEventSensor class methodsFor: 'class initialization' stamp: ''!
installMouseDecodeTable
	"Create a decode table that swaps the lowest-order 2 bits"
	ButtonDecodeTable := self swapMouseButtons
				ifTrue: [ByteArray withAll:
							((0 to: 255) collect: [:i |
								((i bitAnd: 1) << 1
									bitOr: (i bitAnd: 2) >> 1)
										bitOr: (i bitAnd: 16rFC) ])]
				ifFalse: [ByteArray withAll: (0 to: 255)]! !

!InputEventSensor class methodsFor: 'class initialization' stamp: ''!
installEventSensorFramework: fetcherClass
	"Installs the new sensor framework."

	| newSensor |
	"Do some extra cleanup"
	SessionManager default unregisterClassNamed: #InputEventFetcher.
	InputEventFetcher deinstall.

	newSensor := self new.
	fetcherClass install.
	newSensor registerIn: InputEventFetcher default.
	
	"Shut down old sensor"
	Sensor shutDown.
	SessionManager default unregisterClassNamed: Sensor class name.

	"Note: We must use #become: here to replace all references to the old sensor with the new one, since Sensor is referenced from all the existing controllers."
	Sensor becomeForward: newSensor. "done"

	"Register the interrupt handler"
	UserInterruptHandler new registerIn: InputEventFetcher default.

	SessionManager default 
		registerGuiClassNamed: Sensor class name 
		atPriority: 20.
	"Project spawnNewProcessAndTerminateOld: true"! !

!InputEventSensor class methodsFor: 'public' stamp: ''!
default
	"Answer the default system InputEventSensor, Sensor."

	^ Sensor! !

!InputEventSensor class methodsFor: 'class initialization' stamp: ''!
defaultCrossPlatformKeys
	"Answer a list of key letters that are used for common editing operations
	on different platforms."
	^{ $c . $x . $v . $a . $s . $f . $g . $z }
! !

!InputEventSensor class methodsFor: 'settings' stamp: ''!
swapMouseButtons
	^ Smalltalk os isWindows not! !

!InputEventSensor class methodsFor: 'class initialization' stamp: ''!
installEventSensorFramework
	"Installs the new sensor framework."
	"InputEventSensor installEventSensorFramework"

	self installEventSensorFramework: InputEventFetcher! !

Object subclass: #InputEventFetcher
	instanceVariableNames: 'eventHandlers fetcherProcess inputSemaphore'
	classVariableNames: 'Default'
	poolDictionaries: 'EventSensorConstants'
	package: 'System-VMEvents-Base'!

!InputEventFetcher methodsFor: 'initialization' stamp: ''!
terminateEventLoop
	"Terminate the event loop process. Terminate the old process if any."
	"InputEventFetcher default terminateEventLoop"

	fetcherProcess ifNotNil: 
		[ fetcherProcess terminate.
		fetcherProcess := nil	]! !

!InputEventFetcher methodsFor: 'handlers' stamp: ''!
unregisterHandler: handler
	self eventHandlers remove: handler ifAbsent: []! !

!InputEventFetcher methodsFor: 'initialization' stamp: ''!
startUp
	inputSemaphore := Semaphore new.
	self primSetInputSemaphore: (Smalltalk registerExternalObject: inputSemaphore).
	inputSemaphore consumeAllSignals.
	self installEventLoop! !

!InputEventFetcher methodsFor: 'private - events' stamp: ''!
primInterruptSemaphore: aSemaphore 
	"Primitive. Install the argument as the semaphore to be signalled whenever the user presses the interrupt key. The semaphore will be signaled once each time the interrupt key is pressed."

	<primitive: 134>
	^self primitiveFailed
"Note: This primitive was marked obsolete but is still used and actually quite useful. It could bre replace with a check in the event loop though, without a need for the now obsolete event tickler as event fetching isn't bound to the Morphic loop."! !

!InputEventFetcher methodsFor: 'events' stamp: ''!
waitForInput
	inputSemaphore wait.! !

!InputEventFetcher methodsFor: 'accessing' stamp: ''!
fetcherProcess 
	^ fetcherProcess ! !

!InputEventFetcher methodsFor: 'private - events' stamp: ''!
primSetInputSemaphore: semaIndex
	"Set the input semaphore the VM should use for asynchronously signaling the availability of events. Primitive. Optional."
	<primitive: 93>
	^nil! !

!InputEventFetcher methodsFor: 'events' stamp: ''!
eventLoop
	"Fetch pending raw events from the VM.
	 This method is run at high priority."
	| eventBuffer |

	eventBuffer := Array new: 8.
	
	[true] whileTrue: [
		| type window |
		self waitForInput.

		[self primGetNextEvent: eventBuffer.
		type := eventBuffer at: 1.
		type = EventTypeNone]
			whileFalse: [
				"Patch up the window index in case we don't get one"
				window := eventBuffer at: 8.
				(window isNil
					or: [window isZero])
					ifTrue: [eventBuffer at: 8 put: 1].	
						
				self signalEvent: eventBuffer]]! !

!InputEventFetcher methodsFor: 'private' stamp: ''!
eventHandlers
	^eventHandlers ifNil: [eventHandlers := OrderedCollection new]! !

!InputEventFetcher methodsFor: 'handlers' stamp: ''!
registerHandler: handler
	self eventHandlers add: handler! !

!InputEventFetcher methodsFor: 'initialization' stamp: ''!
shutDown
	self terminateEventLoop.
	inputSemaphore ifNotNil: [Smalltalk unregisterExternalObject: inputSemaphore]! !

!InputEventFetcher methodsFor: 'events' stamp: ''!
signalEvent: eventBuffer
	"Signal the event buffer to all registered event handlers.
	Handlers need make sure to copy the buffer or extract the data otherwise, as the buffer will be reused."

	self eventHandlers do: [:handler |
		handler handleEvent: eventBuffer]! !

!InputEventFetcher methodsFor: 'initialize-release' stamp: ''!
installEventLoop
	"Initialize the event loop process. Terminate the old process if any."
	"InputEventFetcher default installEventLoop"

	self terminateEventLoop.
	fetcherProcess := [self eventLoop] forkAt: Processor lowIOPriority.
	fetcherProcess name: 'Input Event Fetcher Process'! !

!InputEventFetcher methodsFor: 'private' stamp: ''!
primGetNextEvent: array
	"Store the next OS event available into the provided array.
	Essential."
	<primitive: 94>
	 array at: 1 put: EventTypeNone.
     ^nil
	! !

!InputEventFetcher class methodsFor: 'accessing' stamp: ''!
default
	"InputEventFetcher default"

	^Default ifNil: [Default := InputEventFetcher new]! !

!InputEventFetcher class methodsFor: 'class initialization' stamp: ''!
install
	"InputEventFetcher install"
	Default := self new.
	Default startUp.! !

!InputEventFetcher class methodsFor: 'class initialization' stamp: ''!
deinstall
	"InputEventFetcher deinstall"

	Default
		ifNotNil: [
			Default shutDown.
			Default := nil].
! !

"The HandMorph methods below use EventSensorConstants pool variables (EventTypeMouse,
EventTypeKeyboard, EventKeyDown, ...). The 32-bit build declares that pool in HandMorph;
the 64-bit build dropped it along with the classic event classes. Without it those names
compile as undeclared globals -- silently nil -- so every `type = EventTypeMouse` test is
false, nextEventFrom: falls through to ^ #invalid, and processEventsFromQueue: returns
before ever calling handleEvent:. The world then renders but ignores every click, which
is exactly the 'opens but does not respond' symptom. Add the pool BEFORE compiling them."
(HandMorph sharedPools includes: EventSensorConstants)
	ifFalse: [ HandMorph addSharedPool: EventSensorConstants ]!

!HandMorph methodsFor: 'squeakjs-compat'!
eventQueue
	^ Sensor! !

!HandMorph methodsFor: 'squeakjs-compat'!
generateDropFilesEvent: evtBuf 
	"Generate the appropriate mouse event for the given raw event buffer"

	"Note: This is still in an experimental phase and will need more work"

	| position buttons modifiers stamp numFiles dragType |
	stamp := evtBuf second.
	stamp = 0 ifTrue: [stamp := Time millisecondClockValue].
	dragType := evtBuf third.
	position := evtBuf fourth @ evtBuf fifth.
	buttons := 0.
	modifiers := evtBuf sixth.
	buttons := buttons bitOr: (modifiers bitShift: 3).
	numFiles := evtBuf seventh.
	dragType = 4 
		ifTrue: 
			["e.g., drop"

			owner borderWidth: 0.
			^DropFilesEvent new 
				setPosition: position
				contents: numFiles
				hand: self].
	"the others are currently not handled by morphs themselves"
	dragType = 1 
		ifTrue: 
			["experimental drag enter"

			owner
				borderWidth: 4;
				borderColor: owner color asColor negated].
	dragType = 2 
		ifTrue: 
			["experimental drag move"

			].
	dragType = 3 
		ifTrue: 
			["experimental drag leave"

			owner borderWidth: 0].
	^nil! !

!HandMorph methodsFor: 'squeakjs-compat'!
generateKeyboardEvent: evtBuf
	"Generate the appropriate mouse event for the given raw event buffer"

	| buttons modifiers type pressType stamp charCode keyValue keyEvent |
	stamp := evtBuf second.
	stamp = 0 ifTrue: [stamp := Time millisecondClockValue].
	pressType := evtBuf fourth.
	pressType = EventKeyDown
		ifTrue: [
			type := #keyDown.
			lastKeyScanCode := evtBuf third].
	pressType = EventKeyUp ifTrue: [type := #keyUp].
	pressType = EventKeyChar ifTrue: [
		type := #keystroke].
	modifiers := evtBuf fifth.
	buttons := modifiers bitShift: 3.
	keyValue := evtBuf third. 
	charCode := evtBuf sixth.

	"This piece of code handles the creation of scrolling events. When a scroll is done by the user, the VM forwards a keystroke event with the up/down key. So we reconvert it to a MouseWheelEvent in that case."
	(type = #keystroke 
	 and: [(buttons anyMask: 16) 
	  and: [{Character arrowUp. Character arrowDown} includes: (charCode asCharacter)]])
		ifTrue: [^ MouseWheelEvent
					fromCharacter: charCode asCharacter
					position: lastMouseEvent cursorPoint
					buttons: buttons
					hand: self
					stamp: stamp].

	"All control keys (tab, cr...) should be managed as keydown and ignored as text"	
	(type = #keystroke and: [
		charCode <= 31 or: [ (127 to: 159) includes: charCode ]])
		ifTrue: [ ^ #invalid ].

   "If charCode is not single-byte, we definately have Unicode input. Zero keyValue to avoid garbage values from som VMs."
   self flag: #pharoFixMe. "I need to look at the windows vm side, to see why this keyvalue is generated in the first place".

   (charCode notNil and:[charCode > 255]) ifTrue: [keyValue:=0].
	keyEvent := KeyboardEvent new
		setType: type
		buttons: buttons
		position: self position
		keyValue: keyValue
		charCode: (type == #keystroke 
			ifTrue: [ charCode ]
			ifFalse: [ self mapSymbolToKeyValue: keyValue ])
		hand: self
		stamp: stamp.
	
	"If a modifier key is pressed the keystroke event is handled by #visitMouseDownEvent:"
	(type == #keystroke
		and: [ keyEvent commandKeyPressed
			or: [ keyEvent controlKeyPressed ] ])
				ifTrue: [ ^ #invalid ].
	
	keyEvent scanCode: lastKeyScanCode.
	^keyEvent! !

!HandMorph methodsFor: 'squeakjs-compat'!
generateMouseEvent: evtBuf 
	"Generate the appropriate mouse event for the given raw event buffer"

	| position buttons modifiers type trail stamp oldButtons evtChanged |
	self class environment at: #KMBuffer ifPresent: [ :kmBuffer | kmBuffer uniqueInstance clearBuffer].
	evtBuf first = lastEventBuffer first 
		ifTrue: 
			["Workaround for Mac VM bug, *always* generating 3 events on clicks"

			evtChanged := false.
			3 to: evtBuf size
				do: [:i | (lastEventBuffer at: i) = (evtBuf at: i) ifFalse: [evtChanged := true]].
			evtChanged ifFalse: [^nil]].
	stamp := evtBuf second.
	stamp = 0 ifTrue: [stamp := Time millisecondClockValue].
	position := evtBuf third @ evtBuf fourth.
	buttons := evtBuf fifth.
	modifiers := evtBuf sixth.
	type := buttons = 0 
		ifTrue: 
			[lastEventBuffer fifth = 0 ifTrue: [#mouseMove] ifFalse: [#mouseUp]]
		ifFalse: 
			[lastEventBuffer fifth = 0 
						ifTrue: [#mouseDown]
						ifFalse: [#mouseMove]].
	buttons := buttons bitOr: (modifiers bitShift: 3).
	oldButtons := lastEventBuffer fifth 
				bitOr: (lastEventBuffer sixth bitShift: 3).
	lastEventBuffer := evtBuf.
	type == #mouseMove 
		ifTrue: 
			[trail := self mouseTrailFrom: evtBuf.
			^MouseMoveEvent basicNew 
				setType: type
				startPoint: (self position)
				endPoint: trail last
				trail: trail
				buttons: buttons
				hand: self
				stamp: stamp].
	^MouseButtonEvent basicNew 
		setType: type
		position: position
		which: (oldButtons bitXor: buttons)
		buttons: buttons
		hand: self
		stamp: stamp! !

!HandMorph methodsFor: 'squeakjs-compat'!
generateWindowEvent: evtBuf 
	"Generate the appropriate window event for the given raw event buffer"

	| evt |
	evt := WindowEvent new.
	evt setTimeStamp: evtBuf second.
	evt timeStamp = 0 ifTrue: [evt setTimeStamp: Time millisecondClockValue].
	evt action: evtBuf third.
	evt rectangle: (Rectangle origin: evtBuf fourth @ evtBuf fifth corner: evtBuf sixth @ evtBuf seventh ).
	
	^evt! !

!HandMorph methodsFor: 'squeakjs-compat'!
mouseTrailFrom: currentBuf 
  "Current event, a mouse event buffer, is about to be processed.  If there are other similar mouse events queued up, then drop them from the queue, and report the positions inbetween."

  | nextEvent trail |
  trail := (Array new: 1) writeStream.
  trail nextPut: currentBuf third @ currentBuf fourth.
  [(nextEvent := Sensor peekEvent) isNil] whileFalse: 
      [nextEvent first = currentBuf first 
        ifFalse: [^trail contents "different event type"].
      nextEvent fifth = currentBuf fifth 
        ifFalse: [^trail contents "buttons changed"].
      nextEvent sixth = currentBuf sixth 
        ifFalse: [^trail contents "modifiers changed"].
      "nextEvent is similar.  Remove it from the queue, and check the next."
      nextEvent := Sensor nextEvent.
      nextEvent 
        ifNotNil: [ trail nextPut: nextEvent third @ nextEvent fourth ]].
  ^trail contents! !

!HandMorph methodsFor: 'squeakjs-compat'!
nextEventFrom: anEventBufferQueue
	"Returns the next morphic event to handle.
	Three cases may arise:
	 - If possible, a valid morphic event is returned
	 - If no more events are available, nil is returned
	 - If we find an invalid event in the queue, we consume it and return the #invalid symbol
	
	The first morphic events available are those in the pending queue.
	An event handling cycle should generate and manage a single event.
	In the case a cycle needs to generate several events (see MouseClickState), only one event is handled.
	Remaining events are queued for later processing.
	"
	| eventBuffer morphicEvent type pendingMorphicEvent |
	
	pendingMorphicEvent := self pendingEventQueue nextOrNil.
	pendingMorphicEvent ifNotNil: [ ^ pendingMorphicEvent ].
	
	anEventBufferQueue ifNil: [ ^ nil ].
	eventBuffer := anEventBufferQueue nextEvent.
	eventBuffer ifNil: [ ^ nil ].
	
	morphicEvent := nil.	"for unknown event types"
	type := eventBuffer first.
	type = EventTypeMouse ifTrue: [ self world beCursorOwner.
		recentModifiers := eventBuffer sixth.
		morphicEvent := self generateMouseEvent: eventBuffer
	].
	type = EventTypeKeyboard ifTrue: [
		recentModifiers := eventBuffer fifth.
		morphicEvent := self generateKeyboardEvent: eventBuffer
	].
	type = EventTypeDragDropFiles ifTrue: [ 
		morphicEvent := self generateDropFilesEvent: eventBuffer ].
	type = EventTypeWindow ifTrue: [ 
		morphicEvent := self generateWindowEvent: eventBuffer ].
	
	"If the event did not match any of the categories above, it is an invalid event"
	( type ~= EventTypeDragDropFiles and: [ morphicEvent isNil ] )
		ifTrue: [ ^ #invalid ].
	^ morphicEvent! !

!HandMorph methodsFor: 'squeakjs-compat'!
processEventsFromQueue: anEventBufferQueue

	"Process user input events from the local input devices."

	| evt |

	[ (evt := self nextEventFrom: anEventBufferQueue) notNil ] whileTrue: [ 
		evt == #invalid ifTrue: [ ^ self ].
		evt ifNotNil: [ "Finally, handle it"
			self handleEvent: evt.
			"For better user feedback, return immediately after a mouse event has been processed."
			( evt isMouse and: [ evt isMouseWheel not ] )
				ifTrue: [ ^ self ]
		]
	].
	
	"note: if we come here we didn't have any mouse events"
	mouseClickState notNil ifTrue: [ 
		"No mouse events during this cycle. Make sure click states time out accordingly"
		mouseClickState handleEvent: lastMouseEvent asMouseMove from: self ].! !

!HandMorph methodsFor: 'squeakjs-compat'!
processEvents
	^ self processEventsFromQueue: self eventQueue! !

"--- DisplayScreen classic protocol (dropped from 64-bit builds) ---"!

!DisplayScreen methodsFor: 'private' stamp: ''!
beDisplay
	"Primitive. Tell the interpreter to use the receiver as the current display 
	image. Fail if the form is too wide to fit on the physical display. 
	Essential. See Object documentation whatIsAPrimitive."

	<primitive: 102>
	self primitiveFailed! !

!DisplayScreen methodsFor: 'other' stamp: ''!
primitiveDeferUpdates: aBoolean
	"Set the deferUpdates flag in the virtual machine. When this flag is true, BitBlt operations on the Display are not automatically propagated to the screen. If this underlying platform does not support deferred updates, this primitive will fail. Answer the receiver if the primitive succeeds, nil if it fails."

	<primitive: 126>
	^ nil  "answer nil if primitive fails"
! !

!DisplayScreen methodsFor: 'displaying' stamp: ''!
forceDamageToScreen: allDamage
	"Force all the damage rects to the screen."
	| regions rectList |
	rectList := allDamage.
	"Note: Reset extra regions at the beginning to prevent repeated errors"
	regions := extraRegions.
	extraRegions := nil.
	regions ifNotNil:[
		"exclude extra regions"
		regions do:[:drawerAndRect| | excluded remaining |
			excluded := drawerAndRect at: 2.
			remaining := Array new writeStream.
			rectList do:[:r|
				remaining nextPutAll:(r areasOutside: excluded)].
			rectList := remaining contents].
	].
	rectList do:[:r| self forceToScreen: r].
	regions ifNotNil:[
		"Have the drawers paint what is needed"
		regions do:[:drawerAndRect| (drawerAndRect at: 1) forceToScreen].
	].! !

!DisplayScreen methodsFor: 'private' stamp: ''!
primShowRectLeft: l right: r top: t bottom: b
	"Copy the given rectangular section of the Display to to the screen. This primitive is not implemented on all platforms. If this fails, retry integer coordinates."

	<primitive: 127>
	"if this fails, coerce coordinates to integers and try again"
	self primRetryShowRectLeft: l truncated
		right: r rounded
		top: t truncated
		bottom: b rounded.
! !

!DisplayScreen methodsFor: 'other' stamp: ''!
forceToScreen
	"Force the entire display area to the screen"
	^self forceToScreen: self boundingBox! !

!DisplayScreen methodsFor: 'private' stamp: ''!
primRetryShowRectLeft: l right: r top: t bottom: b
	"Copy the given rectangular section of the Display to to the screen. This primitive is not implemented on all platforms. Do nothing if it fails. "

	<primitive: 127>
	"do nothing if primitive fails"
! !

!DisplayScreen methodsFor: 'other' stamp: ''!
forceDisplayUpdate
	"On platforms that buffer screen updates, force the screen to be updated immediately. On other platforms, or if the primitive is not implemented, do nothing."

	<primitive: 231>
	"do nothing if primitive fails"! !

!DisplayScreen methodsFor: 'other' stamp: ''!
forceToScreen: aRectangle
	"Force the given rectangular section of the Display to be copied to the screen. The primitive call does nothing if the primitive is not implemented. Typically used when the deferUpdates flag in the virtual machine is on; see deferUpdates:."

	self primShowRectLeft: aRectangle left
		right: aRectangle right
		top: aRectangle top
		bottom: aRectangle bottom.
! !

!DisplayScreen class methodsFor: 'host window access' stamp: ''!
primitiveWindowSize: id width: width heigth: height 
	<primitive: 'primitiveHostWindowSizeSet' module: 'HostWindowPlugin'>
	"ignore failure"! !

"deferUpdates: is what actually switches the VM into batched (deferred) drawing. The 64-bit
build's version never reaches primitive 126, so every single BitBlt was pushed straight to
the screen: a fading growl notification redrew ~300 times per second and looked like it was
flickering / reopening, instead of fading in one frame per Morphic cycle (32-bit does 1 draw
per cycle). Restore the 32-bit implementation. DeferringUpdates is a class variable there;
add it first, since compiling against a name that does not exist would silently bind it to
an undeclared nil global."
[ DisplayScreen addClassVarNamed: #DeferringUpdates ] on: Error do: [ :e | ]!

!DisplayScreen methodsFor: 'deferring' stamp: ''!
deferUpdates: aBoolean
	^ self class deferUpdates: aBoolean! !

!DisplayScreen class methodsFor: 'deferring' stamp: ''!
deferUpdates: aBoolean
	"Set the deferUpdates flag in the virtual machine. When this flag is true, BitBlt operations on the Display are not automatically propagated to the screen. If this underlying platform does not support deferred updates, this primitive will fail. Answer whether updates were deferred before if the primitive succeeds, nil if it fails."
	| wasDeferred |
	wasDeferred := DeferringUpdates == true.
	DeferringUpdates := aBoolean.
	^ (self primitiveDeferUpdates: aBoolean) ifNotNil: [ wasDeferred ]! !

!DisplayScreen class methodsFor: 'deferring' stamp: ''!
primitiveDeferUpdates: aBoolean
	"Set the deferUpdates flag in the virtual machine. When this flag is true, BitBlt operations on the Display are not automatically propagated to the screen. If this underlying platform does not support deferred updates, this primitive will fail. Answer the receiver if the primitive succeeds, nil if it fails."

	<primitive: 126>
	^ nil  "answer nil if primitive fails"! !

!DisplayScreen class methodsFor: 'host window access' stamp: ''!
primitiveWindowTitle: id string: titleString 
	<primitive: 'primitiveHostWindowTitle' module:'HostWindowPlugin'>
	"ignore failure"! !

!DisplayScreen class methodsFor: 'display box access' stamp: ''!
depth: depthInteger width: widthInteger height: heightInteger fullscreen: aBoolean
	"Force Pharo's window (if there's one) into a new size and depth."
	"DisplayScreen depth: 8 width: 1024 height: 768 fullscreen: false"

	<primitive: 92>
	self primitiveFailed ! !

!DisplayScreen class methodsFor: 'host window access' stamp: ''!
refreshHostWindowTitle
	Title ifNotNil: [ self hostWindowTitle: Title ]! !

!DisplayScreen class methodsFor: 'host window access' stamp: ''!
primitiveWindowIcon: id path: pathString
	<primitive: 'primitiveHostWindowIcon' module: 'HostWindowPlugin' error: ec>
	(pathString isKindOf: AbstractFileReference) ifTrue: [ ^ self primitiveWindowIcon: id path: pathString fullName ].
	ec == #'bad argument'
		ifTrue: [ pathString isString ifFalse: [ ^ self error: 'The path should be a String' ].
			^ pathString asFileReference
				ifExists: [ self error: 'File existing but not found by the VM sorry, try another location...'	"Not reproductible in the tests but can happen" ]
				ifAbsent: [ :file | FileDoesNotExistException signalOnFile: file ] ].
	self primitiveFailed! !

!DisplayScreen class methodsFor: 'host window access' stamp: ''!
hostWindowIndex
	^ 1! !

!DisplayScreen class methodsFor: 'host window access' stamp: ''!
resetTitle
	<script>
	self hostWindowTitle: 'Pharo Virtual Machine!! (', SmalltalkImage current imagePath ,')'! !

!DisplayScreen class methodsFor: 'host window access' stamp: ''!
hostWindowSize: aPoint 
	self primitiveWindowSize: self hostWindowIndex width: aPoint x heigth: aPoint y
! !

!DisplayScreen class methodsFor: 'host window access' stamp: ''!
setWindowTitle: aTitle
	Title := aTitle.
	self refreshHostWindowTitle! !

!DisplayScreen class methodsFor: 'host window access' stamp: ''!
hostWindowIcon: aPath
	^ self primitiveWindowIcon: self hostWindowIndex path: aPath! !

Object subclass: #VMDisplayDeferredUpdateMode
	instanceVariableNames: ''
	classVariableNames: ''
	package: 'Morphic-Core-Worlds'!

!VMDisplayDeferredUpdateMode methodsFor: 'update'!
updateDamage: damage ofWorld: aWorld onRenderer: renderer
	renderer forceDamageToScreen: damage! !

Object subclass: #VMDisplayDirectUpdateMode
	instanceVariableNames: ''
	classVariableNames: ''
	package: 'Morphic-Core-Worlds'!

!VMDisplayDirectUpdateMode methodsFor: 'update'!
updateDamage: damage ofWorld: aWorld onRenderer: aRenderer
	aRenderer canvas
		showAt: aWorld viewBox origin
		invalidRects: damage! !

!Cursor methodsFor: 'primitives' stamp: ''!
beCursor
	self primitiveBeCursor! !

!Cursor methodsFor: 'primitives' stamp: ''!
primitiveBeCursorWithMask: maskForm
	"Primitive. Tell the interpreter to use the receiver as the current cursor image with the given mask Form. Both the receiver and the mask should have extent 16@16 and a depth of one. The mask and cursor bits are combined as follow:
			mask	cursor	effect
			 0		  0		transparent (underlying pixel shows through)
			 1		  1		opaque black
			 1		  0		opaque white
			 0		  1		invert the underlying pixel"
"Essential. See Object documentation whatIsAPrimitive."

	<primitive: 101>
	self primitiveFailed
! !

!Cursor methodsFor: 'primitives' stamp: ''!
beCursorWithMask: maskForm
	self primitiveBeCursorWithMask: maskForm! !

!Cursor methodsFor: 'primitives' stamp: ''!
primitiveBeCursor
	"Primitive. Tell the interpreter to use the receiver as the current cursor 
	image. Fail if the receiver does not match the size expected by the 
	hardware. Essential. See Object documentation whatIsAPrimitive."

	<primitive: 101>
	self primitiveFailed! !

!CursorWithMask methodsFor: 'primitives' stamp: ''!
beCursor
	maskForm unhibernate.
	^ self beCursorWithMask: maskForm! !

AbstractWorldRenderer subclass: #VMWorldRenderer
	instanceVariableNames: 'display canvas deferredUpdateMode'
	classVariableNames: ''
	package: 'Morphic-Core-Worlds'!

!VMWorldRenderer methodsFor: 'accessing' stamp: ''!
canvas: x 
	canvas := x! !

!VMWorldRenderer methodsFor: 'activation' stamp: ''!
deactivate

	InputEventSensor default shutDown.
	
	Display shutDown.

	InputEventFetcher default shutDown.
! !

!VMWorldRenderer methodsFor: 'activation' stamp: ''!
doActivate

    InputEventFetcher default startUp.
    InputEventSensor installMouseDecodeTable.
    InputEventSensor default startUp.
    
    Display setExtent: self actualScreenSize depth: 32.
    Display beDisplay.

    canvas := nil.
    display := nil.

    self assuredCanvas.
    DisplayScreen refreshHostWindowTitle.
    Display forceDisplayUpdate.
    world displayWorld.! !

!VMWorldRenderer methodsFor: 'accessing' stamp: ''!
actualScreenSize

	<primitive: 106>

	self primitiveFailed! !

!VMWorldRenderer methodsFor: 'accessing' stamp: ''!
canvas

	^ canvas! !

!VMWorldRenderer methodsFor: 'display box access' stamp: ''!
assuredCanvas
	(self canvas isNil
		or: [ self canvas extent ~= self viewBox extent
				or: [ self canvas form depth ~= Display depth ] ])
		ifTrue:
			[ "allocate a new offscreen canvas the size of the window" 
				self canvas: (Display defaultCanvasClass extent: self viewBox extent) ].
	^ self canvas! !

!VMWorldRenderer methodsFor: 'operations' stamp: ''!
forceDamageToScreen: allDamage

	^ Display forceDamageToScreen: allDamage.
	! !

!VMWorldRenderer methodsFor: 'display box access' stamp: ''!
usableArea

	^ Display usableArea! !

!VMWorldRenderer methodsFor: 'operations' stamp: ''!
fullscreenMode: aValue

	Display fullscreenMode: aValue.
	self checkForNewScreenSize.! !

!VMWorldRenderer methodsFor: 'operations' stamp: ''!
updateDamage: allDamage
	
	"quickly copy altered rects of canvas to Display:"
	deferredUpdateMode
		updateDamage: allDamage
		ofWorld: world
		onRenderer: self.! !

!VMWorldRenderer methodsFor: 'display box access' stamp: ''!
checkForNewScreenSize

	"Check whether the screen size has changed and if so take appropriate actions"

	Display extent = DisplayScreen actualScreenSize ifTrue: [^ Display].

   Display setExtent: self actualScreenSize depth: 32.
   Display beDisplay.

	world worldState realWindowExtent: self actualScreenSize.

	world restoreMorphicDisplay.
! !

!VMWorldRenderer methodsFor: 'operations' stamp: ''!
deferUpdatesDuring: aBlock

	| previousDeferredUpdateMode |
	previousDeferredUpdateMode := deferredUpdateMode.
	[deferredUpdateMode := (self doDeferredUpdatingFor: world)
		ifTrue: [ VMDisplayDeferredUpdateMode new ]
		ifFalse: [ self assuredCanvas. VMDisplayDirectUpdateMode new ].
	
	aBlock value
	
	] ensure: [ 
		deferredUpdateMode := previousDeferredUpdateMode.
		self deferUpdates: false.
		self forceDisplayUpdate ]! !

!VMWorldRenderer methodsFor: 'accessing' stamp: ''!
icon: aForm 

	"Do nothing.
	This is not supported anymore with the old VM world renderers.
	Use the new headless + SDL instead.
	
	Alternatively, if you're on windows you can try to use the following primitive from DisplayScreen that receives a path to a .ico file.
	This primitive only works on Windows.
	
	DisplayScreen hostWindowIcon: path.
	"! !

!VMWorldRenderer methodsFor: 'operations' stamp: ''!
deferUpdates: aValue

	^ Display deferUpdates: aValue! !

!VMWorldRenderer methodsFor: 'rendering' stamp: ''!
invalidate

	self canvas: nil! !

!VMWorldRenderer methodsFor: 'operations' stamp: ''!
drawDuring: aBlock
	
	self canvas ifNotNil: [ 
		aBlock value: self canvas.
	]! !

!VMWorldRenderer methodsFor: 'display box access' stamp: ''!
viewBox 

	^ Display boundingBox! !

!VMWorldRenderer methodsFor: 'operations' stamp: ''!
forceDisplayUpdate

	^ Display forceDisplayUpdate! !

!VMWorldRenderer methodsFor: 'operations' stamp: ''!
activateCursor: aCursor withMask: maskForm

	aCursor beCursorWithMask: maskForm
! !

!VMWorldRenderer methodsFor: 'operations' stamp: ''!
doDeferredUpdatingFor: aWorld
"If this platform supports deferred updates, then make my canvas be the Display (or a rectangular portion of it), set the Display to deferred update mode, and answer true. Otherwise, do nothing and answer false. One can set the class variable DisableDeferredUpdates to true to completely disable the deferred updating feature."

	(Display deferUpdates: true) ifNil: [^ false].  "deferred updates not supported"

	(self canvas notNil and: [self canvas form == Display]) ifFalse: [
			aWorld viewBox: self viewBox.    "do first since it may clear canvas"
			self canvas: (Display getCanvas copyClipRect: Display boundingBox)].

	^ true! !

!VMWorldRenderer class methodsFor: 'accessing' stamp: ''!
priority 

	^ 1! !

!VMWorldRenderer class methodsFor: 'accessing' stamp: ''!
isApplicableFor: aWorld

    ^ Smalltalk isHeadless not! !

InputEventSensor installMouseDecodeTable!

| newSensor |
newSensor := InputEventSensor new.
InputEventFetcher install.
newSensor registerIn: InputEventFetcher default.
Smalltalk globals at: #Sensor put: newSensor!

AbstractWorldRenderer classPool at: #MainWorldRenderer put: nil!

UIManager default: UIManager forCurrentSystemConfiguration!
