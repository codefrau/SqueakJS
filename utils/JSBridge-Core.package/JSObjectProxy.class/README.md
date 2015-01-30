A JSObjectProxy is a proxy for JavaScript objects. It intercepts messages to look up named properties, and call them if they are functions. Arguments are converted from Squeak to JavaScript objects for nil, Booleans, SmallIntegers, Floats, Strings, Arrays, and Dictionaries. The result is converted back to Squeak objects for numbers and null/true/false, otherwise wrapped in a new JSObjectProxy. To add new properties, or access existing properties without calling them (if they are functions), use at:/at:put:. In addition, sending #new/#new:... creates an instance of that object, and #typeof returns the type as a string. There is a global proxy named JS to allow accessing global JavaScript objects.

"Call global function"
JS alert: 'Squeak says Hello World!'.

"Call function on global object (open console to see result)"
JS console log: 'Squeak says Hello World!'.

"Modify DOM"
((JS document getElementsByTagName: 'h1') at: 0)
	at: 'innerHTML' put: 'Squeak said Hello World at ', Time now asString.

"Create new Object, add properties and a method, retrieve property, call method"
| obj |
obj := JS Object new.
obj at: #someProp put: 42.
obj at: #complexProp put: {#a -> 3. #b -> 4}.
obj at: #someMethod put: (JS Function new: 'return this.complexProp.a + this.complexProp.b').
{obj someProp. obj complexProp. obj someMethod}

"Inspect all properties in global navigator object"
| object propNames propValues |
object := JS navigator.
propNames := JS Object keys: object.
propValues := (0 to: propNames length - 1) collect: [:i |
	(propNames at: i) -> (object at: (propNames at: i))].
(propValues as: Dictionary) inspect

"A Squeak block becomes a JavaScript callback function"
JS at: #sqPlus put: [:arg0 :arg1 |
	Transcript show: 'sqPlus called with ', arg0 asString, ' and ', arg1 asString; cr.
	arg0 + arg1].
"JavaScript can call it later"
JS setTimeout: 'alert("Result: " + sqPlus(3,4))' ms: 1000
"also try e.g. sqPlus(3.5, 4.5) in the browser's console"

"Load jQuery, and compile a helper method"
| script |
(JS at: #jQuery) ifNil: [
	script := JS document createElement: 'SCRIPT'.
	script at: 'src' put: 'https://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js'.
	script at: 'type' put: 'text/javascript'.
	((JS document getElementsByTagName: 'head') at: 0) appendChild: script.
].
String compile: 'asJQuery ^JS jQuery: self' classified: '*mystuff' notifying: nil.

"Use jQuery"
'canvas' asJQuery hide: 'slow'; show: 'fast'.

'h1' asJQuery css: {'color'->'red'. 'text-shadow' -> '0 2px white, 0 3px #777'}.

'<button>' asJQuery text: 'Hi'; click: [Transcript show: 'hi'; cr]; appendTo: 'h1'.
