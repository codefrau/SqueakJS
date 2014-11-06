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
	STAT=stat -f '\# %Sm'
else
	STAT=stat -c '\# %z'
endif

$(MANIFEST): Makefile $(TARGET) $(GENFILES) $(CPFILES)
	@echo 'CACHE MANIFEST' > $@
	@$(STAT) `ls -t Makefile $(ORGFILES) | head -n1` | tee -a $@
	@for f in $(GENFILES) $(CPFILES); do F=`basename $$f`; echo $$F >> $@ ; install -pvm 444 $$f $(TARGET); done
	@echo 'NETWORK:' >> $@
	@echo '*' >> $@
	@rm -rf $(BUILD)

$(TARGET):
	@mkdir -pv $@

$(BUILD):
	@mkdir -pv $@

$(BUILD)/squeak-all.js: $(BUILD) Makefile $(SQUEAKJS) $(SQUEAKJSLIBS)
	@sed 's|"\(.*\.js\)",|/* \1 (squeak-all.js) */|' $(SQUEAKJS) > $@
	@for f in $(SQUEAKJSLIBS); do (echo; echo "/***** including $$f *****/"; echo ; cat $$f) >> $@ ; done

$(BUILD)/index.html: $(BUILD) index.html
	@sed 's|../squeak.js|squeak-all.js|' $^ > $@

.SECONDARY: $(BUILD) $(GENFILES)
