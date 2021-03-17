#!/bin/bash
cd node_modules/html2pdf.js/
npm run build
cd ../../
./node_modules/.bin/electron-rebuild -v 11.2.1
# cp src/electron-typings node_modules/@types/electron/index.d.ts
# for file in src/dictionaries/*
# do
# 	if [[ -f $file ]]; then
# 		filename=$(basename -- "$file")
# 		filename=./node_modules/spellchecker/vendor/hunspell_dictionaries/$filename
# 		cp $file $filename
# 	fi
# done
