/* ======= Instance Methods ======= */

/**
 * Gets Value in Data
 * @param {String} key
 * @return {String} Value of key in data
 */
Moon.prototype.get = function(key) {
  const observer = this.$observer;
  let target = null;
  if((target = observer.target) !== null) {
    if(observer.map[key] === undefined) {
      observer.map[key] = [target];
    } else if(observer.map[key].indexOf(target) === -1) {
      observer.map[key].push(target);
    }
  }
  return this.$data[key];
}

/**
 * Sets Value in Data
 * @param {String} key
 * @param {String} val
 */
Moon.prototype.set = function(key, val) {
  // Get observer
  const observer = this.$observer;

  // Get base of keypath
  const base = resolveKeyPath(this, this.$data, key, val);

  // Invoke custom setter
  let setter = null;
  if((setter = observer.setters[base]) !== undefined) {
    setter.call(this, val);
  }

  // Notify observer of change
  observer.notify(base, val);

  // Queue a build
  queueBuild(this);
}

/**
 * Destroys Moon Instance
 */
Moon.prototype.destroy = function() {
  // Remove event listeners
  this.off();

  // Remove reference to element
  this.$el = null;

  // Setup destroyed state
  this.$destroyed = true;

  // Call destroyed hook
  callHook(this, 'destroyed');
}

/**
 * Calls a method
 * @param {String} method
 */
Moon.prototype.callMethod = function(method, args) {
  // Get arguments
  args = args || [];

  // Call method in context of instance
  this.$data[method].apply(this, args);
}

// Event Emitter, adapted from https://github.com/KingPixil/voke

/**
 * Attaches an Event Listener
 * @param {String} eventName
 * @param {Function} handler
 */
Moon.prototype.on = function(eventName, handler) {
  // Get list of handlers
  let handlers = this.$events[eventName];

  if(handlers === undefined) {
    // If no handlers, create them
    this.$events[eventName] = [handler];
  } else {
    // If there are already handlers, add it to the list of them
    handlers.push(handler);
  }
}

/**
 * Removes an Event Listener
 * @param {String} eventName
 * @param {Function} handler
 */
Moon.prototype.off = function(eventName, handler) {
  if(eventName === undefined) {
    // No event name provided, remove all events
    this.$events = {};
  } else if(handler === undefined) {
    // No handler provided, remove all handlers for the event name
    this.$events[eventName] = [];
  } else {
    // Get handlers from event name
    let handlers = this.$events[eventName];

    // Get index of the handler to remove
    const index = handlers.indexOf(handler);

    // Remove the handler
    handlers.splice(index, 1);
  }
}

/**
 * Emits an Event
 * @param {String} eventName
 * @param {Object} customMeta
 */
Moon.prototype.emit = function(eventName, customMeta) {
  // Setup metadata to pass to event
  var meta = customMeta || {};
  meta.type = eventName;

  // Get handlers and global handlers
  var handlers = this.$events[eventName];
  var globalHandlers = this.$events["*"];

  // Call all handlers for the event name
  for(var i = 0; i < handlers.length; i++) {
    handlers[i](meta);
  }

  if(globalHandlers !== undefined) {
    // Call all of the global handlers if present
    for(var i = 0; i < globalHandlers.length; i++) {
      globalHandlers[i](meta);
    }
  }
}

/**
 * Renders "m-for" Directive Array
 * @param {Array} arr
 * @param {Function} item
 */
Moon.prototype.renderLoop = function(arr, item) {
  // Get the amount of items (vnodes) to be created
  let items = new Array(arr.length);

  // Call the function and get the item for the current index
  for(let i = 0; i < arr.length; i++) {
    items[i] = item(arr[i], i);
  }

  return items;
}

/**
 * Renders a Class in Array/Object Form
 * @param {Array|Object|String} classNames
 * @return {String} renderedClassNames
 */
Moon.prototype.renderClass = function(classNames) {
  if(typeof classNames === "string") {
    // If they are a string, no need for any more processing
    return classNames;
  }

  let renderedClassNames = "";
  if(Array.isArray(classNames)) {
    // It's an array, so go through them all and generate a string
    for(let i = 0; i < classNames.length; i++) {
      renderedClassNames += `${this.renderClass(classNames[i])} `;
    }
  } else if(typeof classNames === "object") {
    // It's an object, so to through and render them to a string if the corresponding condition is true
    for(let className in classNames) {
      if(classNames[className]) {
        renderedClassNames += `${className} `;
      }
    }
  }

  // Remove trailing space and return
  renderedClassNames = renderedClassNames.slice(0, -1);
  return renderedClassNames;
}

/**
 * Mounts Moon Element
 * @param {Object} el
 */
Moon.prototype.mount = function(el) {
  // Get element from the DOM
  this.$el = document.querySelector(el);

  // Remove destroyed state
  this.$destroyed = false;

  if("__ENV__" !== "production" && this.$el === null) {
    // Element not found
    error("Element " + this.$opts.el + " not found");
  }

  // Sync Element and Moon instance
  this.$el.__moon__ = this;

  // Setup template as provided `template` or outerHTML of the Element
  this.$template = this.$opts.template || this.$el.outerHTML;

  // Setup render Function
  if(this.$render === noop) {
    this.$render = Moon.compile(this.$template);
  }

  // Run First Build
  this.build();

  // Call mounted hook
  callHook(this, 'mounted');
}

/**
 * Renders Virtual DOM
 * @return Virtual DOM
 */
Moon.prototype.render = function() {
  // Call render function
  return this.$render(h);
}

/**
 * Diff then Patches Nodes With Data
 * @param {Object} old
 * @param {Object} vnode
 * @param {Object} parent
 */
Moon.prototype.patch = function(old, vnode, parent) {
  if(old.meta !== undefined && old.meta.el !== undefined) {
    // If it is not a VNode, then diff
    if(vnode.type !== old.type) {
      // Root Element Changed During Diff
      // Replace Root Element
      replaceChild(old.meta.el, createNodeFromVNode(vnode, this), parent);

      // Update Bound Instance
      this.$el = vnode.meta.el;
      this.$el.__moon__ = this;
    } else {
      // Diff
      diff(old, vnode, parent, this);
    }

  } else if(old instanceof Node) {
    // Hydrate
    const newNode = hydrate(old, vnode, parent, this);

    if(newNode !== old) {
      // Root Element Changed During Hydration
      this.$el = vnode.meta.el;
      this.$el.__moon__ = this;
    }
  }
}

/**
 * Render and Patches the DOM With Data
 */
Moon.prototype.build = function() {
  // Get new virtual DOM
  const dom = this.render();

  // Old item to patch
  let old = null;

  if(this.$dom.meta !== undefined) {
    // If old virtual dom exists, patch against it
    old = this.$dom;
  } else {
    // No virtual DOM, patch with actual DOM element, and setup virtual DOM
    old = this.$el;
    this.$dom = dom;
  }

  // Patch old and new
  this.patch(old, dom, this.$el.parentNode);
}

/**
 * Initializes Moon
 */
Moon.prototype.init = function() {
  log("======= Moon =======");
  callHook(this, 'init');

  if(this.$opts.el !== undefined) {
    this.mount(this.$opts.el);
  }
}
