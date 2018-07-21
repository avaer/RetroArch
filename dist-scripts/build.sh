#!/bin/bash

source ~/emsdk/emsdk_env.sh
export platform=emscripten
export DEBUG=1
emmake ./dist-cores.sh emscripten
# sed -i -e 's/case 0x8034 /case 0x8034: case 33638 /g' ../pkg/emscripten/*_libretro.js
# sed -i -e 's/RA\.process();/return 0;RA.process();/g' ../pkg/emscripten/*_libretro.js
# sed -i -e 's/RA\.process();/return 0;RA.process();/g' ../pkg/emscripten/*_libretro.js
# sed -i -e 's/nullFunc_iii(x) {/nullFunc_iii(x) { return 0;/g' ../pkg/emscripten/*_libretro.js
cp ../pkg/emscripten/*_libretro.{js,wasm} ~/emukit/assets/frontend/bundle/
# ./mrify-core.js ~/emukit/assets/frontend/bundle/pcsx_rearmed_libretro.js >~/emukit/assets/frontend/bundle/pcsx_rearmed_mr_libretro.js
