/* ======= Global Utilities ======= */

/**
 * Logs a Message
 * @param {String} msg
 */
var log = function(msg) {
  if(!Moon.config.silent) console.log(msg);
}

/**
 * Throws an Error
 * @param {String} msg
 */
var error = function(msg) {
  console.error("[Moon] ERR: " + msg);
}

/**
 * Creates a Virtual DOM Node
 * @param {String} type
 * @param {String} val
 * @param {Object} props
 * @param {Array} children
 * @param {Object} meta
 * @return {Object} Virtual DOM Node
 */
var createElement = function(type, val, props, children, meta) {
  return {
    type: type,
    val: val,
    props: props,
    children: children,
    meta: meta || {
      shouldRender: true
    }
  };
}

/**
 * Compiles JSX to Virtual DOM
 * @param {String} tag
 * @param {Object} attrs
 * @param {Array} children
 * @return {String} Object usable in Virtual DOM
 */
var h = function() {
  var args = Array.prototype.slice.call(arguments);
  var tag = args.shift();
  var attrs = args.shift() || {};
  var children = args;
  return createElement(tag, children.join(""), attrs, children, null);
};

/**
 * Creates DOM Node from VNode
 * @param {Object} vnode
 * @return {Object} DOM Node
 */
var createNodeFromVNode = function(vnode) {
  var el;
  if(typeof vnode === "string") {
    el = document.createTextNode(vnode);
  } else {
    el = document.createElement(vnode.type);
    var children = el.children.map(createNodeFromVNode);
    for(var i = 0; i < children.length; i++) {
      el.appendChild(children[i]);
    }
  }
  return el;
}


/**
 * Diffs Node and a VNode, and applys Changes
 * @param {Object} node
 * @param {Object} vnode
 * @param {Object} parent
 */
var diff = function(node, vnode, parent) {
  var nodeName;
  if(node) {
    nodeName = node.nodeName.toLowerCase();
  }
  if(vnode === null) {
    vnode = '';
  }

  if(!node) {
    parent.appendChild(createNodeFromVNode(vnode));
  } else if(!vnode) {
    parent.removeChild(node);
  } else if(nodeName !== (vnode.type || "#text")) {
    parent.replaceChild(createNodeFromVNode(vnode), node);
  } else if(nodeName === "#text" && typeof vnode === "string") {
    node.textContent = vnode;
  }

  // If there are children, deeply diff them
  if(vnode.children) {
    for(var i = 0; i < vnode.children.length || i < node.childNodes.length; i++) {
      diff(node.childNodes[i], vnode.children[i], node);
    }
  }
}


/**
 * Merges two Objects
 * @param {Object} obj
 * @param {Object} obj2
 * @return {Object} Merged Objects
 */
var merge = function(obj, obj2) {
  for (var key in obj2) {
    if (obj2.hasOwnProperty(key)) obj[key] = obj2[key];
  }
  return obj;
}

/**
 * Does No Operation
 */
var noop = function() {

}
