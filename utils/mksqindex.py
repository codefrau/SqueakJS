# walk directory tree and create sqindex.json files
from __future__ import with_statement

import sys, os, stat, json

sqindex = "sqindex.json"

def mksqindex(dirpath):
    print dirpath
    dir = []
    for name in os.listdir(dirpath):
        if name[0] == '.' or name == sqindex:
            continue
        path = os.path.join(dirpath, name)
        dirflag = os.path.isdir(path)
        ctime = int(os.path.getctime(path)) + 2177427600
        mtime = int(os.path.getmtime(path)) + 2177427600
        size = 0 if dirflag else os.path.getsize(path)
        dir.append([name, ctime, mtime, dirflag, size])
        if dirflag:
            mksqindex(path)
    with open(os.path.join(dirpath, sqindex), 'w') as f:
        json.dump(dir, f, indent = 0, separators = (',', ': '))

mksqindex(sys.argv[1])
