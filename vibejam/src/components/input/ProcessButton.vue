<template>
  <v-btn
    :loading="isLoading"
    :disabled="isDisabled || isLoading"
    color="secondary"
    x-large
    block
    @click="$emit('process-text')"
  >
    <v-icon left>mdi-magic-staff</v-icon>
    Do Magic
  </v-btn>
</template>

<script setup>
defineProps({
  isLoading: {
    type: Boolean,
    default: false
  },
  isDisabled: {
    type: Boolean,
    default: false
  }
})

defineEmits(['process-text'])
</script>

<style scoped>
.v-btn {
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}

.v-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}
</style>