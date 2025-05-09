<template>
  <v-select
    v-model="selectedTemplate"
    :items="templates"
    item-title="name"
    item-value="id"
    label="Select a transformation template"
    outlined
    class="mb-4"
  ></v-select>
</template>

<script setup>
import { ref } from 'vue'

const selectedTemplate = ref(null)
const templates = ref([
  { id: 'summary', name: 'Summarize Text' },
  { id: 'qa', name: 'Question Answering' },
  { id: 'creative', name: 'Creative Writing Prompt' },
  { id: 'regex', name: 'Regex Generator' },
  { id: 'meeting_notes', name: 'Meeting Notes Generator' }
  // Add more templates later based on requirements
])

// Expose selected template
defineExpose({
  getSelectedTemplate: () => selectedTemplate.value
})
</script>

<style scoped>
/* Add any specific styles for the template selector if needed */
</style>