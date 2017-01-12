(function(root, factory) {
  /* ======= Global Moon ======= */
  (typeof module === "object" && module.exports) ? module.exports = factory() : root.Moon = factory();
}(this, function() {

    /* ======= Global Variables ======= */
    var config = {
      silent: false,
      prefix: "m-"
    }
    var directives = {};
    var components = {};

    //=require util/util.js

    function Moon(opts) {
        /* ======= Initial Values ======= */
        this.$opts = opts || {};

        var self = this;
        var _data = opts.data;
        
        this.$el = document.querySelector(opts.el);
        this.$template = opts.template || this.$el.innerHTML;
        this.$hooks = merge({created: noop, mounted: noop, updated: noop, destroyed: noop}, opts.hooks);
        this.$methods = opts.methods || {};
        this.$components = merge(opts.components || {}, components);
        this.$directives = merge(opts.directives || {}, directives);
        this.$dom = {};
        this.$destroyed = false;

        /* ======= Listen for Changes ======= */
        Object.defineProperty(this, '$data', {
            get: function() {
                return _data;
            },
            set: function(value) {
                _data = value;
                this.build(this.$el.childNodes, this.$dom.children);
            },
            configurable: true
        });

        //=require directives/default.js

        /* ======= Initialize 🎉 ======= */
        this.init();
    }

    //=require instance/methods.js

    //=require global/api.js

    return Moon;
}));
