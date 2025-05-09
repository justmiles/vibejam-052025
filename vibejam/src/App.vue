<template>
  <v-app>
    <v-app-bar app color="primary" dark>
      <v-app-bar-nav-icon @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title>VibeJam LLM Magic Button</v-toolbar-title>
      <v-spacer></v-spacer>
    </v-app-bar>

    <v-navigation-drawer v-model="drawer" app temporary>
      <v-list dense nav>
        <v-list-item link>
          <template v-slot:prepend><v-icon>mdi-home</v-icon></template>
          <v-list-item-title>Home</v-list-item-title>
        </v-list-item>
        <v-list-item link @click="showWasmTestArea = !showWasmTestArea">
           <template v-slot:prepend><v-icon>mdi-cog-transfer</v-icon></template>
          <v-list-item-title>Toggle Go Tools Test</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <v-container fluid>
        <v-row>
          <v-col cols="12" md="6">
            <h2>Input</h2>
            <div v-if="llmModelLoadingProgress && !llmModelLoaded" class="mb-4">
              <p>{{ llmModelLoadingProgress.text }}</p>
              <v-progress-linear :model-value="llmModelLoadingProgress.percentage" color="amber" height="20" striped>
                <template v-slot:default="{ value }">
                  <strong>{{ Math.ceil(value) }}%</strong>
                </template>
              </v-progress-linear>
            </div>
            <div v-if="llmModelLoaded && !finalizingLoad" class="mb-2" style="color: green;">
              <v-icon color="green" small left>mdi-check-circle</v-icon>
              LLM Ready (Model: {{ getLLMLoadedModelId() }})
            </div>
             <div v-if="llmError" class="mb-2" style="color: red;">
              <v-icon color="red" small left>mdi-alert-circle</v-icon>
              LLM Error: {{ llmError }}
            </div>

            <input-area ref="inputAreaRef" />
            <template-selector ref="templateSelectorRef" class="mt-4" />
            <process-button 
              :is-loading="isLoading" 
              :is-disabled="!canProcess"
              @process-text="handleProcessText" 
              class="mt-4" 
            />
          </v-col>
          <v-col cols="12" md="6">
            <h2>Output</h2>
            <v-card outlined min-height="200px">
              <v-card-text>
                <div v-if="isLoading" class="text-center">
                  <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
                  <p class="mt-3">Thinking...</p>
                </div>
                <div v-else-if="llmOutput" style="white-space: pre-wrap;">
                  {{ llmOutput }}
                </div>
                <div v-else class="text-center grey--text lighten-1--text" style="padding-top: 20px;">
                  LLM output will appear here once you transform text.
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <v-divider v-if="showWasmTestArea" class="my-8"></v-divider>

        <v-row v-if="showWasmTestArea">
          <v-col cols="12">
            <h2>Go WASM Tools Test Area</h2>
            <p v-if="!wasmLoaded && !wasmError">Loading WASM tools module...</p>
            <p v-if="wasmError" style="color: red;">Error loading WASM tools: {{ wasmError }}</p>
            <div v-if="wasmLoaded">
              <p style="color: green;">WASM Tools Module Loaded Successfully!</p>
              <v-row>
                <v-col cols="12" md="6">
                  <v-card outlined class="pa-4 mb-4">
                    <h3>Go Add (Tool)</h3>
                    <v-text-field v-model.number="addArg1" label="Arg 1" type="number" density="compact"></v-text-field>
                    <v-text-field v-model.number="addArg2" label="Arg 2" type="number" density="compact"></v-text-field>
                    <v-btn @click="performGoAdd" color="info" class="mt-2">Add</v-btn>
                    <p class="mt-2" v-if="addResult !== null">Result: <strong>{{ addResult }}</strong></p>
                  </v-card>
                   <v-card outlined class="pa-4">
                    <h3>Go Base64 Encode (Tool)</h3>
                    <v-text-field v-model="base64Input" label="Text to Encode" density="compact"></v-text-field>
                    <v-btn @click="performGoBase64Encode" color="info" class="mt-2">Encode</v-btn>
                    <p class="mt-2" v-if="base64EncodedResult !== null">Encoded: <strong>{{ base64EncodedResult }}</strong></p>
                  </v-card>
                </v-col>
                <v-col cols="12" md="6">
                  <v-card outlined class="pa-4 mb-4">
                    <h3>Go Multiply (Tool)</h3>
                    <v-text-field v-model.number="multiplyArg1" label="Arg 1" type="number" step="0.1" density="compact"></v-text-field>
                    <v-text-field v-model.number="multiplyArg2" label="Arg 2" type="number" step="0.1" density="compact"></v-text-field>
                    <v-btn @click="performGoMultiply" color="info" class="mt-2">Multiply</v-btn>
                    <p class="mt-2" v-if="multiplyResult !== null">Result: <strong>{{ multiplyResult }}</strong></p>
                  </v-card>
                  <v-card outlined class="pa-4">
                    <h3>Go Base64 Decode (Tool)</h3>
                    <v-text-field v-model="base64ToDecodeInput" label="Base64 to Decode" density="compact"></v-text-field>
                    <v-btn @click="performGoBase64Decode" color="info" class="mt-2">Decode</v-btn>
                    <p class="mt-2" v-if="base64DecodedResult !== null">Decoded: <strong>{{ base64DecodedResult }}</strong></p>
                     <p class="mt-2" v-if="base64DecodeError !== null" style="color: red;">Error: {{ base64DecodeError }}</p>
                  </v-card>
                </v-col>
              </v-row>
            </div>
          </v-col>
        </v-row>
      </v-container>
    </v-main>

    <v-footer app color="primary" dark>
      <span class="white--text">&copy; {{ new Date().getFullYear() }} VibeJam</span>
    </v-footer>
  </v-app>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import InputArea from './components/input/InputArea.vue'
