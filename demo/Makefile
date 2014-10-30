# File: Makefile
# Author: Bert Freudenberg
#
# copy files to publishing directory and create an offline manifest

TARGET=../gh-pages/demo
MANIFEST=$(TARGET)/offline.appcache
FILES=../squeak.js ../vm.js ../jit.js ../plugins/*.js \
	simple.html simple.css simple.js SimplePlugin.js mini.image icon.png \
	../lib/lz-string.js ../lib/addtohomescreen.css ../lib/addtohomescreen.js ../lib/gh-fork-ribbon.css
EXTRA=

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

