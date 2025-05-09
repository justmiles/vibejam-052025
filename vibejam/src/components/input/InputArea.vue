<template>
  <v-textarea
    v-model="inputText"
    label="Enter your text here"
    placeholder="Type or paste the text you want to transform..."
    rows="10"
    auto-grow
    clearable
    outlined
    class="mb-4"
  ></v-textarea>
</template>

<script setup>
import { ref } from 'vue'

const inputText = ref('')

// Expose a method to get the text if needed by parent
defineExpose({
  getText: () => inputText.value,
  setText: (value) => { inputText.value = value }
})
</script>

<style scoped>
/* Add any specific styles for the input area if needed */
</style>