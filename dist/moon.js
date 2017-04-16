/**
 * Moon v0.9.0
 * Copyright 2016-2017 Kabir Shah
 * Released under the MIT License
 * http://moonjs.ga
 */

(function(root, factory) {
  /* ======= Global Moon ======= */
  (typeof module === "object" && module.exports) ? module.exports = factory() : root.Moon = factory();
}(this, function() {
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
    /**
     * Sets Up Methods
     * @param {Object} instance
     */
    var initMethods = function (instance, methods) {
      var initMethod = function (methodName, method) {
        instance.$data[methodName] = function () {
          return method.apply(instance, arguments);
        };
      };
    
      for (var method in methods) {
        initMethod(method, methods[method]);
      }
    };
    
    /**
     * Makes Computed Properties for an Instance
     * @param {Object} instance
     * @param {Object} computed
     */
    var initComputed = function (instance, computed) {
      var setComputedProperty = function (prop) {
        var observer = instance.$observer;
    
        // Flush Cache if Dependencies Change
        observer.observe(prop);
    
        // Add Getters
        Object.defineProperty(instance.$data, prop, {
          get: function () {
            // Property Cache
            var cache = null;
    
            // If no cache, create it
            if (observer.cache[prop] === undefined) {
              // Capture Dependencies
              observer.target = prop;
    
              // Invoke getter
              cache = computed[prop].get.call(instance);
    
              // Stop Capturing Dependencies
              observer.target = null;
    
              // Store value in cache
              observer.cache[prop] = cache;
            } else {
              // Cache found, use it
              cache = observer.cache[prop];
            }
    
            return cache;
          },
          set: noop
        });
    
        // Add Setters
        var setter = null;
        if ((setter = computed[prop].set) !== undefined) {
          observer.setters[prop] = setter;
        }
      };
    
      // Set All Computed Properties
      for (var propName in computed) {
        setComputedProperty(propName);
      }
    };
    
    function Observer(instance) {
      // Associated Moon Instance
      this.instance = instance;
    
      // Computed Property Cache
      this.cache = {};
    
      // Computed Property Setters
      this.setters = {};
    
      // Set of events to clear cache when dependencies change
      this.clear = {};
    
      // Property Currently Being Observed for Dependencies
      this.target = null;
    
      // Dependency Map
      this.map = {};
    }
    
    Observer.prototype.observe = function (key) {
      var self = this;
      this.clear[key] = function () {
        self.cache[key] = undefined;
      };
    };
    
    Observer.prototype.notify = function (key, val) {
      var depMap = null;
      if ((depMap = this.map[key]) !== undefined) {
        for (var i = 0; i < depMap.length; i++) {
          this.notify(depMap[i]);
        }
      }
    
      var clear = null;
      if ((clear = this.clear[key]) !== undefined) {
        clear();
      }
    };
    
    /* ======= Global Utilities ======= */
    
    /**
     * Logs a Message
     * @param {String} msg
     */
    var log = function (msg) {
      if (!Moon.config.silent) console.log(msg);
    };
    
    /**
     * Throws an Error
     * @param {String} msg
     */
    var error = function (msg) {
      if (!Moon.config.silent) console.error("[Moon] ERR: " + msg);
    };
    
    /**
     * Adds DOM Updates to Queue
     * @param {Object} instance
     */
    var queueBuild = function (instance) {
      if (instance.$queued === false && instance.$destroyed === false) {
        instance.$queued = true;
        setTimeout(function () {
          instance.build();
          callHook(instance, 'updated');
          instance.$queued = false;
        }, 0);
      }
    };
    
    /**
     * Gives Default Metadata for a VNode
     * @return {Object} metadata
     */
    var defaultMetadata = function () {
      return {
        shouldRender: false,
        eventListeners: {}
      };
    };
    
    /**
     * Escapes a String
     * @param {String} str
     */
    var escapeString = function (str) {
      var NEWLINE_RE = /\n/g;
      var DOUBLE_QUOTE_RE = /"/g;
      var BACKSLASH_RE = /\\/g;
      return str.replace(BACKSLASH_RE, "\\\\").replace(DOUBLE_QUOTE_RE, "\\\"").replace(NEWLINE_RE, "\\n");
    };
    
    /**
     * Resolves an Object Keypath and Sets it
     * @param {Object} instance
     * @param {Object} obj
     * @param {String} keypath
     * @param {String} val
     * @return {Object} resolved object
     */
    var resolveKeyPath = function (instance, obj, keypath, val) {
      var i = null;
      keypath.replace(/\[(\w+)\]/g, function (match, index) {
        keypath = keypath.replace(match, '.' + index);
      });
      var path = keypath.split(".");
      for (i = 0; i < path.length - 1; i++) {
        var propName = path[i];
        obj = obj[propName];
      }
      obj[path[i]] = val;
      return path[0];
    };
    
    /**
     * Extracts the Slots From Component Children
     * @param {Array} children
     * @return {Object} extracted slots
     */
    var getSlots = function (children) {
      var slots = {};
    
      // Setup default slots
      var defaultSlotName = "default";
      slots[defaultSlotName] = [];
    
      // No Children Means No Slots
      if (children.length === 0) {
        return slots;
      }
    
      // Get rest of the slots
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        var childProps = child.props.attrs;
        var slotName = "";
    
        if ((slotName = childProps.slot) !== undefined) {
          if (slots[slotName] === undefined) {
            slots[slotName] = [child];
          } else {
            slots[slotName].push(child);
          }
          delete childProps.slot;
        } else {
          slots[defaultSlotName].push(child);
        }
      }
    
      return slots;
    };
    
    /**
     * Extends an Object with another Object's properties
     * @param {Object} parent
     * @param {Object} child
     * @return {Object} Extended Parent
     */
    var extend = function (parent, child) {
      for (var key in child) {
        parent[key] = child[key];
      }
      return parent;
    };
    
    /**
     * Merges Two Objects Together
     * @param {Object} parent
     * @param {Object} child
     * @return {Object} Merged Object
     */
    var merge = function (parent, child) {
      var merged = {};
      for (var key in parent) {
        merged[key] = parent[key];
      }
      for (var key in child) {
        merged[key] = child[key];
      }
      return merged;
    };
    
    /**
     * Calls a Hook
     * @param {Object} instance
     * @param {String} name
     */
    var callHook = function (instance, name) {
      var hook = instance.$hooks[name];
      if (hook !== undefined) {
        hook.call(instance);
      }
    };
    
    /**
     * Escapes String Values for a Regular Expression
     * @param {str} str
     */
    var escapeRegex = function (str) {
      return str.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&");
    };
    
    /**
     * Does No Operation
     */
    var noop = function () {};
    
    /**
     * Converts attributes into key-value pairs
     * @param {Node} node
     * @return {Object} Key-Value pairs of Attributes
     */
    var extractAttrs = function (node) {
      var attrs = {};
      for (var rawAttrs = node.attributes, i = rawAttrs.length; i--;) {
        attrs[rawAttrs[i].name] = rawAttrs[i].value;
      }
      return attrs;
    };
    
    /**
     * Adds metadata Event Listeners to an Element
     * @param {Object} node
     * @param {Object} vnode
     * @param {Object} instance
     */
    var addEventListeners = function (node, vnode, instance) {
      var eventListeners = vnode.meta.eventListeners;
      for (var type in eventListeners) {
        for (var i = 0; i < eventListeners[type].length; i++) {
          var method = eventListeners[type][i];
          node.addEventListener(type, method);
        }
      }
    };
    
    /**
     * Creates DOM Node from VNode
     * @param {Object} vnode
     * @param {Object} instance
     * @return {Object} DOM Node
     */
    var createNodeFromVNode = function (vnode, instance) {
      var el = null;
    
      if (vnode.type === "#text") {
        // Create textnode
        el = document.createTextNode(vnode.val);
      } else {
        el = vnode.meta.isSVG ? document.createElementNS('http://www.w3.org/2000/svg', vnode.type) : document.createElement(vnode.type);
        // Optimization: VNode only has one child that is text, and create it here
        if (vnode.children.length === 1 && vnode.children[0].type === "#text") {
          el.textContent = vnode.children[0].val;
          vnode.children[0].meta.el = el.firstChild;
        } else {
          // Add all children
          for (var i = 0; i < vnode.children.length; i++) {
            var childVNode = vnode.children[i];
            var childNode = createNodeFromVNode(vnode.children[i], instance);
            el.appendChild(childNode);
            // Component detected, mount it here
            if (childVNode.meta.component) {
              createComponentFromVNode(childNode, childVNode, childVNode.meta.component);
            }
          }
        }
        // Add all event listeners
        addEventListeners(el, vnode, instance);
      }
      // Setup Props
      diffProps(el, {}, vnode, vnode.props.attrs);
    
      // Hydrate
      vnode.meta.el = el;
    
      return el;
    };
    
    /**
     * Appends a Child, Ensuring Components are Mounted
     * @param {Object} node
     * @param {Object} vnode
     * @param {Object} parent
     */
    var appendChild = function (node, vnode, parent) {
      // Remove the node
      parent.appendChild(node);
    
      // Check for Component
      if (vnode.meta.component) {
        createComponentFromVNode(node, vnode, vnode.meta.component);
      }
    };
    
    /**
     * Removes a Child, Ensuring Components are Unmounted
     * @param {Object} node
     * @param {Object} parent
     */
    var removeChild = function (node, parent) {
      // Check for Component
      if (node.__moon__) {
        // Component was unmounted, destroy it here
        node.__moon__.destroy();
      }
    
      // Remove the Node
      parent.removeChild(node);
    };
    
    /**
     * Replaces a Child, Ensuring Components are Unmounted/Mounted
     * @param {Object} oldNode
     * @param {Object} newNode
     * @param {Object} vnode
     * @param {Object} parent
     */
    var replaceChild = function (oldNode, newNode, vnode, parent) {
      // Check for Component
      if (oldNode.__moon__) {
        // Component was unmounted, destroy it here
        oldNode.__moon__.destroy();
      }
    
      // Replace It
      parent.replaceChild(newNode, oldNode);
    
      // Check for Component
      if (vnode.meta.component) {
        createComponentFromVNode(newNode, vnode, vnode.meta.component);
      }
    };
    
    /**
     * Patch Types
     */
    var PATCH = {
      SKIP: 0,
      APPEND: 1,
      REMOVE: 2,
      REPLACE: 3,
      TEXT: 4,
      CHILDREN: 5
    };
    
    /**
     * Text VNode/Node Type
     */
    var TEXT_TYPE = "#text";
    
    /**
     * Creates a Virtual DOM Node
     * @param {String} type
     * @param {String} val
     * @param {Object} props
     * @param {Object} meta
     * @param {Array} children
     * @return {Object} Virtual DOM Node
     */
    var createElement = function (type, val, props, meta, children) {
      return {
        type: type,
        val: val,
        props: props,
        children: children,
        meta: meta || defaultMetadata()
      };
    };
    
    /**
     * Creates a Functional Component
     * @param {Object} props
     * @param {Array} children
     * @param {Object} functionalComponent
     * @return {Object} Virtual DOM Node
     */
    var createFunctionalComponent = function (props, children, functionalComponent) {
      var data = functionalComponent.opts.data || {};
    
      // Merge data with provided props
      if (functionalComponent.opts.props !== undefined) {
        var propNames = functionalComponent.opts.props;
    
        for (var i = 0; i < propNames.length; i++) {
          var prop = propNames[i];
          data[prop] = props.attrs[prop];
        }
      }
    
      // Call render function
      return functionalComponent.opts.render(h, {
        data: data,
        slots: getSlots(children)
      });
    };
    
    /**
     * Compiles Arguments to a VNode
     * @param {String} tag
     * @param {Object} attrs
     * @param {Object} meta
     * @param {Object|String} children
     * @return {Object} Object usable in Virtual DOM (VNode)
     */
    var h = function (tag, attrs, meta, children) {
      var component = null;
    
      if (tag === TEXT_TYPE) {
        // Text Node
        // Tag => #text
        // Attrs => meta
        // Meta => val
        return createElement(TEXT_TYPE, meta, { attrs: {} }, attrs, []);
      } else if ((component = components[tag]) !== undefined) {
        // Resolve Component
        if (component.opts.functional === true) {
          return createFunctionalComponent(attrs, children, components[tag]);
        } else {
          meta.component = component;
        }
      }
    
      return createElement(tag, "", attrs, meta, children);
    
      // In the end, we have a VNode structure like:
      // {
      //  type: 'h1', <= nodename
      //  props: {
      //    attrs: {id: 'someId'}, <= regular attributes
      //    dom: {textContent: 'some text content'} <= only for DOM properties added by directives,
      //    directives: {'m-mask': ''} <= any directives
      //  },
      //  meta: {}, <= metadata used internally
      //  children: [], <= any child nodes
      // }
    };
    
    /**
     * Mounts a Component To The DOM
     * @param {Object} node
     * @param {Object} vnode
     * @param {Object} component
     * @return {Object} DOM Node
     */
    var createComponentFromVNode = function (node, vnode, component) {
      var componentInstance = new component.CTor();
      // Merge data with provided props
      for (var i = 0; i < componentInstance.$props.length; i++) {
        var prop = componentInstance.$props[i];
        componentInstance.$data[prop] = vnode.props.attrs[prop];
      }
      componentInstance.$slots = getSlots(vnode.children);
      componentInstance.$el = node;
      componentInstance.build();
      callHook(componentInstance, 'mounted');
    
      // Rehydrate
      vnode.meta.el = componentInstance.$el;
    
      return componentInstance.$el;
    };
    
    /**
     * Diffs Props of Node and a VNode, and apply Changes
     * @param {Object} node
     * @param {Object} nodeProps
     * @param {Object} vnode
     */
    var diffProps = function (node, nodeProps, vnode) {
      // Get VNode Attributes
      var vnodeProps = vnode.props.attrs;
    
      // Diff VNode Props with Node Props
      for (var vnodePropName in vnodeProps) {
        var vnodePropValue = vnodeProps[vnodePropName];
        var nodePropValue = nodeProps[vnodePropName];
    
        if ((vnodePropValue !== undefined || vnodePropValue !== false || vnodePropValue !== null) && (nodePropValue === undefined || nodePropValue === false || nodePropValue === null || vnodePropValue !== nodePropValue)) {
          if (vnodePropName.length === 10 && vnodePropName === "xlink:href") {
            node.setAttributeNS('http://www.w3.org/1999/xlink', "href", vnodePropValue);
          } else {
            node.setAttribute(vnodePropName, vnodePropValue === true ? '' : vnodePropValue);
          }
        }
      }
    
      // Diff Node Props with VNode Props
      for (var nodePropName in nodeProps) {
        var _vnodePropValue = vnodeProps[nodePropName];
        if (_vnodePropValue === undefined || _vnodePropValue === false || _vnodePropValue === null) {
          node.removeAttribute(nodePropName);
        }
      }
    
      // Execute any directives
      if (vnode.props.directives !== undefined) {
        for (var directive in vnode.props.directives) {
          directives[directive](node, vnode.props.directives[directive], vnode);
        }
      }
    
      // Add/Update any DOM Props
      if (vnode.props.dom !== undefined) {
        for (var domProp in vnode.props.dom) {
          var domPropValue = vnode.props.dom[domProp];
          if (node[domProp] !== domPropValue) {
            node[domProp] = domPropValue;
          }
        }
      }
    };
    
    /**
     * Diffs a Component
     * @param {Object} node
     * @param {Object} vnode
     * @return {Object} adjusted node only if it was replaced
     */
    var diffComponent = function (node, vnode) {
      if (node.__moon__ === undefined) {
        // Not mounted, create a new instance and mount it here
        createComponentFromVNode(node, vnode, vnode.meta.component);
      } else {
        // Mounted already, need to update
        var componentInstance = node.__moon__;
        var componentChanged = false;
    
        // Merge any properties that changed
        for (var i = 0; i < componentInstance.$props.length; i++) {
          var prop = componentInstance.$props[i];
          if (componentInstance.$data[prop] !== vnode.props.attrs[prop]) {
            componentInstance.$data[prop] = vnode.props.attrs[prop];
            componentChanged = true;
          }
        }
    
        // If it has children, resolve any new slots
        if (vnode.children.length !== 0) {
          componentInstance.$slots = getSlots(vnode.children);
          componentChanged = true;
        }
    
        // If any changes were detected, build the component
        if (componentChanged === true) {
          componentInstance.build();
        }
      }
    };
    
    /**
     * Hydrates Node and a VNode
     * @param {Object} node
     * @param {Object} vnode
     * @param {Object} parent
     * @param {Object} instance
     * @return {Object} adjusted node only if it was replaced
     */
    var hydrate = function (node, vnode, parent, instance) {
      var nodeName = node ? node.nodeName.toLowerCase() : null;
    
      if (node === null) {
        // No node, create one
        var newNode = createNodeFromVNode(vnode, instance);
        appendChild(newNode, vnode, parent);
    
        return newNode;
      } else if (vnode === null) {
        removeChild(node, parent);
    
        return null;
      } else if (nodeName !== vnode.type) {
        var newNode = createNodeFromVNode(vnode, instance);
        replaceChild(node, newNode, vnode, parent);
        return newNode;
      } else if (vnode.type === TEXT_TYPE) {
        if (nodeName === TEXT_TYPE) {
          // Both are textnodes, update the node
          if (node.textContent !== vnode.val) {
            node.textContent = vnode.val;
          }
    
          // Hydrate
          vnode.meta.el = node;
        } else {
          // Node isn't text, replace with one
          replaceChild(node, createNodeFromVNode(vnode, instance), vnode, parent);
        }
    
        return node;
      } else {
        // Hydrate
        vnode.meta.el = node;
    
        // Check for Component
        if (vnode.meta.component !== undefined) {
          // Diff the Component
          diffComponent(node, vnode);
    
          // Skip diffing any children
          return node;
        }
    
        // Diff props
        diffProps(node, extractAttrs(node), vnode);
    
        // Add event listeners
        addEventListeners(node, vnode, instance);
    
        // Check if innerHTML was changed, and don't diff children if so
        if (vnode.props.dom !== undefined && vnode.props.dom.innerHTML !== undefined) {
          return node;
        }
    
        // Hydrate Children
        var vnodeChildrenLength = vnode.children.length;
    
        var i = 0;
        var currentChildNode = node.firstChild;
        var vchild = vnodeChildrenLength !== 0 ? vnode.children[0] : null;
    
        while (vchild !== null || currentChildNode !== null) {
          var next = currentChildNode ? currentChildNode.nextSibling : null;
          hydrate(currentChildNode, vchild, node, instance);
          vchild = ++i < vnodeChildrenLength ? vnode.children[i] : null;
          currentChildNode = next;
        }
    
        return node;
      }
    };
    
    /**
     * Diffs VNodes, and applies Changes
     * @param {Object} oldVNode
     * @param {Object} vnode
     * @param {Object} parent
     * @param {Object} instance
     * @return {Number} patch type
     */
    var diff = function (oldVNode, vnode, parent, instance) {
      if (oldVNode === null) {
        // No Node, append a node
        appendChild(createNodeFromVNode(vnode, instance), vnode, parent);
    
        return PATCH.APPEND;
      } else if (vnode === null) {
        // No New VNode, remove Node
        removeChild(oldVNode.meta.el, parent);
    
        return PATCH.REMOVE;
      } else if (oldVNode === vnode) {
        // Both have the same reference, skip
        return PATCH.SKIP;
      } else if (oldVNode.type !== vnode.type) {
        // Different types, replace it
        replaceChild(oldVNode.meta.el, createNodeFromVNode(vnode, instance), vnode, parent);
    
        return PATCH.REPLACE;
      } else if (vnode.meta.shouldRender === true && vnode.type === TEXT_TYPE) {
        var node = oldVNode.meta.el;
    
        if (oldVNode.type === TEXT_TYPE) {
          // Both are textnodes, update the node
          if (vnode.val !== oldVNode.val) {
            node.textContent = vnode.val;
          }
    
          return PATCH.TEXT;
        } else {
          // Node isn't text, replace with one
          replaceChild(node, createNodeFromVNode(vnode, instance), vnode, parent);
          return PATCH.REPLACE;
        }
      } else if (vnode.meta.shouldRender === true) {
        var _node = oldVNode.meta.el;
    
        // Check for Component
        if (vnode.meta.component !== undefined) {
          // Diff Component
          diffComponent(_node, vnode);
    
          // Skip diffing any children
          return PATCH.SKIP;
        }
    
        // Diff props
        diffProps(_node, oldVNode.props.attrs, vnode);
        oldVNode.props.attrs = vnode.props.attrs;
    
        // Check if innerHTML was changed, don't diff children
        if (vnode.props.dom !== undefined && vnode.props.dom.innerHTML !== undefined) {
          // Skip Children
          return PATCH.SKIP;
        }
    
        // Diff Children
        var newLength = vnode.children.length;
        var oldLength = oldVNode.children.length;
    
        if (newLength === 0) {
          // No Children, Remove all Children if not Already Removed
          if (oldLength !== 0) {
            var firstChild = null;
            while ((firstChild = _node.firstChild) !== null) {
              removeChild(firstChild, _node);
            }
            oldVNode.children = [];
          }
        } else {
          // Traverse and Diff Children
          var totalLen = newLength > oldLength ? newLength : oldLength;
          for (var i = 0; i < totalLen; i++) {
            var oldChild = i < oldLength ? oldVNode.children[i] : null;
            var child = i < newLength ? vnode.children[i] : null;
    
            var action = diff(oldChild, child, _node, instance);
    
            // Update Children to Match Action
            switch (action) {
              case PATCH.APPEND:
                oldVNode.children[oldLength++] = child;
                break;
              case PATCH.REMOVE:
                oldVNode.children.splice(i, 1);
                oldLength--;
                break;
              case PATCH.REPLACE:
                oldVNode.children[i] = vnode.children[i];
                break;
              case PATCH.TEXT:
                oldChild.val = child.val;
                break;
            }
          }
        }
    
        return PATCH.CHILDREN;
      } else {
        // Nothing Changed, Rehydrate and Exit
        vnode.meta.el = oldVNode.meta.el;
        return PATCH.SKIP;
      }
    };
    
    /* ======= Compiler ======= */
    var whitespaceRE = /\s/;
    var expressionRE = /"[^"]*"|'[^']*'|\.\w*[a-zA-Z$_]\w*|(\w*[a-zA-Z$_]\w*)/g;
    
    /**
     * Compiles a Template
     * @param {String} template
     * @param {Array} delimiters
     * @param {Array} escapedDelimiters
     * @param {Boolean} isString
     * @return {String} compiled template
     */
    var compileTemplate = function (template, delimiters, escapedDelimiters, isString) {
      var state = {
        current: 0,
        template: template,
        output: "",
        openDelimiterLen: delimiters[0].length,
        closeDelimiterLen: delimiters[1].length,
        openRE: new RegExp(escapedDelimiters[0]),
        closeRE: new RegExp('\\s*' + escapedDelimiters[1])
      };
    
      compileTemplateState(state, isString);
    
      return state.output;
    };
    
    var compileTemplateState = function (state, isString) {
      var template = state.template;
      var length = template.length;
      while (state.current < length) {
        // Match Text Between Templates
        var value = scanTemplateStateUntil(state, state.openRE);
    
        if (value) {
          state.output += escapeString(value);
        }
    
        // If we've reached the end, there are no more templates
        if (state.current === length) {
          break;
        }
    
        // Exit Opening Delimiter
        state.current += state.openDelimiterLen;
    
        // Consume whitespace
        scanTemplateStateForWhitespace(state);
    
        // Get the name of the opening tag
        var name = scanTemplateStateUntil(state, state.closeRE);
    
        // If we've reached the end, the tag was unclosed
        if (state.current === length) {
          if ("development" !== "production") {
            error('Expected closing delimiter "}}" after "' + name + '"');
          }
          break;
        }
    
        if (name) {
          // Extract Variable References
          name = "(" + name.replace(expressionRE, function (match, reference) {
            if (reference !== undefined) {
              return 'instance.get("' + reference + '")';
            } else {
              return match;
            }
          }) + ")";
    
          // Add quotes if string
          if (isString) {
            name = '" + ' + name + ' + "';
          }
    
          // Generate code
          state.output += name;
        }
    
        // Consume whitespace
        scanTemplateStateForWhitespace(state);
    
        // Exit closing delimiter
        state.current += state.closeDelimiterLen;
      }
    };
    
    var scanTemplateStateUntil = function (state, re) {
      var template = state.template;
      var tail = template.substring(state.current);
      var length = tail.length;
      var idx = tail.search(re);
    
      var match = "";
    
      switch (idx) {
        case -1:
          match = tail;
          break;
        case 0:
          match = '';
          break;
        default:
          match = tail.substring(0, idx);
      }
    
      state.current += match.length;
    
      return match;
    };
    
    var scanTemplateStateForWhitespace = function (state) {
      var template = state.template;
      var char = template[state.current];
      while (whitespaceRE.test(char)) {
        char = template[++state.current];
      }
    };
    
    var tagStartRE = /<[\w/]\s*/;
    
    var lex = function (input) {
      var state = {
        input: input,
        current: 0,
        tokens: []
      };
      lexState(state);
      return state.tokens;
    };
    
    var lexState = function (state) {
      var input = state.input;
      var len = input.length;
      while (state.current < len) {
        // Check if it is text
        if (input.charAt(state.current) !== "<") {
          lexText(state);
          continue;
        }
    
        // Check if it is a comment
        if (input.substr(state.current, 4) === "<!--") {
          lexComment(state);
          continue;
        }
    
        // It's a tag
        lexTag(state);
      }
    };
    
    var lexText = function (state) {
      var input = state.input;
      var len = input.length;
      var endOfText = input.substring(state.current).search(tagStartRE);
    
      // Only Text
      if (endOfText === -1) {
        state.tokens.push({
          type: "text",
          value: input.slice(state.current)
        });
        state.current = len;
        return;
      }
    
      // No Text at All
      if (endOfText === 0) {
        return;
      }
    
      // End of Text Found
      endOfText += state.current;
      state.tokens.push({
        type: "text",
        value: input.slice(state.current, endOfText)
      });
      state.current = endOfText;
    };
    
    var lexComment = function (state) {
      var input = state.input;
      var len = input.length;
      state.current += 4;
      var endOfComment = input.indexOf("-->", state.current);
    
      // Only an unclosed comment
      if (endOfComment === -1) {
        state.tokens.push({
          type: "comment",
          value: input.slice(state.current)
        });
        state.current = len;
        return;
      }
    
      // End of Comment Found
      state.tokens.push({
        type: "comment",
        value: input.slice(state.current, endOfComment)
      });
      state.current = endOfComment + 3;
    };
    
    var lexTag = function (state) {
      var input = state.input;
      var len = input.length;
    
      // Lex Starting of Tag
      var isClosingStart = input.charAt(state.current + 1) === "/";
      state.current += isClosingStart ? 2 : 1;
    
      // Lex type and attributes
      var tagToken = lexTagType(state);
      lexAttributes(tagToken, state);
    
      // Lex ending tag
      var isClosingEnd = input.charAt(state.current) === "/";
      state.current += isClosingEnd ? 2 : 1;
    
      // Check if Closing Start
      if (isClosingStart) {
        tagToken.closeStart = true;
      }
    
      // Check if Closing End
      if (isClosingEnd) {
        tagToken.closeEnd = true;
      }
    };
    
    var lexTagType = function (state) {
      var input = state.input;
      var len = input.length;
      var current = state.current;
      var tagType = "";
      while (current < len) {
        var char = input.charAt(current);
        if (char === "/" || char === ">" || char === " ") {
          break;
        } else {
          tagType += char;
        }
        current++;
      }
    
      var tagToken = {
        type: "tag",
        value: tagType
      };
    
      state.tokens.push(tagToken);
    
      state.current = current;
      return tagToken;
    };
    
    var lexAttributes = function (tagToken, state) {
      var input = state.input;
      var len = input.length;
      var current = state.current;
      var char = input.charAt(current);
      var nextChar = input.charAt(current + 1);
    
      var incrementChar = function () {
        current++;
        char = input.charAt(current);
        nextChar = input.charAt(current + 1);
      };
    
      var attributes = {};
    
      while (current < len) {
        // If it is the end of a tag, exit
        if (char === ">" || char === "/" && nextChar === ">") {
          break;
        }
    
        // If there is a space, the attribute ended
        if (char === " ") {
          incrementChar();
          continue;
        }
    
        // Get the name of the attribute
        var attrName = "";
        var noValue = false;
    
        while (current < len && char !== "=") {
          if (char !== " " && char !== ">" && char !== "/" && nextChar !== ">") {
            attrName += char;
          } else {
            noValue = true;
            break;
          }
          incrementChar();
        }
    
        var attrValue = {
          name: attrName,
          value: "",
          meta: {}
        };
    
        if (noValue) {
          attributes[attrName] = attrValue;
          continue;
        }
    
        // Exit Equal Sign
        incrementChar();
    
        // Get the type of quote used
        var quoteType = " ";
        if (char === "'" || char === "\"") {
          quoteType = char;
    
          // Exit the quote
          incrementChar();
        }
    
        // Find the end of it
        while (current < len && char !== quoteType) {
          attrValue.value += char;
          incrementChar();
        }
    
        // Exit the end of it
        incrementChar();
    
        // Check for an Argument
        var argIndex = attrName.indexOf(":");
        if (argIndex !== -1) {
          var splitAttrName = attrName.split(":");
          attrValue.name = splitAttrName[0];
          attrValue.meta.arg = splitAttrName[1];
        }
    
        // Setup the Value
        attributes[attrName] = attrValue;
      }
    
      state.current = current;
      tagToken.attributes = attributes;
    };
    
    var parse = function (tokens) {
      var root = {
        type: "ROOT",
        children: []
      };
    
      var state = {
        current: 0,
        tokens: tokens
      };
    
      while (state.current < tokens.length) {
        var child = walk(state);
        if (child) {
          root.children.push(child);
        }
      }
    
      return root;
    };
    
    var VOID_ELEMENTS = ["area", "base", "br", "command", "embed", "hr", "img", "input", "keygen", "link", "meta", "param", "source", "track", "wbr"];
    var SVG_ELEMENTS = ["svg", "animate", "circle", "clippath", "cursor", "defs", "desc", "ellipse", "filter", "font-face", "foreignObject", "g", "glyph", "image", "line", "marker", "mask", "missing-glyph", "path", "pattern", "polygon", "polyline", "rect", "switch", "symbol", "text", "textpath", "tspan", "use", "view"];
    
    var createParseNode = function (type, props, children) {
      return {
        type: type,
        props: props,
        children: children
      };
    };
    
    var walk = function (state) {
      var token = state.tokens[state.current];
      var previousToken = state.tokens[state.current - 1];
      var nextToken = state.tokens[state.current + 1];
    
      var increment = function (num) {
        state.current += num === undefined ? 1 : num;
        token = state.tokens[state.current];
        previousToken = state.tokens[state.current - 1];
        nextToken = state.tokens[state.current + 1];
      };
    
      if (token.type === "text") {
        increment();
        return previousToken.value;
      }
    
      if (token.type === "comment") {
        increment();
        return null;
      }
    
      // Start of new Tag
      if (token.type === "tag") {
        var tagType = token.value;
        var closeStart = token.closeStart;
        var closeEnd = token.closeEnd;
    
        var isSVGElement = SVG_ELEMENTS.indexOf(tagType) !== -1;
        var isVoidElement = VOID_ELEMENTS.indexOf(tagType) !== -1;
    
        var node = createParseNode(tagType, token.attributes, []);
    
        increment();
    
        // If it is an svg element, let code generator know
        if (isSVGElement) {
          node.isSVG = true;
        }
    
        if (isVoidElement) {
          // Self closing, don't process further
          return node;
        } else if (closeStart === true) {
          // Unmatched closing tag on non void element
          return null;
        } else if (token !== undefined) {
          // Match all children
          var current = state.current;
          while (token.type !== "tag" || token.type === "tag" && (token.closeStart === undefined && token.closeEnd === undefined || token.value !== tagType)) {
            var parsedChildState = walk(state);
            if (parsedChildState !== null) {
              node.children.push(parsedChildState);
            }
            increment(0);
            if (token === undefined) {
              // No token means a tag was most likely left unclosed
              if ("development" !== "production") {
                error('The element "' + node.type + '" was left unclosed.');
              }
              break;
            }
          }
    
          increment();
        }
    
        return node;
      }
    
      increment();
      return;
    };
    
    /**
     * Delimiters (updated every time generation is called)
     */
    var delimiters = null;
    
    /**
     * Escaped Delimiters
     */
    var escapedDelimiters = null;
    
    /**
     * Generates Code for Props
     * @param {Object} vnode
     * @param {Object} parentVNode
     * @return {String} generated code
     */
    var generateProps = function (vnode, parentVNode) {
      var attrs = vnode.props.attrs;
      var generatedObject = "{attrs: {";
    
      // Array of all directives (to be generated later)
      vnode.props.directives = [];
    
      if (attrs) {
        // Invoke any special directives that need to change values before code generation
        for (var beforeAttr in attrs) {
          var beforeAttrInfo = attrs[beforeAttr];
          var beforeAttrName = beforeAttrInfo.name;
          var beforeSpecialDirective = null;
    
          if ((beforeSpecialDirective = specialDirectives[beforeAttrName]) !== undefined && beforeSpecialDirective.beforeGenerate) {
            beforeSpecialDirective.beforeGenerate(beforeAttrInfo.value, beforeAttrInfo.meta, vnode, parentVNode);
          }
        }
    
        // Generate all other attributes
        for (var attr in attrs) {
          // Attribute Info
          var attrInfo = attrs[attr];
    
          // Get attr by it's actual name (in case it had any arguments)
          var attrName = attrInfo.name;
    
          // Late bind for special directive
          var specialDirective = null;
    
          // If it is a directive, mark it as dynamic
          if ((specialDirective = specialDirectives[attrName]) !== undefined) {
            // Generate Special Directives
            // Special directive found that generates code after initial generation, push it to its known special directives to run afterGenerate later
            if (specialDirective.afterGenerate !== undefined) {
              if (vnode.specialDirectivesAfter === undefined) {
                vnode.specialDirectivesAfter = {};
              }
              vnode.specialDirectivesAfter[attr] = attrInfo;
            }
    
            // Invoke any special directives that need to change values of props during code generation
            if (specialDirective.duringPropGenerate !== undefined) {
              generatedObject += specialDirective.duringPropGenerate(attrInfo.value, attrInfo.meta, vnode);
            }
    
            // Keep a flag to know to always rerender this
            vnode.meta.shouldRender = true;
    
            // Remove special directive
            delete attrs[attr];
          } else if (directives[attrName] !== undefined) {
            vnode.props.directives.push(attrInfo);
            vnode.meta.shouldRender = true;
          } else {
            var propValue = attrInfo.value;
            var compiledProp = compileTemplate(propValue, delimiters, escapedDelimiters, true);
            if (propValue !== compiledProp) {
              vnode.meta.shouldRender = true;
            }
            generatedObject += '"' + attr + '": "' + compiledProp + '", ';
          }
        }
    
        // Close object
        if (Object.keys(attrs).length !== 0) {
          generatedObject = generatedObject.slice(0, -2) + "}";
        } else {
          generatedObject += "}";
        }
      }
    
      // Check for DOM Properties
      var dom = vnode.props.dom;
      if (dom !== undefined) {
        vnode.meta.shouldRender = true;
        // Add dom property
        generatedObject += ", dom: {";
    
        // Generate all properties
        for (var domProp in dom) {
          generatedObject += '"' + domProp + '": ' + dom[domProp] + ', ';
        }
    
        // Close object
        generatedObject = generatedObject.slice(0, -2) + "}";
      }
    
      // Check for Directives
      var allDirectives = vnode.props.directives;
      if (allDirectives.length !== 0) {
        generatedObject += ", directives: {";
    
        for (var i = 0; i < allDirectives.length; i++) {
          var directiveInfo = allDirectives[i];
          // If literal, then add value as a literal expression, or escape it
          var normalizedValue = directiveInfo.literal ? directiveInfo.value : JSON.stringify(directiveInfo.value);
          generatedObject += '"' + directiveInfo.name + '": ' + normalizedValue + ', ';
        }
    
        // Close object
        generatedObject = generatedObject.slice(0, -2) + "}";
      }
    
      // Close the final generated object
      generatedObject += "}";
      return generatedObject;
    };
    
    /**
     * Generates Code for Event Listeners
     * @param {Object} listeners
     * @return {String} generated code
     */
    var generateEventListeners = function (listeners) {
      // If no listeners, return empty object
      if (Object.keys(listeners).length === 0) {
        return "{}";
      }
    
      // Begin object
      var generatedObject = "{";
    
      // Generate an array for all listeners
      for (var type in listeners) {
        generatedObject += '"' + type + '": [' + generateArray(listeners[type]) + '], ';
      }
    
      // Close object
      generatedObject = generatedObject.slice(0, -2) + "}";
    
      return generatedObject;
    };
    
    /**
     * Generates Code for Metadata
     * @param {Object} meta
     * @return {String} generated code
     */
    var generateMeta = function (meta) {
      // Begin generated object
      var generatedObject = "{";
    
      // Generate all metadata
      for (var key in meta) {
        if (key === 'eventListeners') {
          generatedObject += '"' + key + '": ' + generateEventListeners(meta[key]) + ', ';
        } else {
          generatedObject += '"' + key + '": ' + meta[key] + ', ';
        }
      }
    
      // Close object
      generatedObject = generatedObject.slice(0, -2) + "}";
    
      return generatedObject;
    };
    
    /**
     * Generates Code for an Array
     * @param {Array} arr
     * @return {String} generated array
     */
    var generateArray = function (arr) {
      // Begin array
      var generatedArray = "";
    
      // Generate all items (literal expressions)
      for (var i = 0; i < arr.length; i++) {
        generatedArray += arr[i] + ', ';
      }
    
      // Close array
      generatedArray = generatedArray.slice(0, -2);
    
      return generatedArray;
    };
    
    /**
     * Creates an "h" Call for a VNode
     * @param {Object} vnode
     * @param {Object} parentVNode
     * @return {String} "h" call
     */
    var createCall = function (vnode, parentVNode) {
      // Generate Code for Type
      var call = 'h("' + vnode.type + '", ';
    
      // Generate Code for Props
      call += generateProps(vnode, parentVNode) + ", ";
    
      // Generate code for children recursively here (in case modified by special directives)
      var children = vnode.children.map(function (vchild) {
        return generateEl(vchild, vnode);
      });
    
      // If the "shouldRender" flag is not present, ensure node will be updated
      if (vnode.meta.shouldRender === true && parentVNode !== undefined) {
        parentVNode.meta.shouldRender = true;
      }
    
      // Generate Code for Metadata
      call += generateMeta(vnode.meta);
    
      // Generate Code for Children
      if (children.length !== 0) {
        if (vnode.deep === true) {
          // If deep, flatten it in the code
          call += ', [].concat.apply([], [' + generateArray(children) + '])';
        } else {
          // Not deep, generate a shallow array
          call += ', [' + generateArray(children) + ']';
        }
      } else {
        // No children, empty array
        call += ", []";
      }
    
      // Close Call
      call += ")";
      return call;
    };
    
    var generateEl = function (vnode, parentVNode) {
      var code = "";
    
      if (typeof vnode === "string") {
        // Escape newlines and double quotes, and compile the string
        var escapedString = vnode;
        var compiledText = compileTemplate(escapedString, delimiters, escapedDelimiters, true);
        var textMeta = defaultMetadata();
    
        if (escapedString !== compiledText) {
          parentVNode.meta.shouldRender = true;
          textMeta.shouldRender = true;
        }
    
        code += 'h("#text", ' + generateMeta(textMeta) + ', "' + compiledText + '")';
      } else {
        // Recursively generate code for children
    
        // Generate Metadata if not Already
        if (!vnode.meta) {
          vnode.meta = defaultMetadata();
        }
    
        // Detect SVG Element
        if (vnode.isSVG) {
          vnode.meta.isSVG = true;
        }
    
        // Setup Nested Attributes within Properties
        vnode.props = {
          attrs: vnode.props
        };
    
        // Create a Call for the Element, or Register a Slot
        var compiledCode = "";
    
        if (vnode.type === "slot") {
          parentVNode.meta.shouldRender = true;
          parentVNode.deep = true;
    
          var slotNameAttr = vnode.props.attrs.name;
          compiledCode = 'instance.$slots[\'' + (slotNameAttr && slotNameAttr.value || "default") + '\']';
        } else {
          compiledCode = createCall(vnode, parentVNode);
        }
    
        // Check for Special Directives that change the code after generation and run them
        if (vnode.specialDirectivesAfter !== undefined) {
          for (var specialDirectiveAfterInfo in vnode.specialDirectivesAfter) {
            var specialDirectiveAfter = vnode.specialDirectivesAfter[specialDirectiveAfterInfo];
            compiledCode = specialDirectives[specialDirectiveAfter.name].afterGenerate(specialDirectiveAfter.value, specialDirectiveAfter.meta, compiledCode, vnode);
          }
        }
        code += compiledCode;
      }
      return code;
    };
    
    var generate = function (ast) {
      // Get root element
      var root = ast.children[0];
    
      // Update delimiters if needed
      var newDelimeters = null;
      if ((newDelimeters = Moon.config.delimiters) !== delimiters) {
        delimiters = newDelimeters;
    
        // Escape delimiters
        escapedDelimiters = new Array(2);
        escapedDelimiters[0] = escapeRegex(delimiters[0]);
        escapedDelimiters[1] = escapeRegex(delimiters[1]);
      }
    
      // Begin Code
      var code = "var instance = this; return " + generateEl(root);
    
      try {
        return new Function("h", code);
      } catch (e) {
        error("Could not create render function");
        return noop;
      }
    };
    
    var compile = function (template) {
      var tokens = lex(template);
      var ast = parse(tokens);
      return generate(ast);
    };
    
    function Moon(opts) {
      /* ======= Initial Values ======= */
      this.$opts = opts || {};
    
      // Reference to Instance
      var self = this;
    
      // Unique ID for Instance
      this.$id = id++;
    
      // Readable name (component name or "root")
      this.$name = this.$opts.name || "root";
    
      // Custom Data
      this.$data = this.$opts.data || {};
    
      // Render function
      this.$render = this.$opts.render || noop;
    
      // Hooks
      this.$hooks = this.$opts.hooks || {};
    
      // Custom Methods
      var methods = this.$opts.methods;
      if (methods !== undefined) {
        initMethods(self, methods);
      }
    
      // Events
      this.$events = {};
    
      // Virtual DOM
      this.$dom = {};
    
      // Observer
      this.$observer = new Observer(this);
    
      // Destroyed State
      this.$destroyed = true;
    
      // State of Queue
      this.$queued = false;
    
      // Setup Computed Properties
      var computed = this.$opts.computed;
      if (computed !== undefined) {
        initComputed(this, computed);
      }
    
      /* ======= Initialize 🎉 ======= */
      this.init();
    }
    
    /* ======= Instance Methods ======= */
    
    /**
     * Gets Value in Data
     * @param {String} key
     * @return {String} Value of key in data
     */
    Moon.prototype.get = function (key) {
      // Collect dependencies if currently collecting
      var observer = this.$observer;
      var target = null;
      if ((target = observer.target) !== null) {
        if (observer.map[key] === undefined) {
          observer.map[key] = [target];
        } else if (observer.map[key].indexOf(target) === -1) {
          observer.map[key].push(target);
        }
      }
    
      // Return value found
      if ("development" !== "production" && !(key in this.$data)) {
        error('The item "' + key + '" was not defined but was referenced.');
      }
      return this.$data[key];
    };
    
    /**
     * Sets Value in Data
     * @param {String} key
     * @param {String} val
     */
    Moon.prototype.set = function (key, val) {
      // Get observer
      var observer = this.$observer;
    
      // Get base of keypath
      var base = resolveKeyPath(this, this.$data, key, val);
    
      // Invoke custom setter
      var setter = null;
      if ((setter = observer.setters[base]) !== undefined) {
        setter.call(this, val);
      }
    
      // Notify observer of change
      observer.notify(base, val);
    
      // Queue a build
      queueBuild(this);
    };
    
    /**
     * Destroys Moon Instance
     */
    Moon.prototype.destroy = function () {
      // Remove event listeners
      this.off();
    
      // Remove reference to element
      this.$el = null;
    
      // Setup destroyed state
      this.$destroyed = true;
    
      // Call destroyed hook
      callHook(this, 'destroyed');
    };
    
    /**
     * Calls a method
     * @param {String} method
     */
    Moon.prototype.callMethod = function (method, args) {
      // Get arguments
      args = args || [];
    
      // Call method in context of instance
      this.$data[method].apply(this, args);
    };
    
    // Event Emitter, adapted from https://github.com/KingPixil/voke
    
    /**
     * Attaches an Event Listener
     * @param {String} eventName
     * @param {Function} handler
     */
    Moon.prototype.on = function (eventName, handler) {
      // Get list of handlers
      var handlers = this.$events[eventName];
    
      if (handlers === undefined) {
        // If no handlers, create them
        this.$events[eventName] = [handler];
      } else {
        // If there are already handlers, add it to the list of them
        handlers.push(handler);
      }
    };
    
    /**
     * Removes an Event Listener
     * @param {String} eventName
     * @param {Function} handler
     */
    Moon.prototype.off = function (eventName, handler) {
      if (eventName === undefined) {
        // No event name provided, remove all events
        this.$events = {};
      } else if (handler === undefined) {
        // No handler provided, remove all handlers for the event name
        this.$events[eventName] = [];
      } else {
        // Get handlers from event name
        var handlers = this.$events[eventName];
    
        // Get index of the handler to remove
        var index = handlers.indexOf(handler);
    
        // Remove the handler
        handlers.splice(index, 1);
      }
    };
    
    /**
     * Emits an Event
     * @param {String} eventName
     * @param {Object} customMeta
     */
    Moon.prototype.emit = function (eventName, customMeta) {
      // Setup metadata to pass to event
      var meta = customMeta || {};
      meta.type = eventName;
    
      // Get handlers and global handlers
      var handlers = this.$events[eventName];
      var globalHandlers = this.$events["*"];
    
      // Call all handlers for the event name
      for (var i = 0; i < handlers.length; i++) {
        handlers[i](meta);
      }
    
      if (globalHandlers !== undefined) {
        // Call all of the global handlers if present
        for (var i = 0; i < globalHandlers.length; i++) {
          globalHandlers[i](meta);
        }
      }
    };
    
    /**
     * Renders "m-for" Directive Array
     * @param {Array} arr
     * @param {Function} item
     */
    Moon.prototype.renderLoop = function (arr, item) {
      // Get the amount of items (vnodes) to be created
      var items = new Array(arr.length);
    
      // Call the function and get the item for the current index
      for (var i = 0; i < arr.length; i++) {
        items[i] = item(arr[i], i);
      }
    
      return items;
    };
    
    /**
     * Renders a Class in Array/Object Form
     * @param {Array|Object|String} classNames
     * @return {String} renderedClassNames
     */
    Moon.prototype.renderClass = function (classNames) {
      if (typeof classNames === "string") {
        // If they are a string, no need for any more processing
        return classNames;
      }
    
      var renderedClassNames = "";
      if (Array.isArray(classNames)) {
        // It's an array, so go through them all and generate a string
        for (var i = 0; i < classNames.length; i++) {
          renderedClassNames += this.renderClass(classNames[i]) + ' ';
        }
      } else if (typeof classNames === "object") {
        // It's an object, so to through and render them to a string if the corresponding condition is true
        for (var className in classNames) {
          if (classNames[className]) {
            renderedClassNames += className + ' ';
          }
        }
      }
    
      // Remove trailing space and return
      renderedClassNames = renderedClassNames.slice(0, -1);
      return renderedClassNames;
    };
    
    /**
     * Mounts Moon Element
     * @param {Object} el
     */
    Moon.prototype.mount = function (el) {
      // Get element from the DOM
      this.$el = typeof el === 'string' ? document.querySelector(el) : el;
    
      // Remove destroyed state
      this.$destroyed = false;
    
      if ("development" !== "production" && this.$el === null) {
        // Element not found
        error("Element " + this.$opts.el + " not found");
      }
    
      // Sync Element and Moon instance
      this.$el.__moon__ = this;
    
      // Setup template as provided `template` or outerHTML of the Element
      this.$template = this.$opts.template || this.$el.outerHTML;
    
      // Setup render Function
      if (this.$render === noop) {
        this.$render = Moon.compile(this.$template);
      }
    
      // Run First Build
      this.build();
    
      // Call mounted hook
      callHook(this, 'mounted');
    };
    
    /**
     * Renders Virtual DOM
     * @return Virtual DOM
     */
    Moon.prototype.render = function () {
      // Call render function
      return this.$render(h);
    };
    
    /**
     * Diff then Patches Nodes With Data
     * @param {Object} old
     * @param {Object} vnode
     * @param {Object} parent
     */
    Moon.prototype.patch = function (old, vnode, parent) {
      if (old.meta !== undefined && old.meta.el !== undefined) {
        // If it is not a VNode, then diff
        if (vnode.type !== old.type) {
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
      } else if (old instanceof Node) {
        // Hydrate
        var newNode = hydrate(old, vnode, parent, this);
    
        if (newNode !== old) {
          // Root Element Changed During Hydration
          this.$el = vnode.meta.el;
          this.$el.__moon__ = this;
        }
      }
    };
    
    /**
     * Render and Patches the DOM With Data
     */
    Moon.prototype.build = function () {
      // Get new virtual DOM
      var dom = this.render();
    
      // Old item to patch
      var old = null;
    
      if (this.$dom.meta !== undefined) {
        // If old virtual dom exists, patch against it
        old = this.$dom;
      } else {
        // No virtual DOM, patch with actual DOM element, and setup virtual DOM
        old = this.$el;
        this.$dom = dom;
      }
    
      // Patch old and new
      this.patch(old, dom, this.$el.parentNode);
    };
    
    /**
     * Initializes Moon
     */
    Moon.prototype.init = function () {
      log("======= Moon =======");
      callHook(this, 'init');
    
      if (this.$opts.el !== undefined) {
        this.mount(this.$opts.el);
      }
    };
    
    /* ======= Global API ======= */
    
    /**
     * Configuration of Moon
     */
    Moon.config = {
      silent: "development" === "production" || typeof console === 'undefined',
      prefix: "m-",
      delimiters: ["{{", "}}"],
      keyCodes: function (keyCodes) {
        for (var keyCode in keyCodes) {
          eventModifiersCode[keyCode] = 'if(event.keyCode !== ' + keyCodes[keyCode] + ') {return;};';
        }
      }
    };
    
    /**
     * Version of Moon
     */
    Moon.version = '0.9.0';
    
    /**
     * Moon Utilities
     */
    Moon.util = {
      noop: noop,
      error: error,
      log: log,
      merge: merge,
      extend: extend,
      h: h
    };
    
    /**
     * Runs an external Plugin
     * @param {Object} plugin
     */
    Moon.use = function (plugin) {
      plugin.init(Moon);
    };
    
    /**
     * Compiles HTML to a Render Function
     * @param {String} template
     * @return {Function} render function
     */
    Moon.compile = function (template) {
      return compile(template);
    };
    
    /**
     * Runs a Task After Update Queue
     * @param {Function} task
     */
    Moon.nextTick = function (task) {
      setTimeout(task, 0);
    };
    
    /**
     * Creates a Directive
     * @param {String} name
     * @param {Function} action
     */
    Moon.directive = function (name, action) {
      directives[Moon.config.prefix + name] = action;
    };
    
    /**
     * Creates a Component
     * @param {String} name
     * @param {Function} action
     */
    Moon.component = function (name, opts) {
      var Parent = this;
    
      if (opts.name) {
        name = opts.name;
      } else {
        opts.name = name;
      }
    
      function MoonComponent() {
        Moon.call(this, opts);
      }
    
      MoonComponent.prototype = Object.create(Parent.prototype);
      MoonComponent.prototype.constructor = MoonComponent;
    
      MoonComponent.prototype.init = function () {
        callHook(this, 'init');
        this.$destroyed = false;
        this.$props = this.$opts.props || [];
    
        this.$template = this.$opts.template;
    
        if (this.$render === noop) {
          this.$render = Moon.compile(this.$template);
        }
      };
    
      components[name] = {
        CTor: MoonComponent,
        opts: opts
      };
    
      return MoonComponent;
    };
    
    /* ======= Default Directives ======= */
    
    specialDirectives[Moon.config.prefix + "if"] = {
      afterGenerate: function (value, meta, code, vnode) {
        return '(' + compileTemplate(value, delimiters, escapedDelimiters, false) + ') ? ' + code + ' : h("#text", ' + generateMeta(defaultMetadata()) + ', "")';
      }
    };
    
    specialDirectives[Moon.config.prefix + "show"] = {
      beforeGenerate: function (value, meta, vnode, parentVNode) {
        var runTimeShowDirective = {
          name: Moon.config.prefix + "show",
          value: compileTemplate(value, delimiters, escapedDelimiters, false),
          literal: true
        };
    
        vnode.props.directives.push(runTimeShowDirective);
      }
    };
    
    specialDirectives[Moon.config.prefix + "for"] = {
      beforeGenerate: function (value, meta, vnode, parentVNode) {
        // Setup Deep Flag to Flatten Array
        parentVNode.deep = true;
      },
      afterGenerate: function (value, meta, code, vnode) {
        // Get Parts
        var parts = value.split(" in ");
        // Aliases
        var aliases = parts[0].split(",");
        // The Iteratable
        var iteratable = compileTemplate(parts[1], delimiters, escapedDelimiters, false);
    
        // Get any parameters
        var params = aliases.join(",");
    
        // Change any references to the parameters in children
        code.replace(new RegExp('instance\\.get\\("(' + aliases.join("|") + ')"\\)', 'g'), function (match, alias) {
          code = code.replace(new RegExp('instance.get\\("' + alias + '"\\)', "g"), alias);
        });
    
        // Use the renderLoop runtime helper
        return 'instance.renderLoop(' + iteratable + ', function(' + params + ') { return ' + code + '; })';
      }
    };
    
    specialDirectives[Moon.config.prefix + "on"] = {
      beforeGenerate: function (value, meta, vnode) {
    
        // Extract modifiers and the event
        var rawModifiers = meta.arg.split(".");
        var eventToCall = rawModifiers[0];
        var params = "event";
        var methodToCall = compileTemplate(value, delimiters, escapedDelimiters, false);
        var rawParams = methodToCall.split("(");
    
        if (rawParams.length > 1) {
          methodToCall = rawParams.shift();
          params = rawParams.join("(").slice(0, -1);
        }
        var modifiers = "";
    
        rawModifiers.shift();
    
        for (var i = 0; i < rawModifiers.length; i++) {
          modifiers += eventModifiersCode[rawModifiers[i]];
        }
    
        var code = 'function(event) {' + modifiers + 'instance.callMethod("' + methodToCall + '", [' + params + '])}';
        if (vnode.meta.eventListeners[eventToCall] === undefined) {
          vnode.meta.eventListeners[eventToCall] = [code];
        } else {
          vnode.meta.eventListeners[eventToCall].push(code);
        }
      }
    };
    
    specialDirectives[Moon.config.prefix + "model"] = {
      beforeGenerate: function (value, meta, vnode) {
        // Compile a string value for the keypath
        var compiledStringValue = compileTemplate(value, delimiters, escapedDelimiters, true);
        // Setup default event types and dom property to change
        var eventType = "input";
        var valueProp = "value";
    
        // If input type is checkbox, listen on 'change' and change the 'checked' dom property
        if (vnode.props.attrs.type !== undefined && vnode.props.attrs.type.value === "checkbox") {
          eventType = "change";
          valueProp = "checked";
        }
    
        // Generate event listener code
        var code = 'function(event) {instance.set("' + compiledStringValue + '", event.target.' + valueProp + ')}';
    
        // Push the listener to it's event listeners
        if (vnode.meta.eventListeners[eventType] === undefined) {
          vnode.meta.eventListeners[eventType] = [code];
        } else {
          vnode.meta.eventListeners[eventType].push(code);
        }
    
        // Setup a query used to get the value, and set the corresponding dom property
        var getQuery = compileTemplate('' + delimiters[0] + compileTemplate(value, delimiters, escapedDelimiters, false) + delimiters[1], delimiters, escapedDelimiters, false);
        if (vnode.props.dom === undefined) {
          vnode.props.dom = {};
        }
        vnode.props.dom[valueProp] = getQuery;
      }
    };
    
    specialDirectives[Moon.config.prefix + "literal"] = {
      duringPropGenerate: function (value, meta, vnode) {
        var prop = meta.arg;
    
        if (prop === "class") {
          // Classes need to be rendered differently
          return '"class": instance.renderClass(' + compileTemplate(value, delimiters, escapedDelimiters, false) + '), ';
        } else if (directives[prop]) {
          vnode.props.directives.push({
            name: prop,
            value: compileTemplate(value, delimiters, escapedDelimiters, false),
            meta: {}
          });
          return "";
        } else {
          return '"' + prop + '": ' + compileTemplate(value, delimiters, escapedDelimiters, false) + ', ';
        }
      }
    };
    
    specialDirectives[Moon.config.prefix + "html"] = {
      beforeGenerate: function (value, meta, vnode) {
        if (vnode.props.dom === undefined) {
          vnode.props.dom = {};
        }
        vnode.props.dom.innerHTML = '"' + compileTemplate(value, delimiters, escapedDelimiters, true) + '"';
      }
    };
    
    directives[Moon.config.prefix + "show"] = function (el, val, vnode) {
      el.style.display = val ? '' : 'none';
    };
    
    directives[Moon.config.prefix + "mask"] = function (el, val, vnode) {};
    return Moon;
}));
