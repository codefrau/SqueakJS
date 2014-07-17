#!/bin/sh
# File: updatecache.sh
# Author: Bert Freudenberg
#
# Repeatedly run make to update the offline cache

echo "Starting to watch for changes (press ctrl-c to quit)" 
# use XCode if needed
XCRUN=`which xcrun`
while true; do 
	$XCRUN make | grep -v ' is up to date'
	sleep 1
done
