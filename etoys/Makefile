# File: Makefile
# Author: Bert Freudenberg
#
# copy files to publishing directory and create an offline manifest

TARGET=../gh-pages/etoys
MANIFEST=$(TARGET)/offline.appcache
FILES=../squeak.js ../vm.js ../jit.js ../plugins/*.js index.html etoys.css etoys.js etoys.png \
	../lib/lz-string.js ../lib/addtohomescreen.css ../lib/addtohomescreen.js ../lib/gh-fork-ribbon.css
EXTRA=http://freudenbergs.de/bert/squeakjs/etoys.image
NETWORK=http://freudenbergs.de/bert/squeakjs/Etoys/ExampleEtoys \
	http://freudenbergs.de/bert/squeakjs/Etoys/fonts \
	http://freudenbergs.de/bert/squeakjs/Etoys/locale

$(MANIFEST): Makefile $(TARGET)
	@rm -f $@
	@echo "CACHE MANIFEST" > $@
	@stat -f '# %Sm' `ls -t Makefile $(FILES) | head -n1` | tee -a $@
	@for f in $(FILES) $(EXTRA); do echo $$f >> $@ ; done
	@echo NETWORK: >> $@
	@for f in $(NETWORK); do echo $$f >> $@ ; done

$(TARGET): $(FILES)
	@mkdir -pv $@ $@/../lib $@/../plugins
	@for f in $^ ; do install -pvm 444 $$f $@/$$f ; done
	@touch $@

