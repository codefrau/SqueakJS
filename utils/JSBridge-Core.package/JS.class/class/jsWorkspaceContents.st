class initialization
jsWorkspaceContents
	"Create symbols in advance"
	#(alert: console log: document getElementsByTagName: new:and:body: call:with:and: navigator Object keys: Function length).
	^ 'Besides running regular Squeak images, SqueakJS can directly use JavaScript. It can interact with the DOM, access JavaScript libraries, and use Smalltalk code to create an interactive HTML interface. Try these examples:

"Call global function"
JS alert: ''Squeak says Hello World!''.

"Call function on global object (open developer tools to see output)"
JS console log: ''Squeak says Hello World!''.

"Modify DOM"
((JS document getElementsByTagName: ''h1'') at: 0)
	at: ''innerHTML'' put: ''Squeak said Hello World at '', Time now asString.

"Create new Object, add and retrieve property"
| obj |
obj := JS Object new.
obj at: #someProp put: 42.
obj someProp

"Create a function and call it"
| func |
func := JS Function new: ''arg0'' and: ''arg1'' body: ''return arg0 + arg1''.
func call: nil with: 3 and: 4.

"Create an object with a property and a method and call it"
| obj |
obj := JS Object new.
obj at: #myProp put: 6.
obj at: #myMethod put: (JS Function new: ''return this.myProp * 7'').
obj myMethod

"Inspect all properties in global navigator object"
| object propNames propValues |
object := JS navigator.
propNames := JS Object keys: object.
propValues := (0 to: propNames length - 1) collect: [:i |
	(propNames at: i) -> (object at: (propNames at: i))].
(propValues as: Dictionary) inspect
'
