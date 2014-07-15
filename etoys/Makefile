# File: Makefile
# Author: Bert Freudenberg
#
# copy files to publishing directory and create an offline manifest

TARGET=../gh-pages/etoys
MANIFEST=$(TARGET)/offline.appcache
FILES=../vm.js index.html etoys.css etoys.js etoys.png \
	../lib/lz-string.js ../lib/addtohomescreen.css ../lib/addtohomescreen.js ../lib/gh-fork-ribbon.css
EXTRA=http://freudenbergs.de/bert/squeakjs/etoys.image

$(MANIFEST): Makefile $(TARGET)
	@rm -f $@
	@echo "CACHE MANIFEST" > $@
	@stat -f '# %Sm' `ls -t $(FILES) | head -n1` | tee -a $@
	@for f in $(FILES) $(EXTRA); do echo $$f >> $@ ; done

$(TARGET): $(FILES)
	@mkdir -pv $@ $@/../lib
	@for f in $^ ; do install -pvm 444 $$f $@/$$f ; done
	@touch $@

