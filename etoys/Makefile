# File: Makefile
# Author: Bert Freudenberg
#
# copy files to publishing directory and create an offline manifest

PUB=../gh-pages/etoys
MANIFEST=$(PUB)/offline.appcache
CACHED=../vm.js index.html etoys.css etoys.js lz-string.js etoys.png \
	addtohomescreen.css addtohomescreen.js gh-fork-ribbon.css
EXTRA=http://freudenbergs.de/bert/squeakjs/etoys.image

$(MANIFEST): Makefile $(PUB) $(CACHED)
	@rm -f $@
	@echo "CACHE MANIFEST" > $@
	@stat -f '# Version: %Sm' `ls -t $(CACHED) | head -n1` | tee -a $@
	@echo "CACHE:" >> $@
	@for f in $(CACHED) $(EXTRA); do echo $$f >> $@ ; done

$(PUB): $(CACHED)
	@if [ ! -d $@ ] ; then mkdir -p $@ ; fi
	@for f in $^ ; do install -pvm 444 $$f $@/$$f ; done
