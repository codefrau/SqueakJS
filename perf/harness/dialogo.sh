#!/bin/bash
# Workload automático de Dialogo para el oráculo/bench — sin abrir el browser.
#
# La imagen de Dialogo auto-carga sus proyectos del directorio al arrancar, así
# que el boot con los archivos al lado ya es un workload representativo (carga de
# proyectos + render), reproducible y determinista. Este script prepara un
# entorno estable (fuera del scratchpad, que se borra entre sesiones) y corre el
# workload headless comparando modos.
#
#   perf/harness/dialogo.sh compare [sends]   ctx vs frames+jit2: wall + correctitud
#   perf/harness/dialogo.sh prof [ctx|frames] [sends]   top hotspots (node --prof)
#   perf/harness/dialogo.sh run  [ctx|frames] [sends]   una corrida, salida completa
#
# Env: DIALOGO_SRC (fuente, default ~/Desktop/Dialogo/Archivos), DIALOGO_RUN
# (dir de corrida, default /tmp/dialogo-run), EVENTS (grabación, default
# ~/Downloads/dialogo-events.json si existe; "none" para desactivar).
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
SRC="${DIALOGO_SRC:-$HOME/Desktop/Dialogo/Archivos}"
RUN="${DIALOGO_RUN:-/tmp/dialogo-run}"
IMG="$RUN/Dialogo.32bits.image"
EVENTS="${EVENTS:-$RUN/events.json}"

prepare() {
    if [ ! -f "$IMG" ]; then
        echo "preparando entorno en $RUN (copiando de $SRC)…" >&2
        mkdir -p "$RUN"
        cp "$SRC/Dialogo.32bits.image" "$RUN/"
        [ -d "$SRC/dictionaries" ] && cp -R "$SRC/dictionaries" "$RUN/"
        [ -d "$SRC/projects" ] && cp -R "$SRC/projects" "$RUN/"
    fi
    # estabilizar la grabación de eventos en el dir de corrida (sobrevive a que
    # se borre Downloads); se puede regrabar y volver a copiar
    if [ ! -f "$RUN/events.json" ] && [ -f "$HOME/Downloads/dialogo-events.json" ]; then
        cp "$HOME/Downloads/dialogo-events.json" "$RUN/events.json"
    fi
    # limpiar artefactos de la corrida anterior (el harness también lo hace)
    rm -f "$RUN"/*.changes "$RUN"/CuisDebug-*.log 2>/dev/null || true
}

evflag() {
    if [ "$EVENTS" != "none" ] && [ -f "$EVENTS" ]; then echo "--events $EVENTS"; fi
}

# corre un modo, devuelve la línea "trace:" y "display:" por stdout
run_one() { # $1=sends, $2..=flags
    local sends="$1"; shift
    node "$REPO/perf/harness/difftrace.js" --ui $(evflag) "$@" --image "$IMG" --sends "$sends" 2>&1
}

# mide best-of-2 de un modo; imprime "wall|traceHash|dispHash|sendCount"
measure() { # $1=sends $2..=flags
    local sends="$1"; shift
    local best=99999999 out="" o w
    for i in 1 2; do
        o=$(run_one "$sends" "$@")
        w=$(echo "$o" | grep -oE "wall [0-9]+ ms" | grep -oE "[0-9]+")
        if [ -n "$w" ] && [ "$w" -lt "$best" ]; then best=$w; out="$o"; fi
    done
    local th=$(echo "$out" | grep "^trace:"   | grep -oE "hash=[0-9a-fx]+" | cut -d= -f2)
    local dh=$(echo "$out" | grep "^display:" | grep -oE "hash=[0-9a-fx]+" | cut -d= -f2)
    local sc=$(echo "$out" | grep "^trace:"   | grep -oE "sends=[0-9]+"    | cut -d= -f2)
    echo "$best|$th|$dh|$sc"
}

cmd="${1:-compare}"
prepare

case "$cmd" in
compare)
    SENDS="${2:-20000000}"
    echo "workload: Dialogo auto-load, $SENDS sends, eventos=$([ -n "$(evflag)" ] && echo sí || echo no)"
    ctx=$(measure "$SENDS"); frm=$(measure "$SENDS" --frames --jit2)
    cw=${ctx%%|*}; ct=$(echo "$ctx"|cut -d'|' -f2); cd=$(echo "$ctx"|cut -d'|' -f3); cs=$(echo "$ctx"|cut -d'|' -f4)
    fw=${frm%%|*}; ft=$(echo "$frm"|cut -d'|' -f2); fd=$(echo "$frm"|cut -d'|' -f3); fs=$(echo "$frm"|cut -d'|' -f4)
    printf "%-14s %10s %10s %12s %s\n" "modo" "wall(ms)" "sends/s" "traceHash" "displayHash"
    printf "%-14s %10s %9.2fM %12s %s\n" "ctx"          "$cw" "$(awk "BEGIN{print $cs/($cw/1000)/1e6}")" "$ct" "$cd"
    printf "%-14s %10s %9.2fM %12s %s\n" "frames+jit2"  "$fw" "$(awk "BEGIN{print $fs/($fw/1000)/1e6}")" "$ft" "$fd"
    echo "---"
    if [ "$ct" = "$ft" ] && [ "$cd" = "$fd" ]; then
        echo "✓ CORRECTO: traza y dibujo idénticos entre ctx y frames+jit2"
    else
        echo "✗ DIVERGE: ctx trace=$ct disp=$cd  vs  frames trace=$ft disp=$fd"
    fi
    awk "BEGIN{printf \"perf: frames+jit2 %+.1f%% vs ctx (%s vs %s ms)\n\", ($cw-$fw)/$cw*100, $fw, $cw}"
    ;;

run)
    mode="${2:-frames}"; SENDS="${3:-20000000}"
    [ "$mode" = "ctx" ] && run_one "$SENDS" || run_one "$SENDS" --frames --jit2
    ;;

prof)
    mode="${2:-frames}"; SENDS="${3:-20000000}"
    PDIR="$RUN/prof"; mkdir -p "$PDIR"; rm -f "$PDIR"/isolate-*.log
    flags=""; [ "$mode" = "frames" ] && flags="--frames --jit2"
    ( cd "$PDIR" && node --prof "$REPO/perf/harness/difftrace.js" --ui $(evflag) $flags --image "$IMG" --sends "$SENDS" >/dev/null 2>&1
      node --prof-process isolate-*.log > proc.txt 2>/dev/null )
    echo "== $mode ($SENDS sends): top JS (nonlib %) =="
    awk '/\[JavaScript\]:/{f=1; next} /^ \[/{f=0} f' "$PDIR/proc.txt" | head -24
    rm -f "$PDIR"/isolate-*.log
    ;;

*) echo "uso: dialogo.sh {compare|run|prof} …"; exit 1 ;;
esac
