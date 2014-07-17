# File: Makefile
# Author: Bert Freudenberg
#
# copy files to publishing directory and create an offline manifest

TARGET=../gh-pages/benchmark
MANIFEST=$(TARGET)/offline.appcache
FILES=../vm.js benchmark.html benchmark.css benchmark.js benchmark.image \
	../lib/lz-string.js
EXTRA=

$(MANIFEST): Makefile $(TARGET)
	@rm -f $@
	@echo "CACHE MANIFEST" > $@
	@stat -f '# %Sm' `ls -t $(FILES) | head -n1` | tee -a $@
	@for f in $(FILES) $(EXTRA); do echo $$f >> $@ ; done

$(TARGET): $(FILES)
	@mkdir -pv $@ $@/../lib
	@for f in $^ ; do install -pvm 444 $$f $@/$$f ; done
	@touch $@

