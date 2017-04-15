/**
 * Patch Types
 */
const PATCH = {
  SKIP: 0,
  APPEND: 1,
  REMOVE: 2,
  REPLACE: 3,
  TEXT: 4,
  CHILDREN: 5
}

/**
 * Text VNode/Node Type
 */
const TEXT_TYPE = "#text";

/**
 * Creates a Virtual DOM Node
 * @param {String} type
 * @param {String} val
 * @param {Object} props
 * @param {Object} meta
 * @param {Array} children
 * @return {Object} Virtual DOM Node
 */
const createElement = function(type, val, props, meta, children) {
  return {
    type: type,
    val: val,
    props: props,
    children: children,
    meta: meta || defaultMetadata()
  };
}

/**
 * Creates a Functional Component
 * @param {Object} props
 * @param {Array} children
 * @param {Object} functionalComponent
 * @return {Object} Virtual DOM Node
 */
const createFunctionalComponent = function(props, children, functionalComponent) {
  let data = functionalComponent.opts.data || {};

  // Merge data with provided props
  if(functionalComponent.opts.props !== undefined) {
    const propNames = functionalComponent.opts.props;

    for(var i = 0; i < propNames.length; i++) {
      const prop = propNames[i];
      data[prop] = props.attrs[prop];
    }
  }

  // Call render function
  return functionalComponent.opts.render(h, {
    data: data,
    slots: getSlots(children)
  });
}

/**
 * Compiles Arguments to a VNode
 * @param {String} tag
 * @param {Object} attrs
 * @param {Object} meta
 * @param {Object|String} children
 * @return {Object} Object usable in Virtual DOM (VNode)
 */
