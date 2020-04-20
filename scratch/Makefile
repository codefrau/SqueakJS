# File: Makefile
# Author: Vanessa Freudenberg
#
# copy files to publishing directory and create an offline manifest

TARGET=../gh-pages/scratch
MANIFEST=$(TARGET)/offline.appcache
FILES=../squeak.js ../globals.js ../vm.*.js ../jit.js ../plugins/*.js index.html scratch.css scratch.js scratch.png \
	../lib/lz-string.js ../lib/jszip.js ../lib/sha1.js ../lib/addtohomescreen.css ../lib/addtohomescreen.js ../lib/gh-fork-ribbon.css
EXTRA=https://freudenbergs.de/vanessa/squeakjs/scratch/Scratch.image

$(MANIFEST): Makefile $(TARGET)
	@rm -f $@
	@echo 'CACHE MANIFEST' > $@
	@stat -f '# %Sm' `ls -t Makefile $(FILES) | head -n1` | tee -a $@
	@for f in $(FILES) $(EXTRA); do echo $$f >> $@ ; done
	@echo 'NETWORK:' >> $@
	@echo '*' >> $@

$(TARGET): $(FILES)
	@mkdir -pv $@ $@/../lib $@/../plugins
	@for f in $^ ; do install -pvm 444 $$f $@/$$f ; done
	@touch $@
