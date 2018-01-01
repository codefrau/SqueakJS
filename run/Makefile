# File: Makefile
# Author: Bert Freudenberg
#
# concatenate all SqueakJS files into squeak-all.js
# replace ../squeak.js with squeak-all.js in index.html
# copy to publishing directory and create an offline manifest

TARGET=../gh-pages/run
BUILD=build
MANIFEST=$(TARGET)/offline.appcache
SQUEAKJS=../squeak.js
SQUEAKJSLIBS=../vm.js ../jit.js ../plugins/*.js ../lib/lz-string.js ../lib/jszip.js
ORGFILES=$(SQUEAKJS) $(SQUEAKJSLIBS) index.html
GENFILES=squeak.min.js squeak.min.js.map $(BUILD)/index.html
CPFILES=squeakjs.css squeakjs.png
CLOSURE_COMPILER_DIR=closure-compiler
CLOSURE_COMPILER=java -jar $(CLOSURE_COMPILER_DIR)/closure-compiler*.jar

OS=$(shell uname)
ifeq ($(OS),Darwin)
	STAT=stat -f '%Sm'
else
	STAT=stat -c '%z'
endif
NEWEST=$(shell ls -t $(ORGFILES) $(CPFILES) | head -n1)
DATE=$(shell $(STAT) $(NEWEST))

VERSION=$(shell grep 'vmVersion:.*".*"' ../vm.js | sed 's/^[^"]*"//;s/".*//')

$(MANIFEST): Makefile $(TARGET) $(GENFILES) $(CPFILES)
	@echo generate: $@
	@rm -f $@
	@# generate unique header from date
	@echo 'CACHE MANIFEST\n#' $(DATE) > $@
	@# append file name to manifest, and copy file to target
	@for f in $(GENFILES) $(CPFILES); do F=`basename $$f`; echo $$F >> $@ ; install -pvm 444 $$f $(TARGET); done
	@# allow accessing all URLs
	@echo 'NETWORK:' >> $@
	@echo '*' >> $@
	@# make read-only
	@chmod 444 $@
	@# remove temp files
	@rm -rf $(GENFILES) $(BUILD)

$(TARGET):
	@mkdir -pv $@

$(BUILD):
	@mkdir -pv $@

squeak.min.js: Makefile $(SQUEAKJS) $(SQUEAKJSLIBS) $(CLOSURE_COMPILER_DIR)
	$(CLOSURE_COMPILER) --js_output_file $@ \
		--create_source_map $@.map \
		--output_wrapper "%output% //# sourceMappingURL=$@.map" \
		--compilation_level SIMPLE \
		--language_in ECMASCRIPT5_STRICT \
		$(SQUEAKJS) $(SQUEAKJSLIBS)

squeak.min.js.map: squeak.min.js

$(CLOSURE_COMPILER_DIR):
	mkdir $@
	curl https://dl.google.com/closure-compiler/compiler-latest.zip -o $@/c.zip
	unzip -d $@ $@/c.zip
	rm $@/c.zip

$(BUILD)/index.html: index.html $(BUILD)
	@# replace ../squeak.js with squeak.min.js
	@sed 's|../squeak.js|squeak.min.js|' $< > $@

.SECONDARY: $(BUILD) $(GENFILES)
