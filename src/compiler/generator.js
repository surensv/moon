/**
 * Generates Code for Props
 * @param {Object} vnode
 * @param {Object} parentVNode
 * @return {String} generated code
 */
const generateProps = function(vnode, parentVNode) {
	let attrs = vnode.props.attrs;
	let generatedObject = "{attrs: {";

	// Array of all directives (to be generated later)
	vnode.props.directives = [];

	if(attrs) {
		// Invoke any special directives that need to change values before code generation
		for(let beforeAttr in attrs) {
			const beforeAttrName = attrs[beforeAttr].name;
			if(specialDirectives[beforeAttrName] && specialDirectives[beforeAttrName].beforeGenerate) {
				specialDirectives[beforeAttrName].beforeGenerate(attrs[beforeAttr].value, attrs[beforeAttr].meta, vnode, parentVNode);
			}
		}

		// Generate all other attributes
		for(let attr in attrs) {
			// Get attr by it's actual name (in case it had any arguments)
			const attrName = attrs[attr].name;

			// If it is a directive, mark it as dynamic
			if(specialDirectives[attrName]) {
				// Generate Special Directives
				// Special directive found that generates code after initial generation, push it to its known special directives to run afterGenerate later
				if(specialDirectives[attrName].afterGenerate) {
					if(!vnode.specialDirectivesAfter) {
						vnode.specialDirectivesAfter = {};
					}
					vnode.specialDirectivesAfter[attr] = attrs[attr];
				}

				// Invoke any special directives that need to change values of props during code generation
				if(specialDirectives[attrName].duringPropGenerate) {
					generatedObject += specialDirectives[attrName].duringPropGenerate(attrs[attr].value, attrs[attr].meta, vnode);
				}

				// Keep a flag to know to always rerender this
				vnode.meta.shouldRender = true;

				// Remove special directive
				delete attrs[attr];
			} else if(directives[attrName]) {
				vnode.props.directives.push(attrs[attr]);
				vnode.meta.shouldRender = true;
			} else {
				const normalizedProp = JSON.stringify(attrs[attr].value);
				const compiledProp = compileTemplate(normalizedProp, true);
				if(normalizedProp !== compiledProp) {
					vnode.meta.shouldRender = true;
				}
				generatedObject += `"${attr}": ${compiledProp}, `;
			}
		}

		if(Object.keys(attrs).length) {
			generatedObject = generatedObject.slice(0, -2) + "}";
		} else {
			generatedObject += "}";
		}
	}

	// Check for DOM Properties
	const dom = vnode.props.dom;
	if(dom) {
		vnode.meta.shouldRender = true;
		generatedObject += ", dom: {";
		for(var domProp in dom) {
			generatedObject += `"${domProp}": ${dom[domProp]}, `;
		}
		generatedObject = generatedObject.slice(0, -2) + "}";
	}

	// Check for Directives
	let allDirectives = vnode.props.directives;
	if(allDirectives.length !== 0) {
		generatedObject += ", directives: {";

		for(var i = 0; i < allDirectives.length; i++) {
			let directiveInfo = allDirectives[i];
			const normalizedValue = directiveInfo.literal ? directiveInfo.value : JSON.stringify(directiveInfo.value);
			generatedObject += `"${directiveInfo.name}": ${normalizedValue}, `;
		}

		generatedObject = generatedObject.slice(0, -2) + "}";
	}

	// Close the generated object
	generatedObject += "}";
  return generatedObject;
}

/**
 * Generates Code for Event Listeners
 * @param {Object} listeners
 * @return {String} generated code
 */
const generateEventListeners = function(listeners) {
	if(Object.keys(listeners).length === 0) {
		return "{}";
	}
	let generatedObject = "{";

	for(let type in listeners) {
		generatedObject += `"${type}": [${generateArray(listeners[type])}], `;
	}

	generatedObject = generatedObject.slice(0, -2) + "}";

  return generatedObject;
}

/**
 * Generates Code for Metadata
 * @param {Object} meta
 * @return {String} generated code
 */
