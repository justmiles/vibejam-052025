// vibejam/src/services/llmService.js
import { MLCEngine } from "@mlc-ai/web-llm"; 

let engine;
let modelId;
let initPromise = null;
let initProgressCallback = null;

const SELECTED_MODEL = "Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC"; 

export function setInitProgressCallback(callback) {
  initProgressCallback = callback;
}

async function initializeEngine() {
  if (engine) return engine;
  if (initPromise) return initPromise;

  console.log("[llmService] initializeEngine: Called.");

  initPromise = new Promise(async (resolve, reject) => {
    try {
      console.log(`[llmService] initializeEngine: Attempting to new MLCEngine() for model: ${SELECTED_MODEL}`);
      engine = new MLCEngine(); 
      console.log("[llmService] initializeEngine: MLCEngine instance created.");

      const chatOpts = {
        initProgressCallback: (progress) => {
          if (initProgressCallback) initProgressCallback(progress);
          console.log("[llmService] Init progress:", progress); // Log from callback
        }
        // Other chat options like temperature, top_p could go here
      };
      
      console.log(`[llmService] initializeEngine: Attempting to engine.reload("${SELECTED_MODEL}")...`);
      await engine.reload(SELECTED_MODEL, chatOpts);
      console.log("[llmService] initializeEngine: engine.reload() completed.");
      
      modelId = SELECTED_MODEL; 
      console.log(`[llmService] WebLLM Engine (MLCEngine) initialized/reloaded with model: ${modelId}`);
      resolve(engine);
    } catch (err) {
      console.error("[llmService] Error in initializeEngine:", err);
      engine = null; 
      initPromise = null; 
      reject(err);
    }
  });
  return initPromise;
}

export async function getEngine() {
  if (!engine) {
    await initializeEngine(); 
  }
  return engine;
}

export async function generateText(prompt, _toolUseCb) {
  const currentEngine = await getEngine(); 
  if (!currentEngine) {
    throw new Error("WebLLM Engine (MLCEngine instance) not initialized.");
  }

  console.log(`[llmService] Generating text for prompt: "${prompt.substring(0, 50)}..."`);
  
  const messages = [{ role: "user", content: prompt }];
  
  if (typeof currentEngine.chat?.completions?.create === 'function') {
    const reply = await currentEngine.chat.completions.create({
      messages: messages,
    });
    console.log("[llmService] LLM Reply object (via chat.completions.create):", reply);
    if (reply.choices && reply.choices.length > 0 && reply.choices[0].message) {
      return reply.choices[0].message.content;
    }
  } else if (typeof currentEngine.generate === 'function') { 
    const replyString = await currentEngine.generate(prompt);
    console.log("[llmService] LLM Reply string (via direct generate):", replyString);
    return replyString;
  } else {
     console.error("[llmService] MLCEngine instance does not have a recognized method for text generation.", currentEngine);
     throw new Error("Text generation method not found on MLCEngine instance.");
  }
  
  console.error("[llmService] Unexpected LLM reply structure or no generation method worked.");
  throw new Error("Failed to get content from LLM reply or no method worked.");
}

export function isInitialized() {
  return !!engine; 
}

export function getLoadedModelId() {
  return engine?.currentModelId || modelId || "Unknown";
}