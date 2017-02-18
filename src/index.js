"use strict";

/* ======= Global Variables ======= */
var directives = {};
var specialDirectives = {};
var components = {};
var eventModifiersCode = {
  stop: 'event.stopPropagation();',
  prevent: 'event.preventDefault();',
  ctrl: 'if(!event.ctrlKey) {return;};',
  shift: 'if(!event.shiftKey) {return;};',
  alt: 'if(!event.altKey) {return;};',
  enter: 'if(event.keyCode !== 13) {return;};'
};
var id = 0;

/* ======= Observer ======= */
//=require observer/reactive.js
//=require observer/observer.js

//=require util/util.js

/* ======= Compiler ======= */
//=require compiler/lexer.js
//=require compiler/parser.js
//=require compiler/generator.js
//=require compiler/compiler.js

function Moon(opts) {
    /* ======= Initial Values ======= */
    this.$opts = opts || {};

    this.$id = id++;

    this.$name = this.$opts.name || "root";
    this.$parent = this.$opts.parent || null;
    this.$data = this.$opts.data || {};
    reactiveObject(this, this.$data);
    this.$render = this.$opts.render || noop;
    this.$hooks = this.$opts.hooks || {};
    this.$methods = this.$opts.methods || {};
    this.$events = {};
    this.$dom = {};
    this.$observer = new Observer(this);
    this.$destroyed = false;
    this.$initialRender = true;
    this.$queued = false;

    /* ======= Initialize 🎉 ======= */
    this.init();
}

//=require instance/methods.js

//=require global/api.js

//=require directives/default.js
