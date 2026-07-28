#!/usr/bin/env python3
"""Generate the site-root launcher page from run/index.html.

The public site serves the launcher one directory above run/ (dialog.ar/SmalltalkJsVm/),
so it needs its own index.html with the relative paths rewritten. That copy used to be
made by hand, which is exactly how it silently drifted a whole release behind run/ —
visitors landing on the site root kept seeing the old page. Generate it instead:

    python3 utils/mk-site-index.py run/index.html > index.html

Rewrites (skipping <pre> blocks, whose paths are documentation examples for the reader's
own site and must stay as they are):
    "../x"          -> "x"            (squeak.js, lib/…, squeak_worker.js)
    "squeakjs.css"  -> "run/squeakjs.css"
    "squeakjs.png"  -> "run/squeakjs.png"
"""
import re
import sys

ASSETS = ("squeakjs.css", "squeakjs.png")


def rewrite(html):
    # spans of <pre>…</pre> are documentation; leave them untouched
    skip = [(m.start(), m.end()) for m in re.finditer(r"<pre>[\s\S]*?</pre>", html)]
    in_example = lambda pos: any(a <= pos < b for a, b in skip)

    out, n = [], 0
    for m in re.finditer(r'"\.\./([^"]*)"|"(%s)"' % "|".join(a.replace(".", r"\.") for a in ASSETS), html):
        if in_example(m.start()):
            continue
        out.append(html[n:m.start()])
        out.append('"%s"' % (m.group(1) if m.group(1) is not None else "run/" + m.group(2)))
        n = m.end()
    out.append(html[n:])
    return "".join(out)


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "run/index.html"
    with open(src, encoding="utf-8") as f:
        sys.stdout.write(rewrite(f.read()))