import TemplateSelector from './components/input/TemplateSelector.vue'
import ProcessButton from './components/input/ProcessButton.vue'
import { 
  loadWasm, 
  add as goAddWasm, 
  multiply as goMultiplyWasm,
  base64Encode as goBase64EncodeWasm,
  base64Decode as goBase64DecodeWasm
} from './services/wasmService.js' 
import { 
  getEngine as initializeLLMEngine, 
  generateText as generateLLMText, 
  setInitProgressCallback as setLLMInitProgressCallback,
  isInitialized as isLLMInitialized,
  getLoadedModelId as getLLMLoadedModelId
} from './services/llmService.js'

const drawer = ref(false)
const showWasmTestArea = ref(false)

const inputAreaRef = ref(null)
const templateSelectorRef = ref(null)
const isLoading = ref(false) 
const llmOutput = ref('')

const llmModelLoaded = ref(false)
const llmModelLoadingProgress = ref({ text: "Initializing...", percentage: 0 })
const llmError = ref(null)
const finalizingLoad = ref(false); 

const simulatedProgress = ref(0);
let progressInterval = null;

// WASM Tools State
const wasmLoaded = ref(false)
const wasmError = ref(null)
const addArg1 = ref(5)
const addArg2 = ref(7)
const addResult = ref(null)
const multiplyArg1 = ref(3.5)
const multiplyArg2 = ref(2)
const multiplyResult = ref(null)
const base64Input = ref("Hello WASM Tools!")
const base64EncodedResult = ref(null)
const base64ToDecodeInput = ref("")
const base64DecodedResult = ref(null)
const base64DecodeError = ref(null)


onMounted(async () => {
  try {
    await loadWasm();
    wasmLoaded.value = true;
  } catch (error) {
    wasmError.value = error.message || 'Unknown error during WASM tools loading.';
  }

  llmModelLoadingProgress.value = { text: "Initializing LLM Engine...", percentage: 0 };
  progressInterval = setInterval(() => {
    if (simulatedProgress.value < 30) {
      simulatedProgress.value += 2; 
      const currentActualPercentage = llmModelLoadingProgress.value?.actualPercentage || 0;
      llmModelLoadingProgress.value = {
        ...llmModelLoadingProgress.value,
        percentage: Math.max(simulatedProgress.value, currentActualPercentage)
      };
    } else {
      clearInterval(progressInterval);
      progressInterval = null;
    }
  }, 1000); 

  setLLMInitProgressCallback((progress) => {
    llmModelLoadingProgress.value = { 
      text: progress.text, 
      percentage: Math.max(simulatedProgress.value, progress.progress * 100),
      actualPercentage: progress.progress * 100 
    };
    if (progress.progress * 100 >= simulatedProgress.value && progressInterval) {
       if (simulatedProgress.value < 30) clearInterval(progressInterval);
    }
  });

  try {
    await initializeLLMEngine();
    if (isLLMInitialized()) {
      clearInterval(progressInterval); 
      progressInterval = null;
      llmModelLoadingProgress.value = { text: `Model ${getLLMLoadedModelId()} loaded! Finalizing...`, percentage: 100 };
      finalizingLoad.value = true;
      setTimeout(() => {
        llmModelLoaded.value = true;
        finalizingLoad.value = false;
      }, 1000); 
    } else {
      throw new Error("LLM Engine initialization check failed after call."); 
    }
  } catch (error) {
    clearInterval(progressInterval);
    progressInterval = null;
    llmError.value = error.message || 'Unknown error during LLM Engine initialization.';
    llmModelLoadingProgress.value = { text: `Error: ${error.message || 'Failed to load model.'}`, percentage: 0 };
  }
});

onUnmounted(() => {
  if (progressInterval) {
    clearInterval(progressInterval);
  }
});

