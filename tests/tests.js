__karma__.start = function() {
    var canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    canvas.style.backgroundColor = 'black';
    document.body.appendChild(canvas);
    SqueakJS.runSqueak(null, canvas, {
        appName: 'SqueakJS Tests',
        url: 'base/tests/resources/',
        files: ['test.image', 'test.changes', 'SqueakV50.sources', 'tests.ston'],
        document: 'tests.st',
        forceDownload: true,
        onQuit: function() {
            __karma__.complete();
        },
    });
};