package main

import (
	"encoding/base64"
	"fmt"
	"syscall/js"
)

// Add function to be exported to JavaScript
func add(this js.Value, i []js.Value) interface{} {
	if len(i) != 2 {
		return js.ValueOf("Invalid number of arguments for add")
	}
	arg1 := i[0].Int()
	arg2 := i[1].Int()
	return js.ValueOf(arg1 + arg2)
}

// Multiply function to be exported to JavaScript
func multiply(this js.Value, i []js.Value) interface{} {
	if len(i) != 2 {
		return js.ValueOf("Invalid number of arguments for multiply")
	}
	arg1 := i[0].Float() // Use Float for more flexibility
	arg2 := i[1].Float()
	return js.ValueOf(arg1 * arg2)
}
// processTextWithTemplate function to be exported to JavaScript
func processTextWithTemplate(this js.Value, i []js.Value) interface{} {
	if len(i) != 2 {
		return js.ValueOf("Invalid number of arguments for processTextWithTemplate")
	}
	inputText := i[0].String()
	templateId := i[1].String()

	// Simulate processing based on templateId
	var outputText string
	switch templateId {
	case "summary":
		outputText = fmt.Sprintf("Go WASM Summary of '%s...': This is a summarized version.", inputText[:min(15, len(inputText))])
	case "qa":
		outputText = fmt.Sprintf("Go WASM Answer for '%s...?': The answer is 42.", inputText[:min(15, len(inputText))])
	case "creative":
		outputText = fmt.Sprintf("Go WASM Creative prompt for '%s...': Once upon a time in a digital land...", inputText[:min(15, len(inputText))])
	default:
		outputText = fmt.Sprintf("Go WASM processed '%s...' with unknown template '%s'.", inputText[:min(15, len(inputText))], templateId)
	}
	return js.ValueOf(outputText)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
// Base64 Encode Wrapper
func base64EncodeWrapper(this js.Value, i []js.Value) interface{} {
	if len(i) != 1 {
		return js.ValueOf(map[string]interface{}{"error": "Invalid number of arguments for base64Encode"})
	}
	inputStr := i[0].String()
	encodedStr := base64.StdEncoding.EncodeToString([]byte(inputStr))
	return js.ValueOf(encodedStr)
}

// Base64 Decode Wrapper
func base64DecodeWrapper(this js.Value, i []js.Value) interface{} {
	if len(i) != 1 {
		return js.ValueOf(map[string]interface{}{"error": "Invalid number of arguments for base64Decode"})
	}
	encodedStr := i[0].String()
	decodedBytes, err := base64.StdEncoding.DecodeString(encodedStr)
	if err != nil {
		return js.ValueOf(map[string]interface{}{"error": "Base64 decoding failed: " + err.Error()})
	}
	return js.ValueOf(string(decodedBytes))
}

func registerCallbacks() {
	js.Global().Set("goAdd", js.FuncOf(add))
	js.Global().Set("goMultiply", js.FuncOf(multiply))
	js.Global().Set("goProcessText", js.FuncOf(processTextWithTemplate)) // This can be removed later if not used
	js.Global().Set("goBase64Encode", js.FuncOf(base64EncodeWrapper))
	js.Global().Set("goBase64Decode", js.FuncOf(base64DecodeWrapper))
	fmt.Println("Go WASM module loaded and callbacks registered.")
}

func main() {
	c := make(chan struct{}, 0) // Create a channel to keep the Go program running
	registerCallbacks()
	<-c // Block main from exiting, allowing JS to call exported functions
}