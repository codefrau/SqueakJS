# File: Makefile
# Author: Bert Freudenberg
#
# copy files to publishing directory and create an offline manifest

PUB=../gh-pages/demo
MANIFEST=$(PUB)/offline.appcache
CACHED=../vm.js simple.html simple.css simple.js SimplePlugin.js mini.image icon.png add2home.css add2home.js gh-fork-ribbon.css

$(MANIFEST): Makefile $(PUB) $(CACHED)
	@rm -f $@
	@echo "CACHE MANIFEST" > $@
	@stat -f '# Version: %Sm' `ls -t $(CACHED) | head -n1` | tee -a $@
	@echo "CACHE:" >> $@
	@for f in $(CACHED) ; do echo $$f >> $@ ; done

$(PUB): $(CACHED)
	@if [ ! -d $@ ] ; then mkdir -p $@ ; fi
	@for f in $^ ; do install -pvm 444 $$f $@/$$f ; done
