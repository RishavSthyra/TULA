import fs from "fs"
import path from "path"
import os from "os"
import sharp from "sharp"

const INPUT = "./raw-panos"
const OUTPUT = "./public/exterior-pano-remaining"

const PREVIEW_WIDTH = 2000

const CPU_THREADS =
  typeof os.availableParallelism === "function"
    ? os.availableParallelism()
    : os.cpus().length

const SHARP_THREADS_PER_JOB = Math.max(1, Math.floor(CPU_THREADS / 4))

sharp.concurrency(SHARP_THREADS_PER_JOB)
sharp.simd(true)

// A decoded 12288 x 6144 RGB pano is about 216 MB. Processing one pano at a
// time keeps memory stable while its independent tiles use all CPU cores.
const FILE_CONCURRENCY = 1
const TILE_CONCURRENCY = Math.max(4, Math.min(16, CPU_THREADS))
const WEBP_LOSSLESS_EFFORT = 0

// set these based on your pano size
// for 12288 x 6144 use:
const TARGET_COLS = 16
const TARGET_ROWS = 8

const SHARP_INPUT_OPTIONS = {
  limitInputPixels: false,
  sequentialRead: true,
} as const

type TileJob = {
  row: number
  col: number
  left: number
  top: number
  width: number
  height: number
}

function getPanoId(file: string): string {
  return path.parse(file).name.replace(/^NewLS_/i, "LS_")
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
}

function pathExists(targetPath: string): boolean {
  return fs.existsSync(targetPath)
}

function getTilePath(tilesFolder: string, job: Pick<TileJob, "col" | "row">) {
  return path.join(tilesFolder, `tile_${job.col}_${job.row}.webp`)
}

function isAlreadyProcessed(folder: string): boolean {
  const previewPath = path.join(folder, "preview.jpg")
  const metaPath = path.join(folder, "meta.json")
  const tilesFolder = path.join(folder, "tiles")

  if (!pathExists(folder)) return false
  if (!pathExists(previewPath)) return false
  if (!pathExists(metaPath)) return false
  if (!pathExists(tilesFolder)) return false

  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as {
      tileFormat?: string
      tileUrl?: string
    }
    const tileFiles = fs
      .readdirSync(tilesFolder)
      .filter((file) => /\.webp$/i.test(file))

    return (
      meta.tileFormat === "webp" &&
      meta.tileUrl === "tiles/tile_{col}_{row}.webp" &&
      tileFiles.length === TARGET_COLS * TARGET_ROWS
    )
  } catch {
    return false
  }
}

async function runInBatches<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    await Promise.all(batch.map((item, index) => worker(item, i + index)))
  }
}

async function processImage(file: string): Promise<void> {
  console.log("processing:", file)

  const panoId = getPanoId(file)
  const inputPath = path.join(INPUT, file)

  const folder = path.join(OUTPUT, panoId)
  const tilesFolder = path.join(folder, "tiles")

  if (isAlreadyProcessed(folder)) {
    console.log(`skipping: ${file} already processed`)
    return
  }

  ensureDir(folder)
  ensureDir(tilesFolder)

  const meta = await sharp(inputPath, SHARP_INPUT_OPTIONS).metadata()

  if (!meta.width || !meta.height) {
    throw new Error(`Could not read dimensions for ${file}`)
  }

  const fullWidth = meta.width
  const fullHeight = meta.height

  const cols = TARGET_COLS
  const rows = TARGET_ROWS

  if (fullWidth % cols !== 0 || fullHeight % rows !== 0) {
    throw new Error(
      `Image ${file} cannot be evenly divided by grid ${cols} x ${rows}. Got ${fullWidth} x ${fullHeight}`
    )
  }

  const tileWidth = fullWidth / cols
  const tileHeight = fullHeight / rows

  if (tileWidth !== tileHeight) {
    throw new Error(
      `Tiles are not square for ${file}. tileWidth=${tileWidth}, tileHeight=${tileHeight}`
    )
  }

  const tileJobs: TileJob[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      tileJobs.push({
        row,
        col,
        left: col * tileWidth,
        top: row * tileHeight,
        width: tileWidth,
        height: tileHeight,
      })
    }
  }

  const previewPath = path.join(folder, "preview.jpg")
  const pendingTileJobs = tileJobs.filter(
    (job) => !pathExists(getTilePath(tilesFolder, job))
  )
  const shouldGeneratePreview = !pathExists(previewPath)

  if (shouldGeneratePreview || pendingTileJobs.length > 0) {
    const { data: pixels, info } = await sharp(
      inputPath,
      SHARP_INPUT_OPTIONS
    )
      .raw()
      .toBuffer({ resolveWithObject: true })
    const rawInput = {
      raw: {
        width: info.width,
        height: info.height,
        channels: info.channels,
      },
    } as const

    if (shouldGeneratePreview) {
      await sharp(pixels, rawInput)
        .resize({
          width: PREVIEW_WIDTH,
          withoutEnlargement: true,
        })
        .jpeg({
          quality: 90,
        })
        .toFile(previewPath)
    }

    await runInBatches(
      pendingTileJobs,
      TILE_CONCURRENCY,
      async (job) => {
        await sharp(pixels, rawInput)
          .extract({
            left: job.left,
            top: job.top,
            width: job.width,
            height: job.height,
          })
          .webp({
            lossless: true,
            effort: WEBP_LOSSLESS_EFFORT,
          })
          .toFile(getTilePath(tilesFolder, job))
      }
    )
  }

  const metaJson = {
    width: fullWidth,
    height: fullHeight,
    cols,
    rows,
    tileWidth,
    tileHeight,
    preview: "preview.jpg",
    tileFormat: "webp",
    tileUrl: "tiles/tile_{col}_{row}.webp",
  }

  fs.writeFileSync(
    path.join(folder, "meta.json"),
    JSON.stringify(metaJson, null, 2),
    "utf8"
  )

  console.log("done:", file, {
    ...metaJson,
    totalTiles: cols * rows,
  })
}

async function run(): Promise<void> {
  ensureDir(INPUT)
  ensureDir(OUTPUT)

  const files = fs
    .readdirSync(INPUT)
    .filter((file) => /\.(png|jpg|jpeg|webp)$/i.test(file))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  if (files.length === 0) {
    console.log("No pano files found in:", INPUT)
    return
  }

  console.log("CPU:", CPU_THREADS)
  console.log("Sharp threads per job:", SHARP_THREADS_PER_JOB)
  console.log("tile concurrency:", TILE_CONCURRENCY)
  console.log("grid:", `${TARGET_COLS} x ${TARGET_ROWS}`)

  const totalStart = Date.now()

  await runInBatches(files, FILE_CONCURRENCY, async (file) => {
    const start = Date.now()
    await processImage(file)
    console.log(`${file} done in ${((Date.now() - start) / 1000).toFixed(1)}s`)
  })

  console.log(
    `All done in ${((Date.now() - totalStart) / 1000 / 60).toFixed(2)} min`
  )
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
