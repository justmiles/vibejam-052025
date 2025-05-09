<template>
  <v-app>
    <v-app-bar app color="primary" dark>
      <v-app-bar-nav-icon @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title>VibeJam LLM Transformer</v-toolbar-title>
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
          <v-list-item-title>Toggle WASM Test</v-list-item-title>
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
            <h2>WASM Tool Test Area</h2>
            <p v-if="!wasmLoaded && !wasmError">Loading WASM tools module...</p>
            <p v-if="wasmError" style="color: red;">Error loading WASM tools: {{ wasmError }}</p>
            <div v-if="wasmLoaded">
              <p style="color: green;">WASM Tools Module Loaded Successfully!</p>
              <v-row>
                <v-col cols="12" md="6">
                  <v-card outlined class="pa-4">
                    <h3>Go Add (Tool)</h3>
                    <v-text-field v-model.number="addArg1" label="Arg 1" type="number"></v-text-field>
                    <v-text-field v-model.number="addArg2" label="Arg 2" type="number"></v-text-field>
                    <v-btn @click="performGoAdd" color="info" class="mt-2">Add via Go Tool</v-btn>
                    <p class="mt-2" v-if="addResult !== null">Result: <strong>{{ addResult }}</strong></p>
                  </v-card>
                </v-col>
                <v-col cols="12" md="6">
                  <v-card outlined class="pa-4">
                    <h3>Go Multiply (Tool)</h3>
                    <v-text-field v-model.number="multiplyArg1" label="Arg 1" type="number" step="0.1"></v-text-field>
                    <v-text-field v-model.number="multiplyArg2" label="Arg 2" type="number" step="0.1"></v-text-field>
                    <v-btn @click="performGoMultiply" color="info" class="mt-2">Multiply via Go Tool</v-btn>
                    <p class="mt-2" v-if="multiplyResult !== null">Result: <strong>{{ multiplyResult }}</strong></p>
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
import { ref, computed, onMounted, onUnmounted } from 'vue' // Added onUnmounted
import InputArea from './components/input/InputArea.vue'
import TemplateSelector from './components/input/TemplateSelector.vue'
import ProcessButton from './components/input/ProcessButton.vue'
import { loadWasm, add as goAddWasm, multiply as goMultiplyWasm } from './services/wasmService.js' 
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
const llmModelLoadingProgress = ref({ text: "Initializing...", percentage: 0 }) // Initial state
const llmError = ref(null)
const finalizingLoad = ref(false); // For the 1-second 100% display

// Simulated progress
const simulatedProgress = ref(0);
let progressInterval = null;

const wasmLoaded = ref(false)
const wasmError = ref(null)
const addArg1 = ref(5)
const addArg2 = ref(7)
const addResult = ref(null)
const multiplyArg1 = ref(3.5)
const multiplyArg2 = ref(2)
const multiplyResult = ref(null)

onMounted(async () => {
  // Load WASM for Go tools
  try {
    await loadWasm();
    wasmLoaded.value = true;
  } catch (error) {
    wasmError.value = error.message || 'Unknown error during WASM tools loading.';
  }

  // LLM Engine Initialization with enhanced progress
  llmModelLoadingProgress.value = { text: "Initializing LLM Engine...", percentage: 0 };
  
  // Start simulated progress
  progressInterval = setInterval(() => {
    if (simulatedProgress.value < 30) {
      simulatedProgress.value += 2; // 30% over 15 seconds (2% per second)
      const currentActualPercentage = llmModelLoadingProgress.value?.actualPercentage || 0;
      llmModelLoadingProgress.value = {
        ...llmModelLoadingProgress.value, // Keep current text if any from actual progress
        percentage: Math.max(simulatedProgress.value, currentActualPercentage)
      };
    } else {
      clearInterval(progressInterval);
      progressInterval = null;
    }
  }, 1000); // Update every second

  setLLMInitProgressCallback((progress) => {
    // Store actual progress separately if needed, or just update main one
    llmModelLoadingProgress.value = { 
      text: progress.text, 
      percentage: Math.max(simulatedProgress.value, progress.progress * 100),
      actualPercentage: progress.progress * 100 // Store actual for comparison
    };
    if (progress.progress * 100 >= simulatedProgress.value && progressInterval) {
      // If actual progress catches up or surpasses simulated, clear interval if it was for <30%
       if (simulatedProgress.value < 30) clearInterval(progressInterval);
    }
  });

  try {
    await initializeLLMEngine();
    if (isLLMInitialized()) {
      clearInterval(progressInterval); // Stop simulated progress if still running
      progressInterval = null;

      llmModelLoadingProgress.value = { text: `Model ${getLLMLoadedModelId()} loaded! Finalizing...`, percentage: 100 };
      finalizingLoad.value = true;

      setTimeout(() => {
        llmModelLoaded.value = true;
        finalizingLoad.value = false;
        // llmModelLoadingProgress.value = null; // Or hide it via v-if="!llmModelLoaded"
      }, 1000); // Show 100% for 1 second
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
         !finalizingLoad.value; // Cannot process during the 1s finalization
});

const promptTemplates = {
  summary: (text) => `Summarize the following text concisely:\n\n"${text}"`,
  qa: (text) => `Based on the following text, answer the question it implies or asks. If it's not a question, explain what it is about briefly:\n\n"${text}"`,
  creative: (text) => `Continue the following creative piece or idea:\n\n"${text}"`,
  regex: (text) => `Generate a JavaScript compatible regular expression that achieves the following task described by the user: "${text}". Return only the regex pattern itself, without any surrounding explanations, code fences, or enclosing slashes.`,
  meeting_notes: (text) => `Please transform the following raw text into structured meeting notes. Identify a suitable title for the meeting, date (if inferable, otherwise use placeholder "[Date]"), attendees (if listed, otherwise "[Attendees]"), a concise overall summary of the meeting, key discussion points or topics, any decisions made, and clear action items with assigned owners if mentioned (otherwise "[Action item Assignee]"). Format the notes clearly for readability.\n\nRaw text to process:\n"${text}"`,
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
  const prompt = promptBuilder(text);

  isLoading.value = true;
  llmOutput.value = ''; 
  try {
    const result = await generateLLMText(prompt);
    llmOutput.value = result;
  } catch (error) {
    llmOutput.value = `Error from LLM: ${error.message}`;
    llmError.value = `Generation Error: ${error.message}`;
  } finally {
    isLoading.value = false;
  }
}

const performGoAdd = async () => {
  if (!wasmLoaded.value) { addResult.value = "WASM tools not loaded."; return; }
  try {
    addResult.value = "Calculating...";
    const result = await goAddWasm(parseInt(addArg1.value, 10), parseInt(addArg2.value, 10));
    addResult.value = result;
  } catch (error) {
    addResult.value = `Error: ${error.message}`;
  }
};

const performGoMultiply = async () => {
  if (!wasmLoaded.value) { multiplyResult.value = "WASM tools not loaded."; return; }
  try {
    multiplyResult.value = "Calculating...";
    const result = await goMultiplyWasm(parseFloat(multiplyArg1.value), parseFloat(multiplyArg2.value));
    multiplyResult.value = result;
  } catch (error) {
    multiplyResult.value = `Error: ${error.message}`;
  }
};
</script>

<style scoped>
.v-main {
  padding-top: 64px; 
  padding-bottom: 56px; 
}
h2 {
  margin-bottom: 16px;
}
.v-card.pa-4 { 
  padding: 16px !important; 
}
.grey--text { 
  color: #757575 !important;
}
</style>
