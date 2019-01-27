require('dotenv').config()
const browserSync = require('browser-sync').create()
const del = require('del')
const gulp = require('gulp')
const path = require('path')

const copyData = gulp.parallel(copyLegend, copyMap)
const build = gulp.series(clean, gulp.parallel(copyData, copySrcFiles))

gulp.task('build', build)
gulp.task('clean', clean)
gulp.task('default', gulp.series(clean, build, gulp.parallel(serve, watch)))
gulp.task('serve', gulp.parallel(serve, watch))
gulp.task('static', makeStatic)

const buildDir = path.join(__dirname, 'build')
const buildDataDir = path.join(buildDir, 'data')
const legendFile = path.join(__dirname, 'output/legend.json')
const mapFile = path.join(__dirname, 'output/language-areas.json')
const staticSrc = path.join(__dirname, 'www')
const staticSrcGlob = path.join(staticSrc, '**/*.*')
const staticTargetDir = __dirname

function clean() {
  return del(buildDir)
}

function copyLegend() {
  return gulp.src(legendFile)
    .pipe(gulp.dest(buildDataDir))
}

function copyMap() {
  return gulp.src(mapFile)
    .pipe(gulp.dest(buildDataDir))
}

function copySrcFiles() {
  return gulp.src(staticSrcGlob)
    .pipe(gulp.dest(buildDir))
}

function makeStatic() {
  return gulp.src(path.join(buildDir, '**/*.*'))
    .pipe(gulp.dest(staticTargetDir))
}

function reload(done) {
  browserSync.reload()
  done()
}

function serve() {
  return browserSync
    .init({
      server: {
        baseDir: buildDir
      },
      // If this env variable is not defined, defaults to system default browser
      browser: process.env.BROWSER,
      host: '0.0.0.0'
    })
}

function watch() {
  gulp.watch([legendFile, mapFile, staticSrcGlob], gulp.series(clean, build, reload))
}