const generateMeta = function(meta) {
	let generatedObject = "{";

	for(let key in meta) {
		if(key === 'eventListeners') {
			generatedObject += `"${key}": ${generateEventListeners(meta[key])}, `;
		} else {
			generatedObject += `"${key}": ${meta[key]}, `;
		}
	}

	generatedObject = generatedObject.slice(0, -2) + "}";

  return generatedObject;
}

/**
 * Generates Code for an Array
 * @param {Array} arr
 * @return {String} generated array
 */
const generateArray = function(arr) {
	let generatedArray = "";

	for(let i = 0; i < arr.length; i++) {
		generatedArray += `${arr[i]}, `;
	}

	generatedArray = generatedArray.slice(0, -2);

  return generatedArray;
}

/**
 * Creates an "h" Call for a VNode
 * @param {Object} vnode
 * @param {Object} parentVNode
 * @return {String} "h" call
 */
const createCall = function(vnode, parentVNode) {
	// Generate Code for Type
	let call = `h("${vnode.type}", `;

	// Generate Code for Props
	call += generateProps(vnode, parentVNode) + ", ";

	// Generate code for children recursively here (in case modified by special directives)
	const children = vnode.children.map(function(item) {
		return generateEl(item, vnode);
	});

	// If the "shouldRender" flag is not present, ensure node will be updated
	if(vnode.meta.shouldRender && parentVNode) {
		parentVNode.meta.shouldRender = true;
	}

	// Generate Code for Metadata
	call += generateMeta(vnode.meta);

	// Generate Code for Children
	if(children.length) {
		if(vnode.deep) {
			call += `, [].concat.apply([], [${generateArray(children)}])`
		} else {
			call += `, [${generateArray(children)}]`;
		}
	} else {
		call += ", []";
	}

	// Close Call
	call += ")";
  return call;
}

const generateEl = function(el, parentEl) {
	let code = "";

	if(typeof el === "string") {
		// Escape newlines and double quotes, and compile the string
		const escapedString = escapeString(el);
		const compiledText = compileTemplate(escapedString, true);
		let textMeta = defaultMetadata();

		if(escapedString !== compiledText) {
			if(parentEl) {
				parentEl.meta.shouldRender = true;
			}
			textMeta.shouldRender = true;
		}

		code += `h("#text", ${generateMeta(textMeta)}, "${compiledText}")`;
	} else {
		// Recursively generate code for children

		// Generate Metadata if not Already
		if(!el.meta) {
			el.meta = defaultMetadata();
		}

		// Detect SVG Element
		if(el.isSVG) {
			el.meta.isSVG = true;
		}

		// Setup Nested Attributes within Properties
		el.props = {
			attrs: el.props
		}

		// Create a Call for the Element, or Register a Slot
		const slotNameAttr = el.props.attrs.name;
		let compiledCode = "";
		if(el.type === "slot") {
			if(parentEl) {
				parentEl.meta.shouldRender = true;
				parentEl.deep = true;
			}
			compiledCode = `instance.$slots['${(slotNameAttr && slotNameAttr.value) || ("default")}']`;
		} else {
			compiledCode = createCall(el, parentEl);
		}

		// Check for Special Directives that change the code after generation and run them
		if(el.specialDirectivesAfter) {
			for(let specialDirectiveAfterInfo in el.specialDirectivesAfter) {
				const specialDirectiveAfter = el.specialDirectivesAfter[specialDirectiveAfterInfo];
				compiledCode = specialDirectives[specialDirectiveAfter.name].afterGenerate(specialDirectiveAfter.value, specialDirectiveAfter.meta, compiledCode, el);
			}
		}
		code += compiledCode;
	}
  return code;
}

const generate = function(ast) {
	// Get root element
	const root = ast.children[0];
	// Begin Code
  const code = "var instance = this; return " + generateEl(root);

  try {
    return new Function("h", code);
  } catch(e) {
    error("Could not create render function");
    return noop;
  }
}
