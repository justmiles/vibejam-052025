// vibejam/src/services/wasmService.js

let go; // Will be an instance of Go
let wasmModule;
let wasmInstance;

let loadPromise = null;

async function loadWasm() {
  if (wasmInstance) {
    return true; // Already loaded
  }

  if (loadPromise) {
    return loadPromise; // Loading is already in progress
  }

  loadPromise = new Promise(async (resolve, reject) => {
    if (typeof WebAssembly === 'undefined') {
      console.error('WebAssembly is not supported in this browser.');
      reject(new Error('WebAssembly not supported'));
      return;
    }

    // Load wasm_exec.js script. This script is expected to be in the public folder.
    // It sets up the `Go` global object.
    const script = document.createElement('script');
    script.src = '/wasm_exec.js'; // Path relative to public directory
    script.onload = async () => {
      console.log('wasm_exec.js loaded');
      if (typeof Go === 'undefined') {
        console.error('Go global object not found after loading wasm_exec.js. Ensure wasm_exec.js is correct.');
        reject(new Error('Failed to initialize Go runtime'));
        return;
      }
      go = new Go();
      try {
        console.log('Fetching main.wasm...');
        // Path relative to public directory
        const response = await fetch('/main.wasm'); 
        if (!response.ok) {
          throw new Error(`Failed to fetch main.wasm: ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        console.log('Instantiating main.wasm...');
        wasmModule = await WebAssembly.instantiate(buffer, go.importObject);
        wasmInstance = wasmModule.instance;
        go.run(wasmInstance); // Start the Go program. This will block until Go main exits.
                               // Our Go main func uses a channel to prevent exiting.
        console.log('WASM module instantiated and Go program started.');
        resolve(true);
      } catch (error) {
        console.error('Error loading WASM module:', error);
        reject(error);
      }
    };
    script.onerror = (error) => {
      console.error('Failed to load wasm_exec.js:', error);
      reject(new Error('Failed to load wasm_exec.js'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

async function ensureLoaded() {
  if (!wasmInstance) {
    await loadWasm();
  }
  if (!wasmInstance) {
    throw new Error('WASM module could not be loaded.');
  }
}

// Exported functions to interact with Go
export async function add(a, b) {
  await ensureLoaded();
  if (typeof window.goAdd === 'function') {
    return window.goAdd(a, b);
  } else {
    console.error('goAdd function not found on window object.');
    throw new Error('goAdd is not available');
  }
}

export async function multiply(a, b) {
  await ensureLoaded();
  if (typeof window.goMultiply === 'function') {
    return window.goMultiply(a, b);
  } else {
    console.error('goMultiply function not found on window object.');
    throw new Error('goMultiply is not available');
  }
}

export async function processText(inputText, templateId) {
  await ensureLoaded();
  if (typeof window.goProcessText === 'function') {
    return window.goProcessText(inputText, templateId);
  } else {
    console.error('goProcessText function not found on window object.');
    throw new Error('goProcessText is not available');
  }
}

export async function base64Encode(text) {
  await ensureLoaded();
  if (typeof window.goBase64Encode === 'function') {
    return window.goBase64Encode(text);
  } else {
    console.error('goBase64Encode function not found on window object.');
    throw new Error('goBase64Encode is not available');
  }
}

export async function base64Decode(text) {
  await ensureLoaded();
  if (typeof window.goBase64Decode === 'function') {
    const result = window.goBase64Decode(text);
    // The Go function returns an object like { error: "message" } on failure,
    // or the decoded string on success.
    if (result && typeof result === 'object' && result.error !== undefined) {
      throw new Error(result.error);
    }
    return result; // This will be the decoded string
  } else {
    console.error('goBase64Decode function not found on window object.');
    throw new Error('goBase64Decode is not available');
  }
}

// Optionally, provide a direct way to call loadWasm if needed for early initialization
export { loadWasm };