/**
 * Makes Computed Properties for an Instance
 * @param {Object} instance
 * @param {Object} computed
 */
const initComputed = function(instance, computed) {
  let setComputedProperty = function(prop) {
    const observer = instance.$observer;

    // Flush Cache if Dependencies Change
    observer.observe(prop);

    // Create Getters/Setters
    let properties = {
      get: function() {
        // Property Cache
        let cache = null;

        // If no cache, create it
        if(observer.cache[prop] === undefined) {
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
      }
    };

    if(computed[prop].set) {
      properties.set = function(val) {
        return computed[prop].set.call(instance, val);
      }
    }

    // Add Getters/Setters
    Object.defineProperty(instance.$data, prop, properties);
  }

  // Set All Computed Properties
  for(let propName in computed) {
    setComputedProperty(propName);
  }
}
