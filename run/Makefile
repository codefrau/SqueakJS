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
SQUEAKJSLIBS=../vm.js ../jit.js ../plugins/*.js ../lib/lz-string.js
ORGFILES=$(SQUEAKJS) $(SQUEAKJSLIBS) index.html
GENFILES=$(BUILD)/squeak-all.js $(BUILD)/index.html
CPFILES=squeakjs.css squeakjs.png

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
	@# generate unique header from date
	@echo 'CACHE MANIFEST\n#' $(DATE) > $@
	@# append file name to manifest, and copy file to target
	@for f in $(GENFILES) $(CPFILES); do F=`basename $$f`; echo $$F >> $@ ; install -pvm 444 $$f $(TARGET); done
	@# allow accessing all URLs
	@echo 'NETWORK:' >> $@
	@echo '*' >> $@
	@# remove temp files
	@rm -rf $(BUILD)

$(TARGET):
	@mkdir -pv $@

$(BUILD):
	@mkdir -pv $@

$(BUILD)/squeak-all.js: $(BUILD) Makefile $(SQUEAKJS) $(SQUEAKJSLIBS)
	@# generate header comment
	@echo "/* $(VERSION)" > $@
	@echo " *" >> $@
	@echo " * squeak-all.js assembled from:" >> $@
	@for f in $(SQUEAKJS) $(SQUEAKJSLIBS); do echo " *   $$f" >> $@ ; done
	@echo " */\n" >> $@
	@# append squeak.js, replacing .js includes with comments
	@sed 's|"\(.*\.js\)",|/* \1 (squeak-all.js) */|' $(SQUEAKJS) >> $@
	@# append all .js files
	@for f in $(SQUEAKJSLIBS); do (echo "\n/***** including $$f *****/\n"; cat $$f) >> $@ ; done

$(BUILD)/index.html: $(BUILD) index.html
	@# replace ../squeak.js with squeak-all.js
	@sed 's|../squeak.js|squeak-all.js|' $^ > $@

.SECONDARY: $(BUILD) $(GENFILES)
