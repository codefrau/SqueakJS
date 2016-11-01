FileStream stdout converter: UTF8TextConverter new.
FileStream stdout nextPutAll: 'Hi'; cr.
SmalltalkCI test: 'tests.ston'.
FileStream stdout nextPutAll: 'Bye'; cr.
Smalltalk quitPrimitive