const canProcess = computed(() => {
  return inputAreaRef.value?.getText()?.length > 0 && 
         templateSelectorRef.value?.getSelectedTemplate() !== null &&
         llmModelLoaded.value && 
         !isLoading.value &&
         !finalizingLoad.value;
});

const TOOL_INSTRUCTIONS = `
You have access to the following tools. To use a tool, respond with "TOOL_CALL:" followed by a single line of a valid JSON object specifying the "tool_name" and "tool_input".
For example: TOOL_CALL: {"tool_name": "goBase64Encode", "tool_input": "text to encode"}

Available tools:
1. "goBase64Encode":
   - Description: Encodes a given string into Base64 format.
   - Input: {"tool_input": "string_to_encode"}
   - Output: Base64 encoded string.
2. "goBase64Decode":
   - Description: Decodes a Base64 encoded string.
   - Input: {"tool_input": "base64_string_to_decode"}
   - Output: Decoded string, or an error message if decoding fails.
3. "goAdd":
   - Description: Adds two numbers.
   - Input: {"tool_input": {"a": number1, "b": number2}}
   - Output: The sum of the two numbers.
4. "goMultiply":
   - Description: Multiplies two numbers.
   - Input: {"tool_input": {"a": number1, "b": number2}}
   - Output: The product of the two numbers.

After a tool call, I will provide the result, and you can then continue with your task. Only call one tool at a time.
`;

const promptTemplates = {
  summary: (text) => `${TOOL_INSTRUCTIONS}\n\nUser task: Summarize the following text concisely:\n\n"${text}"`,
  qa: (text) => `${TOOL_INSTRUCTIONS}\n\nUser task: Based on the following text, answer the question it implies or asks. If it's not a question, explain what it is about briefly:\n\n"${text}"`,
  creative: (text) => `${TOOL_INSTRUCTIONS}\n\nUser task: Continue the following creative piece or idea:\n\n"${text}"`,
  regex: (text) => `${TOOL_INSTRUCTIONS}\n\nUser task: Generate a JavaScript compatible regular expression that achieves the following: "${text}". Only provide the regex pattern itself, without explanations or enclosing slashes. If you need to encode or decode something as part of your thought process, you can use a tool.`,
  meeting_notes: (text) => `${TOOL_INSTRUCTIONS}\n\nUser task: Please transform the following raw text into structured meeting notes. Identify a suitable title for the meeting, date (if inferable, otherwise use placeholder "[Date]"), attendees (if listed, otherwise "[Attendees]"), a concise overall summary of the meeting, key discussion points or topics, any decisions made, and clear action items with assigned owners if mentioned (otherwise "[Action item Assignee]"). Format the notes clearly for readability.\n\nRaw text to process:\n"${text}"`,
};

const handleProcessText = async () => {
  if (!canProcess.value) return;
  const text = inputAreaRef.value.getText();
  const templateId = templateSelectorRef.value.getSelectedTemplate();
  const promptBuilder = promptTemplates[templateId];
  if (!promptBuilder) {
    llmOutput.value = `Unknown template ID: ${templateId}`;
    return;
  }
  const initialPrompt = promptBuilder(text);

  isLoading.value = true;
  llmOutput.value = ''; 
  llmError.value = null; // Clear previous LLM errors
  try {
    const result = await generateLLMText(initialPrompt); // generateLLMText now handles tool calls
    llmOutput.value = result;
  } catch (error) {
    console.error('Error during generateLLMText in App.vue:', error);
    llmOutput.value = `Error: ${error.message}`;
    llmError.value = `LLM or Tool Error: ${error.message}`;
  } finally {
    isLoading.value = false;
  }
}

// --- WASM Tool Test Functions ---
const performGoAdd = async () => { /* ... unchanged ... */ };
const performGoMultiply = async () => { /* ... unchanged ... */ };

const performGoBase64Encode = async () => {
  if (!wasmLoaded.value) { base64EncodedResult.value = "WASM tools not loaded."; return; }
  try {
    base64EncodedResult.value = "Encoding...";
    const result = await goBase64EncodeWasm(base64Input.value);
    base64EncodedResult.value = result;
  } catch (error) {
    base64EncodedResult.value = `Error: ${error.message}`;
  }
};

const performGoBase64Decode = async () => {
  if (!wasmLoaded.value) { base64DecodedResult.value = "WASM tools not loaded."; return; }
  base64DecodeError.value = null;
  try {
    base64DecodedResult.value = "Decoding...";
    const result = await goBase64DecodeWasm(base64ToDecodeInput.value);
    base64DecodedResult.value = result;
  } catch (error) {
    base64DecodedResult.value = ''; // Clear result on error
    base64DecodeError.value = `Error: ${error.message}`;
  }
};
</script>

<style scoped>
.v-main { padding-top: 64px; padding-bottom: 56px; }
h2 { margin-bottom: 16px; }
.v-card.pa-4 { padding: 16px !important; }
.grey--text { color: #757575 !important; }
</style>
