# File: Makefile
# Author: Vanessa Freudenberg
#
# copy files to publishing directory and create an offline manifest

TARGET=../gh-pages/etoys
MANIFEST=$(TARGET)/offline.appcache
FILES=../squeak.js ../globals.js ../vm.*.js ../jit.js ../plugins/*.js index.html etoys.css etoys.js etoys.png \
	../lib/lz-string.js ../lib/jszip.js ../lib/sha1.js ../lib/addtohomescreen.css ../lib/addtohomescreen.js ../lib/gh-fork-ribbon.css
EXTRA=https://freudenbergs.de/vanessa/squeakjs/etoys.image https://freudenbergs.de/vanessa/squeakjs/Etoys/EtoysV5.stc

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