const h = function(tag, attrs, meta, children) {
  let component = null;

  if(tag === TEXT_TYPE) {
    // Text Node
    // Tag => #text
    // Attrs => meta
    // Meta => val
    return createElement(TEXT_TYPE, meta, {attrs:{}}, attrs, []);
  } else if((component = components[tag]) !== undefined) {
    // Resolve Component
    if(component.opts.functional === true) {
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
const createComponentFromVNode = function(node, vnode, component) {
  let componentInstance = new component.CTor();
  // Merge data with provided props
  for(let i = 0; i < componentInstance.$props.length; i++) {
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
}

/**
 * Diffs Props of Node and a VNode, and apply Changes
 * @param {Object} node
 * @param {Object} nodeProps
 * @param {Object} vnode
 */
const diffProps = function(node, nodeProps, vnode) {
  // Get VNode Attributes
  const vnodeProps = vnode.props.attrs;

  // Diff VNode Props with Node Props
  for(let vnodePropName in vnodeProps) {
    const vnodePropValue = vnodeProps[vnodePropName];
    const nodePropValue = nodeProps[vnodePropName];

    if((vnodePropValue !== undefined || vnodePropValue !== false || vnodePropValue !== null) && ((nodePropValue === undefined || nodePropValue === false || nodePropValue === null) || vnodePropValue !== nodePropValue)) {
      if(vnodePropName.length === 10 && vnodePropName === "xlink:href") {
        node.setAttributeNS('http://www.w3.org/1999/xlink', "href", vnodePropValue);
      } else {
        node.setAttribute(vnodePropName, vnodePropValue === true ? '' : vnodePropValue);
      }
    }
  }

  // Diff Node Props with VNode Props
  for(let nodePropName in nodeProps) {
    const vnodePropValue = vnodeProps[nodePropName];
    if(vnodePropValue === undefined || vnodePropValue === false || vnodePropValue === null) {
      node.removeAttribute(nodePropName);
    }
  }

  // Execute any directives
  if(vnode.props.directives !== undefined) {
    for(let directive in vnode.props.directives) {
      directives[directive](node, vnode.props.directives[directive], vnode);
    }
  }

  // Add/Update any DOM Props
  if(vnode.props.dom !== undefined) {
    for(let domProp in vnode.props.dom) {
      const domPropValue = vnode.props.dom[domProp];
      if(node[domProp] !== domPropValue) {
        node[domProp] = domPropValue;
      }
    }
  }
}

/**
 * Diffs a Component
 * @param {Object} node
 * @param {Object} vnode
 * @return {Object} adjusted node only if it was replaced
 */
const diffComponent = function(node, vnode) {
  if(node.__moon__ === undefined) {
    // Not mounted, create a new instance and mount it here
    createComponentFromVNode(node, vnode, vnode.meta.component);
  } else {
    // Mounted already, need to update
    let componentInstance = node.__moon__;
    let componentChanged = false;

    // Merge any properties that changed
    for(var i = 0; i < componentInstance.$props.length; i++) {
      let prop = componentInstance.$props[i];
      if(componentInstance.$data[prop] !== vnode.props.attrs[prop]) {
        componentInstance.$data[prop] = vnode.props.attrs[prop];
        componentChanged = true;
      }
    }

    // If it has children, resolve any new slots
    if(vnode.children.length !== 0) {
      componentInstance.$slots = getSlots(vnode.children);
      componentChanged = true;
    }

    // If any changes were detected, build the component
    if(componentChanged === true) {
      componentInstance.build();
    }
  }
}

/**
 * Hydrates Node and a VNode
 * @param {Object} node
 * @param {Object} vnode
 * @param {Object} parent
 * @param {Object} instance
 * @return {Object} adjusted node only if it was replaced
 */
const hydrate = function(node, vnode, parent, instance) {
  let nodeName = node ? node.nodeName.toLowerCase() : null;

  if(node === null && vnode === null) {
    return null;
  } else if(node === null) {
    // No node, create one
    var newNode = createNodeFromVNode(vnode, instance);
    appendChild(newNode, vnode, parent);

    return newNode;
  } else if(vnode === null) {
    removeChild(node, parent);

    return null;
  } else if(nodeName !== vnode.type) {
    var newNode = createNodeFromVNode(vnode, instance);
    replaceChild(node, newNode, vnode, parent);
    return newNode;
  } else if(vnode.type === TEXT_TYPE) {
    if(nodeName === TEXT_TYPE) {
      // Both are textnodes, update the node
      if(node.textContent !== vnode.val) {
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
    if(vnode.meta.component !== undefined) {
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
    if(vnode.props.dom !== undefined && vnode.props.dom.innerHTML !== undefined) {
      return node;
    }

    // Hydrate Children
    const vnodeChildrenLength = vnode.children.length;

    let i = 0;
    let currentChildNode = node.firstChild;
    let vchild = vnodeChildrenLength !== 0 ? vnode.children[0] : null;

    while(vchild !== null || currentChildNode !== null) {
      const next = currentChildNode ? currentChildNode.nextSibling : null;
      hydrate(currentChildNode, vchild, node, instance);
      vchild = ++i < vnodeChildrenLength ? vnode.children[i] : null;
      currentChildNode = next;
    }

    return node;
  }
}

/**
 * Diffs Node and a VNode, and applies Changes
 * @param {Object} node
 * @param {Object} vnode
 * @param {Object} parent
 * @param {Object} instance
 * @return {Number} patch type
 */
const diff = function(oldVNode, vnode, parent, instance) {
  if(oldVNode === null && vnode === null) {
    return PATCH.SKIP;
  } else if(oldVNode === null) {
    // No Node, append a node
    appendChild(createNodeFromVNode(vnode, instance), vnode, parent);

    return PATCH.APPEND;
  } else if(vnode === null) {
    // No New VNode, remove Node
    removeChild(oldVNode.meta.el, parent);

    return PATCH.REMOVE;
  } else if(oldVNode === vnode) {
    // Both have the same reference, skip
    return PATCH.SKIP;
  } else if(oldVNode.type !== vnode.type) {
    // Different types, replace it
    replaceChild(oldVNode.meta.el, createNodeFromVNode(vnode, instance), vnode, parent);

    return PATCH.REPLACE;
  } else if(vnode.meta.shouldRender === true && vnode.type === TEXT_TYPE) {
    let node = oldVNode.meta.el;

    if(oldVNode.type === TEXT_TYPE) {
      // Both are textnodes, update the node
      if(vnode.val !== oldVNode.val) {
        node.textContent = vnode.val;
      }

      return PATCH.TEXT;
    } else {
      // Node isn't text, replace with one
      replaceChild(node, createNodeFromVNode(vnode, instance), vnode, parent);
      return PATCH.REPLACE;
    }

  } else if(vnode.meta.shouldRender === true) {
    let node = oldVNode.meta.el;

    // Check for Component
    if(vnode.meta.component !== undefined) {
      // Diff Component
      diffComponent(node, vnode);

      // Skip diffing any children
      return PATCH.SKIP;
    }

    // Diff props
    diffProps(node, oldVNode.props.attrs, vnode);
    oldVNode.props.attrs = vnode.props.attrs;

    // Check if innerHTML was changed, don't diff children
    if(vnode.props.dom !== undefined && vnode.props.dom.innerHTML !== undefined) {
      // Skip Children
      return PATCH.SKIP;
    }

    // Diff Children
    let newLength = vnode.children.length;
    let oldLength = oldVNode.children.length;

    if(newLength === 0) {
      // No Children, Remove all Children if not Already Removed
      if(oldLength !== 0) {
        let firstChild = null;
        while((firstChild = node.firstChild) !== null) {
          removeChild(firstChild, node);
        }
        oldVNode.children = [];
      }
    } else {
      // Traverse and Diff Children
      let totalLen = newLength > oldLength ? newLength : oldLength;
      for(var i = 0; i < totalLen; i++) {
        let oldChild = i < oldLength ? oldVNode.children[i] : null;
        let child = i < newLength ? vnode.children[i] : null;

        const action = diff(oldChild, child, node, instance);

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
}
