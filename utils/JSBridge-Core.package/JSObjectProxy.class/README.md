A JSObjectProxy is a proxy for JavaScript objects. It intercepts messages to look up named properties, and call them if they are functions. Arguments are converted from Squeak to JavaScript objects for nil, Booleans, SmallIntegers, Floats, Strings, Arrays, and Dictionaries. The result is converted back to Squeak objects for numbers and null/true/false, otherwise wrapped in a new JSObjectProxy. To add new properties, or access existing properties without calling them (if they are functions), use at:/at:put:. In addition, sending #new/#new:... creates an instance of that object, and #typeof returns the type as a string. There is a global proxy named JS to allow accessing global JavasScript objects.

"Call global function"
JS alert: 'Squeak says Hello World!'.

"Call function on global object"
JS console log: 'Squeak says Hello World!'.

"Modify DOM"
((JS document getElementsByTagName: 'h1') at: 0)
	at: 'innerHTML' put: 'Squeak said Hello World at ', Time now asString.

"Create new Object, add and retrieve property"
| obj |
obj := JS Object new.
obj at: #someProp put: 42.
obj someProp

"Create a function and call it"
| func |
func := JS Function new: 'arg0' and: 'arg1' body: 'return arg0 + arg1'.
func call: nil with: 3 and: 4.

"Create an object with a literal object property and a method and call it"
| obj |
obj := JS Object new.
obj at: #myProp put: {#a -> 6. #b -> 7}.
obj at: #myMethod put: (JS Function new: 'return this.myProp.a * this.myProp.b').
obj myMethod

"Inspect all properties in global navigator object"
| object propNames propValues |
object := JS navigator.
propNames := JS Object keys: object.
propValues := (0 to: propNames length - 1) collect: [:i |
	(propNames at: i) -> (object at: (propNames at: i))].
(propValues as: Dictionary) inspect
