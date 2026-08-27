#!/usr/bin/env bash

set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
source_dir="$project_dir/public/Amenities Good Expo"
destination_dir="$project_dir/public/AmenitiesGoodExpoOptimized"
previews_only=false

if [[ "${1:-}" == "--previews-only" ]]; then
  previews_only=true
elif [[ -n "${1:-}" ]]; then
  echo "Usage: bash scripts/encode-amenities-good-expo.sh [--previews-only]" >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is not installed or is not available in PATH." >&2
  exit 1
fi

if [[ ! -d "$source_dir" ]]; then
  echo "Source directory not found: $source_dir" >&2
  exit 1
fi

mkdir -p "$destination_dir"

create_preview() {
  local input_file="$1"
  local output_file="$2"

  mkdir -p "$(dirname "$output_file")"

  # Preserve the source's full 4K resolution and 10-bit colour depth.
  ffmpeg -hide_banner -y \
    -i "$input_file" \
    -map 0:v:0 \
    -frames:v 1 \
    -an \
    -c:v libsvtav1 \
    -preset 4 \
    -crf 14 \
    -b:v 0 \
    -pix_fmt yuv420p10le \
    "$output_file"
}

encode_variant() {
  local input_file="$1"
  local output_dir="$2"
  local height="$3"
  local crf="$4"
  local maxrate="$5"
  local bufsize="$6"
  local level="$7"

  mkdir -p "$output_dir"

  ffmpeg -hide_banner -y \
    -i "$input_file" \
    -map 0:v:0 \
    -map "0:a:0?" \
    -vf "scale=-2:${height}:flags=lanczos" \
    -c:v libx264 \
    -preset slow \
    -crf "$crf" \
    -maxrate "$maxrate" \
    -bufsize "$bufsize" \
    -profile:v high \
    -level:v "$level" \
    -pix_fmt yuv420p \
    -tag:v avc1 \
    -r 24 \
    -fps_mode cfr \
    -g 48 \
    -keyint_min 48 \
    -sc_threshold 0 \
    -force_key_frames "expr:gte(t,n_forced*2)" \
    -c:a aac \
    -b:a 160k \
    -ar 48000 \
    -ac 2 \
    -f hls \
    -hls_time 2 \
    -hls_playlist_type vod \
    -hls_segment_type fmp4 \
    -hls_flags independent_segments+temp_file \
    -hls_fmp4_init_filename init.mp4 \
    -hls_segment_filename "$output_dir/segment_%03d.m4s" \
    "$output_dir/index.m3u8"
}

write_master_playlist() {
  local output_file="$1"

  {
    printf '%s\n' '#EXTM3U'
    printf '%s\n' '#EXT-X-VERSION:7'
    printf '%s\n' '#EXT-X-INDEPENDENT-SEGMENTS'
    printf '%s\n' '#EXT-X-STREAM-INF:BANDWIDTH=6200000,AVERAGE-BANDWIDTH=5000000,RESOLUTION=1920x1080,FRAME-RATE=24.000'
    printf '%s\n' '1080p/index.m3u8'
    printf '%s\n' '#EXT-X-STREAM-INF:BANDWIDTH=11200000,AVERAGE-BANDWIDTH=9000000,RESOLUTION=2560x1440,FRAME-RATE=24.000'
    printf '%s\n' '1440p/index.m3u8'
    printf '%s\n' '#EXT-X-STREAM-INF:BANDWIDTH=20200000,AVERAGE-BANDWIDTH=16000000,RESOLUTION=3840x2160,FRAME-RATE=24.000'
    printf '%s\n' '4k/index.m3u8'
  } > "$output_file"
}

shopt -s nullglob
input_files=("$source_dir"/*.mp4)

if (( ${#input_files[@]} == 0 )); then
  echo "No MP4 files found in: $source_dir" >&2
  exit 1
fi

total=${#input_files[@]}
current=0

for input_file in "${input_files[@]}"; do
  current=$((current + 1))
  filename="$(basename "$input_file" .mp4)"
  slug="$(
    printf '%s' "$filename" |
      tr '[:upper:]' '[:lower:]' |
      sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//'
  )"
  amenity_dir="$destination_dir/$slug"

  echo
  echo "[$current/$total] Encoding: $filename -> $slug"

  echo "  Creating high-quality 4K AVIF preview..."
  create_preview "$input_file" "$amenity_dir/preview.avif"

  if [[ "$previews_only" == true ]]; then
    echo "  Completed preview: $amenity_dir/preview.avif"
    continue
  fi

  echo "  Creating 1080p stream..."
  encode_variant "$input_file" "$amenity_dir/1080p" 1080 20 6M 12M 4.2

  echo "  Creating 1440p stream..."
  encode_variant "$input_file" "$amenity_dir/1440p" 1440 19 11M 22M 5.1

  echo "  Creating 4K stream..."
  encode_variant "$input_file" "$amenity_dir/4k" 2160 18 20M 40M 5.2

  write_master_playlist "$amenity_dir/master.m3u8"
  echo "  Completed: $amenity_dir/master.m3u8"
done

echo
if [[ "$previews_only" == true ]]; then
  echo "All high-quality previews were created in:"
else
  echo "All previews and adaptive streams were created in:"
fi
echo "$destination_dir"
