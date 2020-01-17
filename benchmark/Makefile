# File: Makefile
# Author: Bert Freudenberg
#
# copy files to publishing directory and create an offline manifest

TARGET=../gh-pages/benchmark
MANIFEST=$(TARGET)/offline.appcache
FILES=../squeak.js ../globals.js ../vm.*.js ../jit.js ../plugins/*.js benchmark.html benchmark.css benchmark.js benchmark.image \
	../lib/lz-string.js ../lib/jszip.js ../lib/sha1.js
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

