module('lib.squeak.ui').requires("lively.data.FileUpload").toRun(function() {

lively.data.FileUpload.Handler.subclass('lib.squeak.ui.SqueakLoader', {
    handles: function(file) {
        return file.type == 'application/squeak-image' || file.name.match(/\.image$/);
    },
    getUploadSpec: function(evt, file) {
        return {readMethod: "asArrayBuffer"}
    },
    onLoad: function(evt) {
        this.openImage(this.file.name, this.file.type, evt.target.result, this.pos);
    },
    openImage: function(name, mime, buffer, pos) {
        var morph = this.findSqueakMorph();
        if (morph) return morph.loadImageFromBuffer(buffer, name);
        alert("Please open a Squeak morph first");
    },
    findSqueakMorph: function() {
        return $world.submorphs.detect(function(morph){return !!morph.loadImageFromBuffer});
    },
});

}) // end of module
