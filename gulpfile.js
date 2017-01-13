'use strict';

var gulp = require('gulp');
var pkg = require('./package.json');
var uglify = require("gulp-uglifyjs");
var mochaPhantomJS = require('gulp-mocha-phantomjs');
var comment = '\/*\r\n* Moon ' + pkg.version + '\r\n* Copyright 2016-2017, Kabir Shah\r\n* https:\/\/github.com\/KingPixil\/moon\/\r\n* Free to use under the MIT license.\r\n* https:\/\/kingpixil.github.io\/license\r\n*\/\r\n';
var $ = require('gulp-load-plugins')();

// Build Moon
gulp.task('build', function () {
  return gulp.src(['./src/index.js'])
    .pipe($.include())
    .pipe($.concat('moon.js'))
    .pipe($.header(comment + '\n'))
    .pipe($.size())
    .pipe(gulp.dest('./dist/'));
});

// Build minified (compressed) version of Moon
gulp.task('minify', ['build'], function() {
  return gulp.src(['./dist/moon.js'])
    .pipe(uglify())
    .pipe($.header(comment))
    .pipe($.size())
    .pipe($.concat('moon.min.js'))
    .pipe(gulp.dest('./dist/'));
});

// Run Tests
gulp.task('test', function () {
    return gulp.src('test/test.html')
      .pipe(mochaPhantomJS({reporter: 'spec'}));
});


// Default task
gulp.task('default', ['build', 'minify']);
