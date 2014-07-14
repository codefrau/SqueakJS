# File: Makefile
# Author: Bert Freudenberg
#
# copy files to publishing directory and create an offline manifest

ETOYSDIR=../gh-pages/etoys
MANIFEST=$(ETOYSDIR)/offline.appcache
DEMODIR=../gh-pages/demo
DEMO=../demo/lz-string.js ../demo/addtohomescreen.css ../demo/addtohomescreen.js ../demo/gh-fork-ribbon.css
CACHED=../vm.js index.html etoys.css etoys.js etoys.png $(DEMO)
EXTRA=http://freudenbergs.de/bert/squeakjs/etoys.image

$(MANIFEST): Makefile $(ETOYSDIR) $(CACHED)
	@rm -f $@
	@echo "CACHE MANIFEST" > $@
	@stat -f '# Version: %Sm' `ls -t $(CACHED) | head -n1` | tee -a $@
	@echo "CACHE:" >> $@
	@for f in $(CACHED) $(EXTRA); do echo $$f >> $@ ; done

$(ETOYSDIR): $(DEMODIR) $(CACHED)
	@if [ ! -d $@ ] ; then mkdir -p $@ ; fi
	@for f in $(CACHED); do install -pvm 444 $$f $@/$$f ; done
	touch $(ETOYSDIR)

$(DEMODIR): $(DEMO)
	$(MAKE) -C ../demo
