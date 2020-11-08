#!/bin/env node

const fs = require('fs/promises')
const childProcess = require('child_process')
const path = require('path')

const argv = process.argv.slice(2)

;(async () => {
  if (argv.length < 1) {
    console.log('specify zip file')
    return 1
  }
  const [zip] = argv

  const files = childProcess.spawnSync('unzip', ['-l', zip], {
    stdio: ['inherit', 'pipe', 'inherit'],
    encoding: 'utf-8',
  })
  const file = getFile(files, '.jpg')
  const metadataFile = getFile(files, 'metadata.csv')
  if (!file) {
    console.error('Cannot get .jpg file')
    return 1
  }

  childProcess.spawnSync('unzip', [zip], {
    stdio: 'inherit',
  })
  const metadata = await fs.readFile(metadataFile, 'utf-8')
  let ret = await duplicateLast(path.dirname(metadataFile), metadata)
  if (ret) return ret

  childProcess.spawnSync(
    'ffmpeg',
    [
      '-threads 12',
      '-r 30',
      '-pattern_type glob -i *.jpg',
      '-c:v libx265',
      '-crf 24',
      '-r 30',
      '-pix_fmt yuv420p',
    ]
      .map((v) => v.split(' '))
      .flat()
      .concat([path.join('..', '..', path.basename(zip, '.zip') + '.mp4')]),
    { stdio: 'inherit', cwd: path.join(process.cwd(), path.dirname(file)) },
  )
  childProcess.spawnSync('rm', ['-rf', file.split(path.sep)[0]], {
    stdio: 'inherit',
  })
})().then(
  (code = 0) => {
    process.exit(code)
  },
  (err) => {
    console.error(err)
    process.exit(2)
  },
)

async function duplicateLast(dir, metadata) {
  const lastFile = metadata
    .split('\n')
    .filter((a) => a)
    .slice(-1)[0]
    .split(',')
  if (!lastFile || lastFile.length < 2) {
    console.error('Cannot find last file')
    return 1
  }
  const base = lastFile[1].substring(
    0,
    lastFile[1].length - '000049.jpg'.length,
  )
  const start = Number.parseInt(lastFile[0], 10)
  for (let i = start + 1; i < start + 30; i++) {
    const num = (i + '').padStart(6, '0')
    await fs.copyFile(
      path.join(dir, lastFile[1]),
      path.join(dir, base + num + '.jpg'),
    )
  }
  return 0
}

function getFile(files, end) {
  return files.stdout
    .split('\n')
    .find((line) => line.endsWith(end))
    ?.split(' ')
    .slice(-1)[0]
}
