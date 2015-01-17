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
GENFILES=squeak.min.js squeak.min.js.map $(BUILD)/index.html
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
	@rm -rf $(GENFILES) $(BUILD)

$(TARGET):
	@mkdir -pv $@

$(BUILD):
	@mkdir -pv $@

squeak.min.js: Makefile $(SQUEAKJS) $(SQUEAKJSLIBS)
	uglifyjs $(SQUEAKJS) $(SQUEAKJSLIBS) -c warnings=false -m sort \
		-o squeak.min.js --source-map squeak.min.js.map --source-map-include-sources

squeak.min.js.map: squeak.min.js

$(BUILD)/index.html: index.html $(BUILD)
	@# replace ../squeak.js with squeak.min.js
	@sed 's|../squeak.js|squeak.min.js|' $< > $@

.SECONDARY: $(BUILD) $(GENFILES)
