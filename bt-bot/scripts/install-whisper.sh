#!/bin/bash
# Installs whisper.cpp for the bt-bot /record pipeline. Verbose, fail-fast.
set -e
echo "===== whisper.cpp install started $(date -u) ====="

echo ""; echo "--- 1. build dependencies ---"
sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq cmake espeak-ng
cmake --version | head -1

echo ""; echo "--- 2. source ---"
cd /home/gubje
if [ -d whisper.cpp/.git ]; then
  cd whisper.cpp && git fetch --depth 1 origin master && git reset --hard origin/master
else
  git clone --depth 1 https://github.com/ggml-org/whisper.cpp.git
  cd whisper.cpp
fi
echo "commit: $(git rev-parse --short HEAD)"

echo ""; echo "--- 3. build (1 job, niced, so the live bots keep their CPU) ---"
# Build ONLY whisper-cli. The default target also builds server, stream, bench,
# talk-llama and friends, which the bot never invokes and which cost roughly
# half an hour of extra single threaded compilation on this box.
# -j 1 and nice -n 19 are deliberate: 2 vCPU shared with three live bots, so a
# parallel build starves them.
cmake -B build -DCMAKE_BUILD_TYPE=Release -DWHISPER_BUILD_TESTS=OFF > /tmp/cmake-configure.log 2>&1
nice -n 19 cmake --build build --config Release --target whisper-cli -j 1 2>&1 | tail -5
BIN=""
for c in /home/gubje/whisper.cpp/build/bin/whisper-cli /home/gubje/whisper.cpp/build/bin/main; do
  [ -x "$c" ] && BIN="$c" && break
done
[ -n "$BIN" ] || { echo "FATAL: no whisper binary produced"; ls -R /home/gubje/whisper.cpp/build/bin 2>/dev/null; exit 1; }
echo "binary: $BIN"

echo ""; echo "--- 4. model base.en ---"
cd /home/gubje/whisper.cpp
bash ./models/download-ggml-model.sh base.en 2>&1 | tail -3
MODEL=/home/gubje/whisper.cpp/models/ggml-base.en.bin
ls -la "$MODEL"

echo ""; echo "--- 5. round trip: synthesize speech, transcribe, compare ---"
PHRASE="the quick brown fox jumps over the lazy dog"
espeak-ng -w /tmp/wtest_raw.wav -s 130 "$PHRASE"
FF=$(ls /home/gubje/baron-bot/node_modules/ffmpeg-static/ffmpeg 2>/dev/null | head -1)
if [ -n "$FF" ]; then "$FF" -hide_banner -loglevel error -y -i /tmp/wtest_raw.wav -ar 16000 -ac 1 /tmp/wtest.wav
else cp /tmp/wtest_raw.wav /tmp/wtest.wav; fi
echo "spoken: $PHRASE"
S=$(date +%s%N)
"$BIN" -m "$MODEL" -f /tmp/wtest.wav -l en -oj -of /tmp/wtest > /tmp/whisper-run.log 2>&1
E=$(date +%s%N)
AUDIO=$("$FF" -i /tmp/wtest.wav 2>&1 | grep -o 'Duration: [0-9:.]*' | head -1)
echo "audio $AUDIO   transcribe wall time: $(( (E-S)/1000000 )) ms"
echo -n "heard:  "
node -e 'var j=require("/tmp/wtest.json");console.log(j.transcription.map(function(r){return r.text.trim()}).join(" "))'

echo ""; echo "--- 6. paths ---"
echo "WHISPER_CMD=$BIN"
echo "WHISPER_MODEL=$MODEL"
echo "===== install finished $(date -u) ====="
