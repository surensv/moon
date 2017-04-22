/* ======= Default Directives ======= */

specialDirectives["m-if"] = {
  afterGenerate: function(value, meta, code, vnode) {
    return `${compileTemplateExpression(value)} ? ${code} : h("#text", ${generateMeta(defaultMetadata())}, "")`;
  }
}

specialDirectives["m-for"] = {
  beforeGenerate: function(value, meta, vnode, parentVNode) {
    // Setup Deep Flag to Flatten Array
    parentVNode.deep = true;
  },
  afterGenerate: function(value, meta, code, vnode) {
    // Get Parts
    const parts = value.split(" in ");
    // Aliases
    const aliases = parts[0].split(",");
    // The Iteratable
    const iteratable = compileTemplateExpression(parts[1]);

    // Get any parameters
    const params = aliases.join(",");

    // Change any references to the parameters in children
    code.replace(new RegExp(`instance\\.get\\("(${aliases.join("|")})"\\)`, 'g'), "$1");

    // Use the renderLoop runtime helper
    return `instance.renderLoop(${iteratable}, function(${params}) { return ${code}; })`;
  }
}

specialDirectives["m-on"] = {
  beforeGenerate: function(value, meta, vnode) {
    // Extract Event, Modifiers, and Parameters
    let methodToCall = value;

    let rawModifiers = meta.arg.split(".");
    const eventType = rawModifiers.shift();

    let params = "event";
    const rawParams = methodToCall.split("(");

    if(rawParams.length > 1) {
      // Custom parameters detected, update method to call, and generated parameter code
      methodToCall = rawParams.shift();
      params = compileTemplateExpression(rawParams.join("(").slice(0, -1));
    }

    // Generate any modifiers
    let modifiers = "";
    for(var i = 0; i < rawModifiers.length; i++) {
      modifiers += eventModifiersCode[rawModifiers[i]];
    }

    // Final event listener code
    const code = `function(event) {${modifiers}instance.callMethod("${methodToCall}", [${params}])}`;
    const eventListeners = vnode.meta.eventListeners[eventType];
    if(eventListeners === undefined) {
      vnode.meta.eventListeners[eventType] = [code]
    } else {
      eventListeners.push(code);
    }
  }
}

specialDirectives["m-model"] = {
  beforeGenerate: function(value, meta, vnode) {
    // Compile a string value for the keypath
    const keypath = compileTemplateExpression(value);

    // Setup default event types and dom property to change
    let eventType = "input";
    let valueProp = "value";

    // If input type is checkbox, listen on 'change' and change the 'checked' dom property
    if(vnode.props.attrs.type !== undefined && vnode.props.attrs.type.value === "checkbox") {
      eventType = "change";
      valueProp = "checked";
    }

    // Generate event listener code
    const code = `function(event) {instance.set(${keypath}, event.target.${valueProp})}`;

    // Push the listener to it's event listeners
    const eventListeners = vnode.meta.eventListeners[eventType];
    if(eventListeners === undefined) {
      vnode.meta.eventListeners[eventType] = [code];
    } else {
      eventListeners.push(code);
    }

    // Setup a query used to get the value, and set the corresponding dom property
    const dom = vnode.props.dom;
    if(dom === undefined) {
      vnode.props.dom = dom = {};
    }
    dom[valueProp] = keypath;
  }
};

specialDirectives["m-literal"] = {
  duringPropGenerate: function(value, meta, vnode) {
    const prop = meta.arg;

    if(prop === "class") {
      // Detected class, use runtime class render helper
      return `"class": instance.renderClass(${compileTemplateExpression(value)}), `;
    } else {
      // Default literal attribute
      return `"${prop}": ${compileTemplateExpression(value)}, `;
    }
  }
};

specialDirectives["m-html"] = {
  beforeGenerate: function(value, meta, vnode) {
    const dom = vnode.props.dom;
    if(dom === undefined) {
      vnode.props.dom = dom = {};
    }
    dom.innerHTML = `("" + ${compileTemplateExpression(value)})`;
  }
}

specialDirectives["m-mask"] = {

}

directives["m-show"] = function(el, val, vnode) {
  el.style.display = (val ? '' : 'none');
}
