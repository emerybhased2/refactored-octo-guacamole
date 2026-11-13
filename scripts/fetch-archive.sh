#!/usr/bin/env bash
# Re-fetches archived mope.io files from Arquivo.pt into archive/ (git-ignored: third-party code, kept for local analysis only).
# Timestamps come from Arquivo's CDX index: https://arquivo.pt/wayback/cdx?url=mope.io/<path>&output=json
set -euo pipefail
cd "$(dirname "$0")/.."; mkdir -p archive
B="https://arquivo.pt/noFrame/replay"
get() { curl -sS -L -m 90 -o "archive/$3" -w "$3 -> %{http_code} %{size_download} bytes\n" "$B/$1id_/http://mope.io/$2"; }
get 20170213100949 ""         index_2017-02-13.html
get 20170213101214 client.js  client_2017-02-13.js
get 20170213101002 main.css   main_2017-02-13.css
get 20170213101026 img/logo.png logo_2017-02-13.png
get 20180421014032 ""         index_2018-04-21.html
get 20180421014457 client.js  client_2018-04-21.js
get 20180421014110 main.css   main_2018-04-21.css
get 20180421014215 img/logo.png logo_2018-04-21.png
get 20190825113653 ""         index_2019-08-25.html
get 20190825113700 "main.css?v=1.224" main_2019-08-25.css
get 20190327115440 img/logo.png logo_2019.png
