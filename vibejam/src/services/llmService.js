// vibejam/src/services/llmService.js
import { MLCEngine } from "@mlc-ai/web-llm";
// Import Go tool functions from wasmService
import * as wasmTools from "./wasmService.js"; 

let engine;
let modelId;
let initPromise = null;
let initProgressCallback = null;

const SELECTED_MODEL = "Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC";
const MAX_TOOL_ITERATIONS = 5; // Prevent infinite loops

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
          console.log("[llmService] Init progress:", progress);
        }
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

// Function to parse tool calls from LLM response
function parseToolCall(responseText) {
  const toolCallPrefix = "TOOL_CALL:";
  const callIndex = responseText.indexOf(toolCallPrefix);
  if (callIndex !== -1) {
    const jsonStr = responseText.substring(callIndex + toolCallPrefix.length).trim();
    try {
      const callData = JSON.parse(jsonStr);
      if (callData.tool_name && callData.tool_input !== undefined) { // tool_input can be empty string
        // Extract the part of the response before the tool call, if any
        const pretext = responseText.substring(0, callIndex).trim();
        return { pretext, call: callData };
      }
    } catch (e) {
      console.warn("[llmService] Failed to parse JSON for tool call:", jsonStr, e);
    }
  }
  return null; // No valid tool call found
}

// Function to execute a Go tool
async function executeGoTool(toolName, toolInput) {
  console.log(`[llmService] Attempting to execute Go tool: ${toolName} with input:`, toolInput);
  let result;
  try {
    switch (toolName) {
      case "goBase64Encode":
        result = await wasmTools.base64Encode(String(toolInput));
        break;
      case "goBase64Decode":
        result = await wasmTools.base64Decode(String(toolInput));
        break;
      case "goAdd":
        // Assuming toolInput is an object like {a: number, b: number} for multi-arg tools
        if (typeof toolInput === 'object' && toolInput.a !== undefined && toolInput.b !== undefined) {
          result = await wasmTools.add(toolInput.a, toolInput.b);
        } else { throw new Error("Invalid input for goAdd tool. Expected {a: val, b: val}."); }
        break;
      case "goMultiply":
        if (typeof toolInput === 'object' && toolInput.a !== undefined && toolInput.b !== undefined) {
          result = await wasmTools.multiply(toolInput.a, toolInput.b);
        } else { throw new Error("Invalid input for goMultiply tool. Expected {a: val, b: val}."); }
        break;
      default:
        throw new Error(`Unknown Go tool: ${toolName}`);
    }
    return { tool_name: toolName, output: result, status: "success" };
  } catch (error) {
    console.error(`[llmService] Error executing Go tool ${toolName}:`, error);
    return { tool_name: toolName, output: error.message, status: "error" };
  }
}


export async function generateText(initialPrompt) {
  const currentEngine = await getEngine();
  if (!currentEngine) throw new Error("WebLLM Engine not initialized.");

  let messages = [{ role: "user", content: initialPrompt }];
  let finalAnswer = null;
  let thoughtProcess = ""; // To accumulate pre-tool text

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    console.log(`[llmService] Iteration ${i + 1}. Sending messages to LLM:`, JSON.stringify(messages, null, 2));
    
    const llmResponseChunk = await currentEngine.chat.completions.create({
      messages: messages,
      // We could add stop sequences for TOOL_CALL if needed, but parsing should handle it
    });

    // Log the full response object from the LLM
    console.log("[llmService] Full LLM API Response object:", JSON.parse(JSON.stringify(llmResponseChunk))); // Deep copy for clean logging

    const llmResponseText = llmResponseChunk.choices[0].message.content;
    console.log("[llmService] Extracted LLM response content:", llmResponseText);
    messages.push({ role: "assistant", content: llmResponseText }); // Add LLM's full response to history

    const toolCallAttempt = parseToolCall(llmResponseText);

    if (toolCallAttempt) {
      if (toolCallAttempt.pretext) {
        thoughtProcess += toolCallAttempt.pretext + "\n"; // Accumulate text before tool call
      }
      console.log("[llmService] Parsed tool call:", toolCallAttempt.call);
      const toolResult = await executeGoTool(toolCallAttempt.call.tool_name, toolCallAttempt.call.tool_input);
      console.log("[llmService] Tool execution result:", toolResult);
      
      // Add tool result message to conversation history
      // Format for OpenAI function calling is specific, here we use a simpler "tool" role.
      messages.push({ 
        role: "tool", 
        // @ts-ignore
        tool_call_id: "dummy_id_" + Date.now(), // Placeholder, real function calling would have IDs
        name: toolResult.tool_name, 
        content: JSON.stringify(toolResult.output) // Tool output should be stringified
      });
      // The LLM will see this "tool" message and continue.
    } else {
      finalAnswer = thoughtProcess + llmResponseText; // If no tool call, this is the final answer
      console.log("[llmService] No tool call detected, final answer:", finalAnswer);
      break; // Exit loop
    }
  }

  if (!finalAnswer) {
    console.warn("[llmService] Max tool iterations reached or no final answer from LLM.");
    return thoughtProcess + "\nLLM reached max tool iterations or did not provide a final answer.";
  }

  return finalAnswer;
}

export function isInitialized() {
  return !!engine; 
}

export function getLoadedModelId() {
  return engine?.currentModelId || modelId || "Unknown";
}