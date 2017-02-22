/* ======= Default Directives ======= */

specialDirectives[Moon.config.prefix + "if"] = {
  afterGenerate: function(value, code, vnode) {
    return `(${compileTemplate(value, false)}) ? ${code} : ''`;
  }
}

specialDirectives[Moon.config.prefix + "for"] = {
  afterGenerate: function(value, code, vnode) {
    var parts = value.split(" in ");
    var aliases = parts[0].split(",");

    var iteratable = compileTemplate(parts[1], false);

    var params = aliases.join(",");

    code.replace(/instance\.get\("([^"]+)"\)/g, function(match, alias) {
      if(aliases.indexOf(alias) !== -1) {
        code = code.replace(new RegExp(`instance.get\\("${alias}"\\)`, "g"), alias);
      }
    });

    return `instance.renderLoop(${iteratable}, function(${params}) { return ${code}; })`;
  }
}

specialDirectives[Moon.config.prefix + "on"] = {
  beforeGenerate: function(value, vnode) {
    value = compileTemplate(value, false);

    var splitVal = value.split(":");
    // Extract modifiers and the event
    var rawModifiers = splitVal[0].split(".");
    var eventToCall = rawModifiers[0];
    var methodToCall = splitVal[1];
    var params = "(event)";
    var rawParams = methodToCall.split("(")[1];
    if(rawParams) {
      params = "";
    }
    var modifiers = "";

    rawModifiers.shift();

    for(var i = 0; i < rawModifiers.length; i++) {
      modifiers += eventModifiersCode[rawModifiers[i]];
    }

    var code = `function(event) {${modifiers}instance.$methods.${methodToCall}${params}}`;
    if(!vnode.meta.eventListeners[eventToCall]) {
      vnode.meta.eventListeners[eventToCall] = [code]
    } else {
      vnode.meta.eventListeners[eventToCall].push(code);
    }
  }
}

specialDirectives[Moon.config.prefix + "model"] = {
  beforeGenerate: function(value, vnode) {
    var code = `function(event) {instance.set("${value}", event.target.value)}`;
    if(!vnode.meta.eventListeners["input"]) {
      vnode.meta.eventListeners["input"] = [code]
    } else {
      vnode.meta.eventListeners["input"].push(code);
    }
  }
};

specialDirectives[Moon.config.prefix + "literal"] = {
  duringPropGenerate: function(value, vnode) {
    var parts = value.split(":");
    var prop = parts.shift();
    var literal = parts.join(":");
    return `"${prop}": ${compileTemplate(literal, false)}, `;
  }
};

specialDirectives[Moon.config.prefix + "once"] = {
  beforeGenerate: function(value, vnode) {
    vnode.meta.shouldRender = "instance.$initialRender";
  }
};

specialDirectives[Moon.config.prefix + "pre"] = {
  beforeGenerate: function(value, vnode) {
    vnode.meta.shouldRender = false;
  }
}

directives[Moon.config.prefix + "show"] = function(el, val, vnode) {
  var evaluated = new Function("return " + val);
  if(!evaluated()) {
    el.style.display = 'none';
  } else {
    el.style.display = 'block';
  }
}

specialDirectives[Moon.config.prefix + "text"] = {
  beforeGenerate: function(value, vnode) {
    vnode.children = [value];
  }
}

directives[Moon.config.prefix + "mask"] = function(el, val, vnode) {

}
